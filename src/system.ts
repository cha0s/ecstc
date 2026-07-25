import { type ComponentConfiguration } from './component.ts'
import { type EntityFromComponents } from './entity.ts'
import { type Query } from './query.ts'
import { type World } from './world.ts'

export interface Elapsed {
  delta: number
  total: number
}

/**
 * System.
 */
export class System<
  UseWasm extends boolean = any,
  W extends World<any, any, any, UseWasm> = World<any, any, any, UseWasm>,
> {

  /**
   * Whether this system is active.
   */
  active = true
  remaining = 0
  frequency = 0
  queries = new Map<string, Query<any, UseWasm>>()
  scheduled = false
  wasm: WebAssembly.Exports | null = null
  world: W

  constructor(world: W) {
    this.world = world
  }

  /**
   * Initialize the system.
   */
  initialize() {
    this.remaining = this.frequency
  }

  /**
   * Instantiate WASM instance.
   * @param buffer The WASM source buffer.
   * @param options WASM compilation options.
   * @returns The WASM exports.
   */
  async instantiateWasm(
    buffer: BufferSource,
    options: WebAssembly.WebAssemblyCompileOptions = {},
  ) {
    return WebAssembly.instantiate(buffer, this.wasmImports(), options)
      .then(({ instance: { exports } }) => {
        this.wasm = exports
      })
  }

  /**
   * Create an entity query.
   * @param name The name of the query used for naming memory in WASM.
   * @param configuration The query configuration.
   * @returns The query.
   */
  query<
    Includes extends Record<string, ComponentConfiguration<any, any, any>> = {}
  >(
    name: string,
    configuration: (
      | {
        /**
         * Callback invoked when an entity is deindexed.
         * @param entity The entity
         */
        onDeindex?: (entity: EntityFromComponents<Includes>) => void,
        /**
         * Callback invoked when an entity is inserted.
         * @param entity The entity
         */
        onInsert?: (entity: EntityFromComponents<Includes>) => void,
        /**
         * Component types excluded from this query.
         */
        excludes?: Record<string, ComponentConfiguration<any, any, any>>,
        /**
         * Component types included from this query.
         */
        includes: Includes,
      }
      | {
        /**
         * Callback invoked when an entity is deindexed.
         * @param entity The entity
         */
        onDeindex?: (entity: EntityFromComponents<Includes>) => void,
        /**
         * Callback invoked when an entity is inserted.
         * @param entity The entity
         */
        onInsert?: (entity: EntityFromComponents<Includes>) => void,
        /**
         * Component types excluded from this query.
         */
        excludes: Record<string, ComponentConfiguration<any, any, any>>,
        /**
         * Component types included from this query.
         */
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

  /**
   * Schedule this system to run immediately, even if it only runs on a frequency.
   */
  schedule() {
    this.scheduled = true
  }

  /**
   * Tick this system
   * @param elapsed Elapsed time.
   * @param elapsed.delta Time elapsed since last tick.
   * @param elapsed.total Total time elapsed since the world was created.
   */
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

  /**
   * WASM imports.
   */
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
