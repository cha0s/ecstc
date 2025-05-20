import Digraph from './digraph.js';
import {OnInvalidate} from './property.js';
import {PropertyRegistry} from './register.js';
import Storage from './storage.js';

const nop = () => {};

export default class Component {

  static Storage = Storage;

  static dependencies = [];

  constructor() {
    this.O = new PropertyRegistry.object('o', {
      properties: this.constructor.properties,
    });
    this[this.O.OnInvalidate] = nop;
    this.O.defineProperties(this, this);
  }

  entityId = 0;

  get [OnInvalidate]() {
    return this[this.O.OnInvalidate];
  }

  set [OnInvalidate](fn) {
    this[this.O.OnInvalidate] = fn;
  }

  // $$properties = {};
  // constructor() {
  //   this.$$properties.markChange = (change) => {
  //     this.markChange(change);
  //   }
  //   for (const key in constructor.properties) {
  //     const propertyBlueprint = constructor.properties[key];
  //     const Property = Properties[propertyBlueprint.type];
  //     Property.define(this.$$properties, key, propertyBlueprint);
  //     let descriptor = Object.getOwnPropertyDescriptor(this.constructor.prototype, key);
  //     if (!descriptor) {
  //       descriptor = Object.getOwnPropertyDescriptor(this.$$properties, key);
  //     }
  //     Object.defineProperty(this, key, descriptor);
  //   }
  // }
  destroy() {
    this.entityId = 0;
  }
  // get entity() {
  //   return Component.ecs.entities.get(this.entityId);
  // }
  set(entityId, values = {}) {
    this.entityId = entityId;
    for (const key in this.constructor.properties) {
      this[key] = key in values ? this[key] = values[key] : this.O.properties[key].defaultValue;
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
        if (this[key] === this.O.properties[key].defaultValue) {
          continue;
        }
        json[key] = this[key];
      }
    }
    return json;
  }

  static get properties() {
    return {};
  }

}
