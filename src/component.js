import Digraph from './digraph.js';
import {Diff, OnInvalidate} from './property.js';
import {PropertyRegistry} from './register.js';
import Storage from './storage.js';

export default class Component {

  static dependencies = [];
  entityId = 0;
  [OnInvalidate] = () => {};
  properties = {};
  static Storage = Storage;

  constructor() {
    let entries;
    [this.properties, entries] = this.constructor.cachedObjectProperties;
    for (const [key, property] of entries) {
      property.define(this, () => {
        this[OnInvalidate](key);
      });
    }
  }

  static get cachedObjectProperties() {
    if (!this.objectPropertiesCache) {
      const object = new PropertyRegistry.object('o', {
        properties: this.properties,
      });
      this.objectPropertiesCache = [object.properties, Object.entries(object.properties)];
    }
    return this.objectPropertiesCache;
  }

  destroy() {
    this.entityId = 0;
  }

  diff() {
    const diff = {};
    for (const key in this.constructor.properties) {
      if (this[key][Diff]) {
        diff[key] = this[key][Diff]();
      }
      else {
        diff[key] = this[key];
      }
    }
    return diff;
  }

  // get entity() {
  //   return Component.ecs.entities.get(this.entityId);
  // }

  static get properties() {
    return {};
  }

  set(values = {}) {
    for (const key in values) {
      if (key in this.constructor.properties) {
        this[key] = values[key];
      }
    }
    return this;
  }

  static sort(Components) {
    const dependencies = new Digraph();
    for (const componentName in Components) {
      dependencies.ensureTail(componentName);
      for (const dependency of Components[componentName].dependencies) {
        dependencies.addDependency(componentName, dependency);
      }
    }
    return dependencies.sort();
  }

  toJSON() {
    const json = {};
    for (const key in this.constructor.properties) {
      if ('object' === typeof this[key] && this[key].toJSON) {
        json[key] = this[key].toJSON();
      }
      else {
        json[key] = this[key];
      }
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const json = {};
    for (const key in this.constructor.properties) {
      if ('object' === typeof this[key]) {
        if ('toJSONWithoutDefaults' in this[key]) {
          const subdefaults = this[key].toJSONWithoutDefaults(defaults?.[key]);
          let hasAnything = false;
          for (const i in subdefaults) { // eslint-disable-line no-unused-vars
            hasAnything = true;
            break;
          }
          if (hasAnything) {
            json[key] = subdefaults;
          }
        }
        else if ('toJSON' in this[key]) {
          json[key] = this[key].toJSON();
        }
        else {
          json[key] = this[key];
        }
      }
      else {
        if (defaults && key in defaults) {
          if (this[key] !== defaults[key]) {
            json[key] = this[key];
          }
          continue;
        }
        if (this[key] === this.properties[key].defaultValue) {
          continue;
        }
        json[key] = this[key];
      }
    }
    return json;
  }

}
