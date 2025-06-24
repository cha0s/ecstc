import {Pool} from 'propertea';

import {createCollection} from './component.js';
import Entity from './entity.js';
import Query from './query.js';
import System from './system.js';

class DestroyDescriptor {
  constructor() {
    this.destroying = true;
    this.listeners = new Set();
    this.pending = new Set();
  }
}

class World {

  caret = 1;
  changes = [];
  collection = null;
  components = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    width: 0,
    view: new Uint8Array(0),
  };
  destroyDependencies = new Map();
  destroyed = new Set();
  dirty = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    width: 0,
    view: new Uint8Array(0),
  };
  elapsed = {delta: 0, total: 0};
  entities = new Map();
  freePool = [];
  instances = [];
  queries = new Set();
  systems = {};

  static Entity = Entity;

  constructor({Components = {}, Systems = {}} = {}) {
    this.collection = createCollection(Components);
    const pool = {};
    for (const componentName in this.collection.components) {
      const Component = this.collection.components[componentName];
      pool[componentName] = this.componentPool(Component);
    }
    this.pool = pool;
    this.components.width = Object.keys(this.collection.components).length;
    this.dirty.width = 3 * this.components.width;
    for (const systemName in System.sort(Systems)) {
      this.systems[systemName] = new Systems[systemName](this);
    }
    const {instances} = this;
    this.Entity = class extends this.constructor.Entity {
      constructor(world, entityId) {
        super(world, entityId);
        this.index = instances.length;
      }
    }
  }

  addDestroyDependency(entity) {
    if (!this.destroyDependencies.has(entity)) {
      this.destroyDependencies.set(entity, new DestroyDescriptor());
    }
    const {pending} = this.destroyDependencies.get(entity);
    const token = {};
    pending.add(token);
    return () => { pending.delete(token); };
  }

  addDestroyListener(entity, listener) {
    if (!this.destroyDependencies.has(entity)) {
      this.destroyDependencies.set(entity, new DestroyDescriptor());
    }
    this.destroyDependencies.get(entity).listeners.add(listener);
    return () => {
      if (this.destroyDependencies.has(entity)) {
        this.destroyDependencies.get(entity).listeners.delete(listener);
      }
    };
  }

  clear() {
    for (const entity of this.entities.values()) {
      this.destroyImmediately(entity);
    }
    this.caret = 1;
    this.markClean();
  }

  componentPool(Component) {
    const pool = new Pool({
      type: 'object',
      properties: Component.properties,
      Proxy: (Proxy) => Component.proxy(Proxy),
    }, {
      onDirty: (bit) => {
        const index = Math.floor(bit / width);
        if (index < pool.proxies.length) {
          const {entity} = pool.proxies[index];
          this.setComponentDirty(entity.index, Component.componentName, 2);
        }
      },
    });
    const width = pool.dirty.width;
    return pool;
  }

  create(components = {}) {
    return this.createSpecific(this.nextId(), components);
  }

  createSpecific(entityId, components) {
    if (this.entities.size === this.dirty.nextGrow) {
      this.dirty.memory.grow(1);
      this.dirty.view = new Uint8Array(this.dirty.memory.buffer);
      this.dirty.nextGrow = Math.floor(this.dirty.memory.buffer.byteLength / (this.dirty.width / 8));
    }
    if (this.entities.size === this.components.nextGrow) {
      this.components.memory.grow(1);
      this.components.view = new Uint8Array(this.components.memory.buffer);
      this.components.nextGrow = Math.floor(this.components.memory.buffer.byteLength / (this.components.width / 8));
    }
    let entity;
    if (this.freePool.length > 0) {
      entity = this.freePool.pop();
      this.instances[entity.index] = entity;
    }
    else {
      entity = new this.Entity(this, entityId);
      this.instances.push(entity);
    }
    entity.id = entityId;
    this.entities.set(entityId, entity);
    for (const componentName of this.collection.resolve(components)) {
      if (componentName in this.collection.components) {
        entity.addComponent(componentName, components[componentName]);
      }
    }
    this.reindex(entity);
    return entity;
  }

  deindex(entity) {
    for (const query of this.queries) {
      query.deindex(entity);
    }
  }

  destroy(entity) {
    if (!this.destroyDependencies.has(entity)) {
      const descriptor = new DestroyDescriptor()
      descriptor.destroying = true;
      this.destroyDependencies.set(entity, descriptor);
    }
    else {
      this.destroyDependencies.get(entity).destroying = true;
    }
  }

  destroyImmediately(entity) {
    if (this.destroyDependencies.has(entity)) {
      for (const listener of this.destroyDependencies.get(entity).listeners) {
        listener(entity);
      }
      this.destroyDependencies.delete(entity);
    }
    this.deindex(entity);
    entity.destroyComponents();
    this.freePool.push(entity);
    this.entities.delete(entity.id);
    this.instances[entity.index] = null;
    this.destroyed.add(entity.id);
  }

  diff() {
    const entries = [];
    for (const entity of this.instances) {
      if (entity) {
        const diff = entity.diff();
        if (diff) { entries.push([entity.id, diff]); }
      }
    }
    for (const entityId of this.destroyed) {
      entries.push([entityId, false]);
    }
    return new Map(entries);
  }

  instantiateWasm(wasm) {
    const promises = [];
    for (const systemName in wasm) {
      promises.push(
        this.systems[systemName].instantiateWasm(wasm[systemName])
          .catch((error) => {
            error.message = `System(${systemName}).instantiateWasm: ${error.message}`;
            throw error;
          }),
      );
    }
    return Promise.all(promises);
  }

  markClean() {
    for (const componentName in this.pool) {
      this.pool[componentName].markClean();
    }
    this.dirty.view.fill(0);
    this.destroyed.clear();
  }

  nextId() {
    return this.caret++;
  }

  query(parameters) {
    const query = new Query(parameters);
    for (const entity of this.entities.values()) {
      query.reindex(entity);
    }
    this.queries.add(query);
    return query;
  }

  reindex(entity) {
    for (const query of this.queries) {
      query.reindex(entity);
    }
  }

  set(diff) {
    for (const [entityId, change] of diff) {
      this.setEntity(entityId, change);
    }
  }

  setComponentDirty(index, componentName, bit) {
    const o = this.dirty.width * index + 3 * this.collection.components[componentName].id + bit;
    const i = o >> 3;
    const j = 1 << (o & 7);
    this.dirty.view[i] |= j;
  }

  setEntity(entityId, change) {
    const entity = this.entities.get(entityId);
    if (entity) {
      if (false === change) {
        this.destroy(entity);
      }
      else {
        entity.set(change);
      }
    }
    else {
      if (change) {
        this.createSpecific(entityId, change);
      }
    }
  }

  tick(delta) {
    this.elapsed = {delta, total: this.elapsed.total + delta};
    this.tickWithElapsed();
  }

  tickSystems() {
    for (const systemName in this.systems) {
      this.systems[systemName].tickWithChecks(this.elapsed);
    }
  }

  tickWithElapsed() {
    this.tickSystems();
    for (const [entity, {destroying, pending}] of this.destroyDependencies) {
      if (destroying && 0 === pending.size) {
        this.destroyImmediately(entity);
      }
    }
  }

  toJSON() {
    const json = [];
    for (const entity of this.entities.values()) {
      json.push(entity.toJSON());
    }
    return json;
  }

}

export default World;
