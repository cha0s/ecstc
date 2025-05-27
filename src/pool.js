export default class Pool {

  constructor(Component) {
    this.Component = Component;
  }

  instances = new Map();
  pool = [];

  allocate(entityId) {
    const allocated = this.pool.length > 0
      ? this.pool.pop()
      : new this.Component();
    this.instances.set(entityId, allocated);
    return allocated;
  }

  free(entityId) {
    const instance = this.instances.get(entityId);
    instance.destroy();
    this.pool.push(instance);
    this.instances.delete(entityId);
  }

}
