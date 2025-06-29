import Digraph from './digraph.js';

export default class System {

  active = true;
  static frequency = 0;
  isScheduled = false;
  next = 0;
  queries = new Map();
  static wasm = null;
  wasm = null;
  world;

  constructor(world) {
    this.world = world;
    this.next = this.constructor.frequency;
    this.onInitialize();
  }

  imports() {
    const componentNames = new Set();
    const imports = {};
    imports.query = {};
    for (const [name, query] of this.queries) {
      query.criteria.with.forEach((componentName) => {
        componentNames.add(componentName);
      });
      for (const [key, value] of Object.entries(query.imports())) {
        imports.query[`${name}_${key}`] = value;
      }
    }
    for (const componentName of componentNames) {
      imports[componentName] = this.world.pool[componentName].imports();
    }
    imports.system = this.constructor.wasm?.imports.call(this) ?? {};
    imports.world = this.world.imports();
    return imports;
  }

  instantiateWasm(buffer, options) {
    return WebAssembly.instantiate(buffer, this.imports(), options)
      .then(({instance: {exports}}) => this.wasm = exports);
  }

  onInitialize() {}

  static get priority() {
    return {
      phase: 'normal',
    }
  }

  query(parameters, name = 'default') {
    if (this.queries.has(name)) {
      throw new EvalError(`query '${name}' already exists`);
    }
    const query = this.world.query(parameters);
    this.queries.set(name, query);
    return query;
  }

  schedule() {
    this.isScheduled = true;
  }

  static sort(Systems) {
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

  /* v8 ignore next */
  tick() {}

  tickWithChecks(elapsed) {
    if (!this.active) {
      this.next += elapsed.delta;
      return;
    }
    const {frequency} = this.constructor;
    if (!frequency) {
      this.tick(elapsed);
      return;
    }
    if (this.isScheduled) {
      this.isScheduled = false;
      const delta = elapsed.total - (this.next - frequency);
      this.tick({delta, total: elapsed.total});
      this.next = elapsed.total + frequency;
      return;
    }
    while (elapsed.total >= this.next) {
      this.tick({delta: frequency, total: this.next + frequency});
      this.next += frequency;
    }
  }

}
