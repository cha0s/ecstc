import Digraph from './digraph.js';
import {isObjectEmpty} from './object.js';
import Pool from './pool.js';
import {Diff} from './property.js';
import {PropertyRegistry} from './register.js';

export default class Component {

  static Concrete = null;
  static dependencies = [];
  entityId = 0;
  static Pool = Pool;

  // building a concrete component increases performance by sealing the object shape
  constructor() {
    if (!this.constructor.Concrete) {
      this.constructor.Concrete = this.constructor.concretize();
    }
    if (!this.constructor.concreteProperties) {
      return new this.constructor.Concrete();
    }
  }

  static concretize() {
    let count = 0;
    // concretize properties and precompute dirty flag offsets
    const concreteProperties = {};
    const {reservedProperties} = this;
    for (const key in this.properties) {
      if (reservedProperties.has(key)) {
        throw new SyntaxError(`${this.componentName} contains reserved property '${key}'`);
      }
      const blueprint = this.properties[key];
      concreteProperties[key] = new PropertyRegistry[blueprint.type](key, {
        ...blueprint,
        i: count >> 5,
        j: 1 << (count & 31),
      });
      count += 1;
    }
    class ConcreteComponent extends this {
      static concreteProperties = concreteProperties;
      static count = count;
      static name = `Concrete<${this.componentName}>`;
      dirty = new Uint32Array(1 + (count >> 5));
    }
    for (const key in concreteProperties) {
      concreteProperties[key].define(ConcreteComponent.prototype);
    }
    return ConcreteComponent;
  }

  destroy() {
    this.onDestroy();
    this.entityId = 0;
  }

  diff() {
    const {count, properties} = this.constructor;
    const diff = {};
    const keys = Object.keys(properties);
    let i = 0;
    let j = 1;
    for (let k = 0; k < count; ++k) {
      if (this.dirty[i] & j) {
        const key = keys[k];
        if (this[key][Diff]) {
          diff[key] = this[key][Diff]();
        }
        else {
          diff[key] = this[key];
        }
      }
      j <<= 1;
      if (0 === j) {
        j = 1;
        i += 1;
      }
    }
    return diff;
  }

  initialize(onInvalidate, values) {
    for (const key in this.constructor.concreteProperties) {
      const {blueprint: {i, j}, onInvalidateKey} = this.constructor.concreteProperties[key];
      this[onInvalidateKey] = (key) => {
        this.dirty[i] |= j;
        this.onChange(key);
        onInvalidate(key);
      };
    }
    this.set(values);
    this.onInitialize();
  }

  onChange() {}
  onDestroy() {}
  onInitialize() {}

  static get properties() {
    return {};
  }

  static get reservedProperties() {
    return new Set([
      'destroy', 'diff', 'initialize', 'set', 'toJSON', 'toJSONWithoutDefaults',
    ]);
  }

  set(values) {
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
      json[key] = 'object' === typeof this[key] && this[key].toJSON
        ? this[key].toJSON()
        : this[key];
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const json = {};
    for (const key in this.constructor.properties) {
      if (!this.constructor.concreteProperties[key].constructor.isScalar) {
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
        else if (this[key] !== this.constructor.concreteProperties[key].defaultValue) {
          json[key] = this[key];
        }
      }
    }
    return json;
  }

}
