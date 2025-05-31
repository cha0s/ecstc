import {isObjectEmpty} from './object.js';
import {Diff, MarkClean, ToJSON, ToJSONWithoutDefaults} from './property.js';

class Entity {

  Components = new Set();
  removed = new Set();
  world = null;

  constructor(world, id) {
    this.world = world;
    this.id = id;
  }

  addComponent(componentName, values) {
    this.Components.add(componentName);
    this.removed.delete(componentName);
    const component = this.world.componentPool[componentName].allocate(values, this);
    this[componentName] = component;
  }

  destroy() {
    // destroy in reverse order as dependencies are added first and should be removed last
    for (const componentName of Array.from(this.Components).reverse()) {
      this.removeComponent(componentName);
    }
  }

  diff() {
    const diff = {};
    for (const componentName of this.Components) {
      const componentDiff = this[componentName][Diff]();
      if (!isObjectEmpty(componentDiff)) {
        diff[componentName] = componentDiff;
      }
    }
    for (const componentName of this.removed) {
      diff[componentName] = false;
    }
    return diff;
  }

  has(componentName) {
    return this.Components.has(componentName);
  }

  markClean() {
    for (const componentName of this.Components) {
      this[componentName][MarkClean]();
    }
    this.removed.clear();
  }

  removeComponent(componentName) {
    this.removed.add(componentName);
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
