import Component from './component.js';
import Entity from './entity.js';
import {OnInvalidate} from './property.js';
import System from './system.js';

class World {

  caret = 1;
  $$destructors = new Map();
  dirty = new Map();
  changes = [];
  Components = {};
  entities = new Map();
  globals = {};
  Systems = {};

  static Entity = Entity;

  constructor({Components = {}, Systems = {}} = {}) {
    for (const componentName of Component.sort(Components)) {
      const {Storage} = Components[componentName];
      const ComponentStorage = new Storage(Components[componentName]);
      const {Component} = ComponentStorage;
      Component.storage = ComponentStorage;
      this.Components[componentName] = Component;
    }
    for (const systemName in System.sort(Systems)) {
      this.Systems[systemName] = new Systems[systemName](this);
    }
  }

  addDestroyListener(entity, listener) {
    if (!this.$$destructors.has(entity)) {
      this.$$destructors.set(entity, {listeners: new Map(), pending: new Set()});
    }
    this.$$destructors.get(entity).listeners.set(listener, true);
  }

  addDestructor(entity) {
    if (!this.$$destructors.has(entity)) {
      this.$$destructors.set(entity, {listeners: new Map(), pending: new Set()})
    }
    const {pending} = this.$$destructors.get(entity);
    const token = {};
    pending.add(token);
    return () => {
      pending.delete(token);
    };
  }

  apply(diff) {
    for (const [entityId, change] of diff) {
      this.applyEntity(entityId, change);
    }
  }

  applyEntity(entityId, change) {
    const entity = this.entities.get(entityId);
    if (false === change) {
      this.destroy(entity);
      return;
    }
    if (!entity) {
      this.createSpecific(entityId, change);
      return;
    }
    for (const componentName in change) {
      const values = change[componentName];
      const Component = this.Components[componentName];
      if (false === values) {
        entity.removeComponent(Component);
        // this.markChange(entityId, componentName, false);
        continue;
      }
      if (!entity.has(componentName)) {
        entity.addComponent(Component, values);
        // this.markChange(entityId, componentName, values);
        continue;
      }
    }
    entity.merge(change);
  }

  // changed(criteria) {
  // }

  clear() {
    for (const entity of this.entities.values()) {
      this.destroyImmediately(entity);
    }
    this.setClean();
    this.caret = 1;
  }

  create(components = {}) {
    return this.createSpecific(this.nextId(), components);
  }

  createSpecific(entityId, components) {
    const entity = new this.constructor.Entity(entityId);
    entity[OnInvalidate] = (key) => {
      this[OnInvalidate](entityId, key);
    };
    this.entities.set(entityId, entity);
    // ensure dependencies
    const adding = new Set();
    for (const componentName in components) {
      if (!adding.has(componentName)) {
        adding.add(componentName);
        this.ensureDependencies(adding, this.Components[componentName].dependencies);
      }
    }
    for (const componentName in this.Components) {
      if (adding.has(componentName)) {
        entity.addComponent(this.Components[componentName], components[componentName] ?? {});
      }
    }
    this.reindex(entity);
    return entity;
  }

  deindex(entity) {
    for (const systemName in this.Systems) {
      const System = this.Systems[systemName];
      if (!System.active) {
        continue;
      }
      System.deindex(entity);
    }
  }

  destroy(entity, listener) {
    if (!this.$$destructors.has(entity)) {
      this.$$destructors.set(entity, {listeners: new Map(), pending: new Set()});
    }
    const dependencies = this.$$destructors.get(entity);
    dependencies.destroying = true;
    if (listener) {
      dependencies.listeners.set(listener, true);
    }
  }

  destroyImmediately(entity) {
    if (this.$$destructors.has(entity)) {
      for (const [listener] of this.$$destructors.get(entity).listeners) {
        listener(entity);
      }
      this.$$destructors.delete(entity);
    }
    this.deindex(entity);
    entity.destroy();
    this.entities.delete(entity.id);
    this[OnInvalidate](entity.id, undefined);
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

  ensureDependencies(adding, componentNames) {
    for (const componentName of componentNames) {
      if (!adding.has(componentName)) {
        adding.add(componentName);
        this.ensureDependencies(adding, this.Components[componentName].dependencies);
      }
    }
  }

  // static fastMerge(l, r) {
  // }

  // static merge(l, r) {
  // }

  nextId() {
    return this.caret++;
  }

  [OnInvalidate](entityId, componentName) {
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

  reindex(entity) {
    for (const systemName in this.Systems) {
      const System = this.Systems[systemName];
      if (System.active) {
        System.reindex(entity);
      }
    }
  }

  removeDestroyListener(entity, listener) {
    if (!this.$$destructors.has(entity)) {
      return;
    }
    this.$$destructors.get(entity).listeners.delete(listener);
  }

  setClean() {
    this.dirty.clear();
  }

  tick(elapsed) {
    for (const systemName in this.Systems) {
      this.Systems[systemName].tickWithChecks(elapsed);
    }
    for (const [entity, {destroying, pending}] of this.$$destructors) {
      if (destroying && 0 === pending.size) {
        this.destroyImmediately(entity);
      }
    }
  }

}

export default World;
