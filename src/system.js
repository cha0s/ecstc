import Digraph from './digraph.js';

export default class System {

  active = true;
  elapsed = 0;
  frequency = 0;
  scheduled = false;
  world;

  constructor(world) {
    this.world = world;
    this.onInitialize();
  }

  onInitialize() {}

  static get priority() {
    return {
      phase: 'normal',
    }
  }

  query(parameters) {
    return this.world.query(parameters);
  }

  schedule() {
    this.scheduled = true;
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

  tick() {}

  tickWithChecks(elapsed) {
    if (!this.active) {
      return;
    }
    if (!this.frequency) {
      this.tick(elapsed);
      return;
    }
    this.elapsed += elapsed;
    if (this.scheduled) {
      this.tick(this.elapsed);
      this.elapsed = 0;
      this.scheduled = false;
      return;
    }
    while (this.elapsed >= this.frequency) {
      this.tick(this.frequency);
      this.elapsed -= this.frequency;
    }
  }

}
