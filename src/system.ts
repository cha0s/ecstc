import { Digraph } from './digraph.ts';

import { type Query } from './query.ts'
import { type World } from './world.ts'

export interface Elapsed {
  delta: number
  total: number
}

export class System<
  W extends World<any, any> = World<any, any>,
> {

  active = true;
  remaining = 0
  frequency = 0;
  static priority: {
    after: string | string[]
    before: string | string[]
    phase: 'normal' | 'pre' | 'post'
  } = {
    after: [],
    before: [],
    phase: 'normal',
  }
  queries = new Map<string, Query<W>>();
  wasm: WebAssembly.Exports | null = null;
  world: W;

  constructor(world: W) {
    this.world = world;
  }

  initialize() {
    this.remaining = this.frequency
  }

  async instantiateWasm(buffer: BufferSource, options: WebAssembly.WebAssemblyCompileOptions) {
    return WebAssembly.instantiate(buffer, this.wasmImports(), options)
      .then(({instance: {exports}}) => {
        this.wasm = exports
      });
  }

  query(name: string, parameters: ConstructorParameters<typeof Query>[0]) {
    if (this.queries.has(name)) {
      throw new EvalError(`query '${name}' already exists`);
    }
    const query = this.world.query(parameters);
    this.queries.set(name, query);
    return query;
  }

  schedule() {
    this.remaining = 0
  }

  static sort<W extends World<any, any>>(Systems: { [K in string ]: typeof System<W>}) {
    const phases = {
      'pre': new Digraph(),
      'normal': new Digraph(),
      'post': new Digraph(),
    };
    for (const systemName in Systems) {
      const {priority} = Systems[systemName];
      const phase = phases[priority.phase || 'normal'];
      phase.ensureTail(systemName);
      if (priority.before) {
        for (const before of Array.isArray(priority.before) ? priority.before : [priority.before]) {
          phase.addDependency(before, systemName);
        }
      }
      if (priority.after) {
        for (const after of Array.isArray(priority.after) ? priority.after : [priority.after]) {
          phase.addDependency(systemName, after);
        }
      }
    }
    const sorted = [
      ...phases['pre'].sort(),
      ...phases['normal'].sort(),
      ...phases['post'].sort(),
    ];
    return Object.fromEntries(
      Object.entries(Systems)
        .toSorted(([l], [r]) => sorted.indexOf(l) - sorted.indexOf(r)),
    );
  }

  tick(_elapsed: Elapsed) {}

  tickWithChecks(elapsed: Elapsed) {
    const { frequency } = this
    // continuous
    if (0 === frequency) {
      this.tick(elapsed);
      return;
    }
    // discrete
    let trailingTotal = (elapsed.total - elapsed.delta) - (frequency - this.remaining)
    this.remaining -= elapsed.delta
    while (this.remaining <= 0) {
      trailingTotal += frequency
      this.tick({delta: frequency, total: trailingTotal});
      this.remaining += frequency
    }
  }

  wasmImports() {
    const componentNames = new Set<keyof W['_CC']>();
    const imports = {} as any;
    imports.query = {};
    for (const [name, query] of this.queries) {
      query.includes.forEach((componentName) => {
        componentNames.add(componentName);
      });
      for (const [key, value] of Object.entries(query.wasmImports())) {
        imports.query[`${name}_${key}`] = value;
      }
    }
    for (const componentName of componentNames) {
      imports[componentName] = this.world.pools[componentName].wasmImports();
    }
    imports.world = this.world.wasmImports();
    return imports;
  }

}
