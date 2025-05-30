import Component from './component.js';
import Entity from './entity.js';
import Query from './query.js';
import System from './system.js';

class World {

  caret = 1;
  changes = [];
  componentPool = {};
  Components = {};
  destructors = new Map();
  dirty = new Map();
  entities = new Map();
  queries = new Set();
  systems = {};

  static Entity = Entity;

  constructor({Components = {}, Systems = {}} = {}) {
    const {componentPool, resolve, sortedComponentNames} = Component.instantiate(Components)
    this.componentPool = componentPool;
    this.resolveComponentDependencies = resolve;
    for (const componentName of sortedComponentNames) {
      this.Components[componentName] = class extends Components[componentName] {
        static componentName = componentName;
        static get pool() { return componentPool[componentName]; }
      };
    }
    for (const systemName in System.sort(Systems)) {
      this.systems[systemName] = new Systems[systemName](this);
    }
  }

  addDestroyListener(entity, listener) {
    if (!this.destructors.has(entity)) {
      this.destructors.set(entity, {listeners: new Set(), pending: new Set()});
    }
    this.destructors.get(entity).listeners.add(listener);
    return () => {
      if (!this.destructors.has(entity)) {
        return;
      }
      this.destructors.get(entity).listeners.delete(listener);
    };
  }

  addDestructor(entity) {
    if (!this.destructors.has(entity)) {
      this.destructors.set(entity, {listeners: new Set(), pending: new Set()})
    }
    const {pending} = this.destructors.get(entity);
    const token = {};
    pending.add(token);
    return () => {
      pending.delete(token);
    };
  }

  clear() {
    for (const entity of this.entities.values()) {
      this.destroyImmediately(entity);
    }
    this.caret = 1;
    this.dirty.clear();
  }

  create(components = {}) {
    return this.createSpecific(this.nextId(), components);
  }

  createSpecific(entityId, components) {
    const entity = new this.constructor.Entity(this, entityId);
    entity.onInvalidate = (key) => { this.onInvalidate(entityId, key); };
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

  destroy(entity, listener) {
    if (!this.destructors.has(entity)) {
      this.destructors.set(entity, {listeners: new Set(), pending: new Set()});
    }
    const dependencies = this.destructors.get(entity);
    dependencies.destroying = true;
    if (listener) {
      dependencies.listeners.add(listener);
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
    entity.destroy();
    this.entities.delete(entity.id);
    this.onInvalidate(entity.id, '');
  }

  diff() {
    const diff = new Map();
    for (const [entityId, change] of this.dirty) {
      if (change) {
        diff.set(entityId, this.entities.get(entityId).diff());
      }
      else {
        diff.set(entityId, false);
      }
    }
    return diff;
  }

  markClean() {
    for (const entityId of this.dirty.keys()) {
      this.entities.get(entityId)?.markClean();
    }
    this.dirty.clear();
  }

  nextId() {
    return this.caret++;
  }

  onInvalidate(entityId, componentName) {
    let entry = this.dirty.get(entityId);
    if (componentName) {
      if (!entry) {
        this.dirty.set(entityId, entry = new Set());
      }
      entry.add(componentName);
    }
    else {
      this.dirty.set(entityId, false);
    }
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

  tick(elapsed) {
    for (const systemName in this.systems) {
      this.systems[systemName].tickWithChecks(elapsed);
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
