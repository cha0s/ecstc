import {isObjectEmpty} from './object.js';
import {Diff, MarkClean, MarkDirty, ToJSON, ToJSONWithoutDefaults} from './property.js';

class Entity {

  Components = new Set();
  dirty = {};
  world = null;

  constructor(world, id) {
    this.world = world;
    this.id = id;
  }

  addComponent(componentName, values) {
    this.Components.add(componentName);
    const component = this.world.componentPool[componentName].allocate(values, this);
    this[componentName] = component;
    this[MarkDirty](componentName);
  }

  destroy() {
    // destroy in reverse order as dependencies are added first and should be removed last
    for (const componentName of Array.from(this.Components).reverse()) {
      this.removeComponent(componentName);
    }
  }

  diff() {
    const diff = {};
    for (const componentName in this.dirty) {
      if (this.has(componentName)) {
        const componentDiff = this[componentName][Diff]();
        if (!isObjectEmpty(componentDiff)) {
          diff[componentName] = componentDiff;
        }
      }
      else {
        diff[componentName] = false;
      }
    }
    return diff;
  }

  has(componentName) {
    return this.Components.has(componentName);
  }

  markClean() {
    for (const componentName in this.dirty) {
      if (this.has(componentName)) {
        this[componentName][MarkClean]();
      }
    }
    this.dirty = {};
  }

  [MarkDirty](componentName) {
    this.dirty[componentName] = true;
  }

  removeComponent(componentName) {
    this[MarkDirty](componentName);
    this.Components.delete(componentName);
    this.world.componentPool[componentName].free(this[componentName]);
    this[componentName] = null;
  }

  set(change) {
    for (const componentName in change) {
      const values = change[componentName];
      if (false === values) {
        this.removeComponent(componentName);
      }
      else if (!this.Components.has(componentName)) {
        this.addComponent(componentName, values);
      }
      else {
        this[componentName].set(values);
      }
    }
  }

  toJSON() {
    const json = {};
    for (const componentName of this.Components) {
      json[componentName] = this[componentName][ToJSON]();
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const json = {};
    for (const componentName of this.Components) {
      const propertyJson = this[componentName][ToJSONWithoutDefaults](defaults?.[componentName]);
      if (!isObjectEmpty(propertyJson)) {
        json[componentName] = propertyJson;
      }
    }
    return json;
  }
}

export default Entity;
