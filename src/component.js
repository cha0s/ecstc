import Digraph from './digraph.js';
import {isObjectEmpty} from './object.js';
import {Diff, OnInvalidate} from './property.js';
import {PropertyRegistry} from './register.js';
import Storage from './storage.js';

export default class Component {

  static dependencies = [];
  entityId = 0;
  [OnInvalidate] = () => {};
  properties = {};
  storage = null;
  static Storage = Storage;

  constructor() {
    const [properties, entries] = this.constructor.cachedProperties;
    this.properties = properties;
    for (const [key, property] of entries) {
      property.define(this, () => {
        this[OnInvalidate](key);
      });
    }
  }

  static get cachedProperties() {
    if (!this.propertiesCache) {
      const propertiesCache = [];
      for (const key in this.properties) {
        const {type, ...blueprint} = this.properties[key];
        const property = new PropertyRegistry[type](key, blueprint);
        propertiesCache[key] = property;
      }
      this.propertiesCache = [propertiesCache, Object.entries(propertiesCache)];
    }
    return this.propertiesCache;
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
      if (!this.properties[key].constructor.isScalar) {
        if ('toJSONWithoutDefaults' in this[key]) {
          const subdefaults = this[key].toJSONWithoutDefaults(defaults?.[key]);
          if (!isObjectEmpty(subdefaults)) {
            json[key] = subdefaults;
          }
        }
        else {
          json[key] = this[key].toJSON();
        }
      }
      else {
        if (defaults && key in defaults) {
          if (this[key] !== defaults[key]) {
            json[key] = this[key];
          }
        }
        else if (this[key] !== this.properties[key].defaultValue) {
          json[key] = this[key];
        }
      }
    }
    return json;
  }

}
