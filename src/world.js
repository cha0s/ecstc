import Component from './component.js';
import Entity from './entity.js';
import {isObjectEmpty} from './object.js';
import Query from './query.js';
import System from './system.js';

class World {

  caret = 1;
  changes = [];
  pool = {};
  Components = {};
  destroyed = new Set();
  destructors = new Map();
  elapsed = {delta: 0, total: 0};
  entities = new Map();
  freePool = [];
  instances = [];
  queries = new Set();
  systems = {};

  static Entity = Entity;

  constructor({Components = {}, Systems = {}} = {}) {
    const {resolve, sorted} = Component.instantiate(Components)
    const pool = this.pool = {};
    this.resolveComponentDependencies = resolve;
    let componentId = 0;
    const ComponentsById = {};
    for (const componentName of sorted) {
      const Component = Components[componentName];
      const WorldComponent = class extends Component {
        static componentName = componentName;
        static id = componentId;
        static get pool() { return pool[componentName]; }
      };
      ComponentsById[componentId] = this.Components[componentName] = WorldComponent;
      pool[componentName] = new WorldComponent.Pool(WorldComponent);
      componentId += 1;
    }
    const componentCount = componentId;
    this.componentCount = componentCount;
    for (const systemName in System.sort(Systems)) {
      this.systems[systemName] = new Systems[systemName](this);
    }
  }

  addDestroyListener(entity, listener) {
    if (!this.destructors.has(entity)) {
      this.destructors.set(entity, {destroying: false, listeners: new Set(), pending: new Set()});
    }
    this.destructors.get(entity).listeners.add(listener);
    return () => {
      if (this.destructors.has(entity)) {
        this.destructors.get(entity).listeners.delete(listener);
      }
    };
  }

  addDestructor(entity) {
    if (!this.destructors.has(entity)) {
      this.destructors.set(entity, {destroying: false, listeners: new Set(), pending: new Set()})
    }
    const {pending} = this.destructors.get(entity);
    const token = {};
    pending.add(token);
    return () => { pending.delete(token); };
  }

  clear() {
    for (const entity of this.entities.values()) {
      this.destroyImmediately(entity);
    }
    this.caret = 1;
    this.markClean();
  }

  create(components = {}) {
    return this.createSpecific(this.nextId(), components);
  }

  createSpecific(entityId, components) {
    let entity;
    if (this.freePool.length > 0) {
      entity = this.freePool.pop();
    }
    else {
      entity = new this.constructor.Entity(this, entityId);
      this.instances.push(entity);
    }
    entity.id = entityId;
    this.entities.set(entityId, entity);
    for (const componentName of this.resolveComponentDependencies(components)) {
      if (componentName in this.Components) {
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
    if (!this.destructors.has(entity)) {
      this.destructors.set(entity, {destroying: true, listeners: new Set(), pending: new Set()});
    }
    else {
      this.destructors.get(entity).destroying = true;
    }
  }

  destroyImmediately(entity) {
    if (this.destructors.has(entity)) {
      for (const listener of this.destructors.get(entity).listeners) {
        listener(entity);
      }
      this.destructors.delete(entity);
    }
    this.deindex(entity);
    entity.destroyComponents();
    this.freePool.push(entity);
    this.entities.delete(entity.id);
    this.destroyed.add(entity.id);
  }

  diff() {
    const entries = [];
    for (const [entityId, entity] of this.entities) {
      if (entity) {
        const diff = entity.diff();
        if (!isObjectEmpty(diff)) { entries.push([entityId, diff]); }
      }
    }
    for (const entityId of this.destroyed) {
      entries.push([entityId, false]);
    }
    return new Map(entries);
  }

  instantiateWasm(wasm) {
    const promises = [];
    for (const systemName in this.systems) {
      if (this.systems[systemName].constructor.wasm) {
        promises.push(this.systems[systemName].instantiateWasm(wasm[systemName]));
      }
    }
    return Promise.all(promises);
  }

  markClean() {
    for (const componentName in this.Components) {
      this.Components[componentName].pool.markClean();
    }
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

  tickWithElapsed() {
    for (const systemName in this.systems) {
      this.systems[systemName].tickWithChecks(this.elapsed);
    }
    for (const [entity, {destroying, pending}] of this.destructors) {
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
