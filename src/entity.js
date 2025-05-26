import {isObjectEmpty} from './object.js';
import {Diff, ToJSON, ToJSONWithoutDefaults} from './property.js';

class Entity {

  Components = new Set();
  dirty = {};
  onInvalidate = () => {};
  world = null;

  constructor(world, id, onInvalidate) {
    this.world = world;
    this.id = id;
    if (onInvalidate) {
      this.onInvalidate = onInvalidate;
    }
  }

  addComponent(componentName, values) {
    this.Components.add(componentName);
    const component = this.world.componentPool[componentName].allocate(this.id);
    this[componentName] = component;
    component.initialize(() => {
      this.dirty[componentName] = true;
      this.onInvalidate(componentName);
    }, values);
    this.onInvalidate(componentName);
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

  removeComponent(componentName) {
    this.onInvalidate(componentName);
    this.dirty[componentName] = true;
    this.Components.delete(componentName);
    this[componentName] = null;
    this.world.componentPool[componentName].free(this.id);
  }

  set(change) {
    for (const componentName in change) {
      const values = change[componentName];
      if (!(componentName in this.Components)) {
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
