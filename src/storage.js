export default class Storage {

  constructor(Component) {
    this.Component = Component;
  }

  instances = Object.create(null);
  pool = [];

  create(entityId, values) {
    const allocated = this.pool.length > 0 ? this.pool.pop() : new this.Component();
    allocated.set(entityId, values);
    this.instances[entityId] = allocated;
    return allocated;
  }

  destroy(entityId) {
    const instance = this.instances[entityId];
    instance.destroy();
    this.pool.push(instance);
    delete this.instances[entityId];
    // this.ecs.markChange(entityId, this.constructor.componentName, false);
  }

  get(entityId) {
    return this.instances[entityId];
  }

}
