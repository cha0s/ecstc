import Property, {Diff, Dirty, MarkClean, MarkDirty, OnInvalidate, Parent} from '../property.js';
import {PropertyRegistry} from '../register.js';

class State {

  [Parent] = undefined;

  [Diff]() {
    const {count, properties} = this[Parent];
    const diff = {};
    const keys = Object.keys(properties);
    let i = 0;
    let j = 1;
    for (let k = 0; k < count; ++k) {
      if (this[Dirty][i] & j) {
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

  [MarkClean]() {
    const {count, properties} = this[Parent];
    const keys = Object.keys(properties);
    let i = 0;
    let j = 1;
    for (let k = 0; k < count; ++k) {
      if (this[Dirty][i] & j) {
        const key = keys[k];
        if (this[key][Dirty]) {
          this[key][MarkClean]();
        }
      }
      j <<= 1;
      if (0 === j) {
        j = 1;
        i += 1;
      }
    }
    for (let i = 0; i < this[Dirty].length; ++i) {
      this[Dirty][i] = 0;
    }
  }

  [MarkDirty]() {
    const {properties} = this[Parent];
    const keys = Object.keys(properties);
    for (const key of keys) {
      if (this[key][MarkDirty]) {
        this[key][MarkDirty]();
      }
    }
    for (let i = 0; i < this[Dirty].length; ++i) {
      this[Dirty][i] = ~0;
    }
  }

  toJSON() {
    const {properties} = this[Parent];
    const json = {};
    for (const key in properties) {
      if ('object' === typeof this[key] && 'toJSON' in this[key]) {
        json[key] = this[key].toJSON();
      }
      else {
        json[key] = this[key];
      }
    }
    return json;
  }

}

export class object extends Property {

  objectDefinition = {};
  properties = {};

  constructor(key, blueprint) {
    super(key, blueprint);
    const propertiesBlueprint = Object.entries(blueprint.properties);
    let count = 0;
    const properties = {};
    for (const [propertyKey, propertyBlueprint] of propertiesBlueprint) {
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyKey, {
        ...propertyBlueprint,
        i: count >> 5,
        j: 1 << (count & 31),
      });
      properties[propertyKey] = property;
      count += 1;
    }
    this.objectDefinition[Dirty] = {value: Array(1 + (count >> 5)).fill(0)};
    this.objectDefinition[Parent] = {value: this};
    this.count = count;
    this.properties = properties;
  }

  get defaultValue() {
    return new State();
  }

  define(O) {
    super.define(O);
    this.defineProperties(O[this.Storage].value, O);
    return O;
  }

  defineProperties(object, O) {
    Object.defineProperties(object, this.objectDefinition);
    for (const key in this.properties) {
      const property = this.properties[key];
      const {blueprint: {i, j}, [OnInvalidate]: OnInvalidateSymbol} = property;
      property.define(object);
      const {[OnInvalidateSymbol]: onInvalidate} = object;
      object[OnInvalidateSymbol] = () => {
        object[Dirty][i] |= j;
        onInvalidate(key);
        O[this[OnInvalidate]](key);
      };
    }
  }

  get definitions() {
    const definitions = super.definitions;
    const {value} = definitions[this.Storage].value;
    definitions[this.Storage] = {
      value: Object.defineProperty({}, 'value', {
        get: () => value,
        set: (O) => {
          for (const key in O) {
            if (key in this.properties) {
              value[key] = O[key];
            }
          }
        },
      }),
    };
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
