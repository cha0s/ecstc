import Digraph from './digraph.js';

export default class System {

  active = true;
  static frequency = 0;
  isScheduled = false;
  next = 0;
  world;

  constructor(world) {
    this.world = world;
    this.next = this.constructor.frequency;
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
