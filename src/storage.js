export default class Storage {

  constructor(Component) {
    this.Component = Component;
  }

  instances = Object.create(null);
  pool = [];

  create(entityId) {
    const allocated = this.pool.length > 0 ? this.pool.pop() : new this.Component();
    allocated.entityId = entityId;
    this.instances[entityId] = allocated;
    return allocated;
  }

  destroy(entityId) {
    const instance = this.instances[entityId];
    instance.destroy();
    this.pool.push(instance);
    delete this.instances[entityId];
  }

  get(entityId) {
    return this.instances[entityId];
  }

}
