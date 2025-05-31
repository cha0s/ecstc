import Component from './component.js';
import Entity from './entity.js';
import {isObjectEmpty} from './object.js';
import {Diff, MarkClean, MarkDirty} from './property.js';
import Query from './query.js';
import System from './system.js';

class World {

  caret = 1;
  changes = [];
  componentPool = {};
  Components = {};
  destroyed = [];
  destructors = new Map();
  Entity = null;
  entities = new Map();
  queries = new Set();
  systems = {};

  static Entity = Entity;

  constructor({Components = {}, Systems = {}} = {}) {
    const {resolve, sortedComponentNames} = Component.instantiate(Components)
    const componentPool = this.componentPool = {};
    this.resolveComponentDependencies = resolve;
    let componentId = 0;
    const ComponentsById = {};
    for (const componentName of sortedComponentNames) {
      const Component = Components[componentName];
      const WorldComponent = class extends Component {
        static componentName = componentName;
        static id = componentId;
        static get pool() { return componentPool[componentName]; }
      };
      ComponentsById[componentId] = this.Components[componentName] = WorldComponent;
      componentPool[componentName] = new WorldComponent.Pool(WorldComponent);
      componentId += 1;
    }
    const componentCount = componentId;
    this.componentCount = componentCount;
    for (const systemName in System.sort(Systems)) {
      this.systems[systemName] = new Systems[systemName](this);
    }
    const WorldComponents = this.Components;
    this.Entity = class WorldEntity extends this.constructor.Entity {
      dirty = new Uint8Array(1 + (componentCount >> 3)).fill(0);
      diff() {
        let diff;
        let i = 0;
        let j = 1;
        let w = this.dirty[0];
        for (let k = 0; k < componentCount; ++k) {
          if (w & j) {
            const {componentName} = ComponentsById[k];
            if (this.has(componentName)) {
              const componentDiff = this[componentName][Diff]();
              if (!isObjectEmpty(componentDiff)) {
                if (!diff) {
                  diff = {};
                }
                diff[componentName] = componentDiff;
              }
            }
            else {
              if (!diff) {
                diff = {};
              }
              diff[componentName] = false;
            }
          }
          j <<= 1;
          if (256 === j) {
            j = 1;
            i += 1;
            w = this.dirty[i];
          }
        }
        return diff;
      }
      markClean() {
        for (const componentName of this.Components) {
          const {id} = WorldComponents[componentName];
          const i = id >> 3;
          const j = 1 << (id & 7);
          if (this.dirty[i] & j && this.has(componentName)) {
            this[componentName][MarkClean]();
          }
        }
        this.dirty.fill(0);
      }
      [MarkDirty](componentName) {
        const {id} = WorldComponents[componentName];
        const i = id >> 3;
        const j = 1 << (id & 7);
        this.dirty[i] |= j;
      }
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
    this.markClean();
  }

  create(components = {}) {
    return this.createSpecific(this.nextId(), components);
  }

  createSpecific(entityId, components) {
    const entity = new this.Entity(this, entityId);
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
    this.destroyed.push(entity.id);
  }

  diff() {
    const entries = [];
    for (const [entityId, entity] of this.entities) {
      if (entity) {
        const diff = entity.diff();
        if (diff) {
          entries.push([entityId, diff]);
        }
      }
    }
    for (const entityId of this.destroyed) {
      entries.push([entityId, false]);
    }
    return new Map(entries);
  }

  markClean() {
    for (const componentName in this.Components) {
      this.Components[componentName].pool.markClean();
    }
    this.destroyed.length = 0;
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
