import { type ComponentConfiguration } from './component.ts'
import { type EntityFromComponents } from './entity.ts'
import { type Query } from './query.ts'
import { type World } from './world.ts'

export interface Elapsed {
  delta: number
  total: number
}

export class System<
  UseWasm extends boolean = any,
  W extends World<any, any, any, UseWasm> = World<any, any, any, UseWasm>,
> {

  active = true
  remaining = 0
  frequency = 0
  static priority: {
    after?: string | string[]
    before?: string | string[]
    phase?: 'normal' | 'pre' | 'post'
  } = {
    after: [],
    before: [],
    phase: 'normal',
  }
  queries = new Map<string, Query<any, UseWasm>>()
  scheduled = false
  wasm: WebAssembly.Exports | null = null
  world: W

  constructor(world: W) {
    this.world = world
  }

  initialize() {
    this.remaining = this.frequency
  }

  async instantiateWasm(
    buffer: BufferSource,
    options: WebAssembly.WebAssemblyCompileOptions = {},
  ) {
    return WebAssembly.instantiate(buffer, this.wasmImports(), options)
      .then(({instance: {exports}}) => {
        this.wasm = exports
      })
  }

  query<
    Includes extends Record<string, ComponentConfiguration<any, any, any>> = {}
  >(
    name: string,
    configuration: (
      | {
        onDeindex?: (entity: EntityFromComponents<Includes>) => void,
        onInsert?: (entity: EntityFromComponents<Includes>) => void,
        excludes?: Record<string, ComponentConfiguration<any, any, any>>,
        includes: Includes,
      }
      | {
        onDeindex?: (entity: EntityFromComponents<Includes>) => void,
        onInsert?: (entity: EntityFromComponents<Includes>) => void,
        excludes: Record<string, ComponentConfiguration<any, any, any>>,
        includes?: Includes,
      }
    ),
  ) {
    if (this.queries.has(name)) {
      throw new EvalError(`query '${name}' already exists`)
    }
    const query = this.world.query(configuration)
    this.queries.set(name, query)
    return query
  }

  schedule() {
    this.scheduled = true
  }

  /* v8 ignore next */
  tick(_elapsed: Elapsed) {}

  tickWithChecks(elapsed: Elapsed) {
    const { frequency } = this
    // continuous
    if (0 === frequency) {
      this.tick(elapsed)
      return
    }
    // discrete
    let trailingTotal = (elapsed.total - elapsed.delta) - (frequency - this.remaining)
    if (this.scheduled) {
      this.tick(elapsed)
      this.remaining = frequency
      this.scheduled = false
    }
    else {
      this.remaining -= elapsed.delta
      while (this.remaining <= 0) {
        trailingTotal += frequency
        this.tick({delta: frequency, total: trailingTotal})
        this.remaining += frequency
      }
    }
  }

  wasmImports() {
    const componentNames = new Set<keyof W['_CC']>()
    const imports = {} as any
    imports.query = {}
    for (const [name, query] of this.queries) {
      query.includes.forEach((componentName) => {
        componentNames.add(componentName)
      })
      for (const [key, value] of Object.entries(query.wasmImports())) {
        imports.query[`${name}_${key}`] = value
      }
    }
    for (const componentName of componentNames) {
      imports[componentName] = this.world.pools[componentName].wasmImports()
    }
    imports.world = this.world.wasmImports()
    return imports
  }

}
