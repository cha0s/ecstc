export default class Storage {

  constructor(Component) {
    this.Component = Component;
    Component.storage = this;
  }

  instances = new Map();
  pool = [];

  create(entityId) {
    const allocated = this.pool.length > 0 ? this.pool.pop() : new this.Component();
    allocated.entityId = entityId;
    this.instances.set(entityId, allocated);
    return allocated;
  }

  destroy(entityId) {
    const instance = this.instances.get(entityId);
    instance.destroy();
    this.pool.push(instance);
    this.instances.delete(entityId);
  }

}
