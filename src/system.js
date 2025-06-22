import Digraph from './digraph.js';

export default class System {

  active = true;
  static frequency = 0;
  isScheduled = false;
  next = 0;
  queries = [];
  static wasm = null;
  wasm = null;
  world;

  constructor(world) {
    this.world = world;
    this.next = this.constructor.frequency;
    this.onInitialize();
  }

  instantiateWasm(buffer, options) {
    const componentNames = new Set();
    this.queries.forEach((query) => {
      query.criteria.with.forEach((componentName) => {
        componentNames.add(componentName);
      });
    });
    let callbacks = [];
    if (this.constructor.wasm?.callbacks) {
      callbacks = this.constructor.wasm.callbacks.map((callback) => callback.bind(this));
    }
    const imports = {};
    for (const componentName of componentNames) {
      const pool = this.world.collection.pool[componentName];
      imports[componentName] = {
        callback: (index, instance) => callbacks[index](instance),
        data: pool.data.memory,
        dirty: pool.dirty.memory,
        proxies: pool.proxies,
      };
    }
    return WebAssembly.instantiate(buffer, imports, options)
      .then(({instance: {exports}}) => this.wasm = exports);
  }

  onInitialize() {}

  static get priority() {
    return {
      phase: 'normal',
    }
  }

  query(parameters) {
    const query = this.world.query(parameters);
    this.queries.push(query);
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
