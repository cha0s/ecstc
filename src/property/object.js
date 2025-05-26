import {isObjectEmpty} from '../object.js';
import Property, {Diff, Dirty, MarkClean, MarkDirty, Params, Parent} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ObjectState {

  constructor(params) {
    Object.defineProperty(this, Params, {value: params});
  }

  [Diff]() {
    const {count, properties} = this[Params];
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
    const {count, properties} = this[Params];
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
    const {properties} = this[Params];
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
    this.objectDefinition[Dirty] = {value: new Uint32Array(1 + (count >> 5))};
    this.count = count;
    this.properties = properties;
  }

  get defaultValue() {
    return new ObjectState({count: this.count, properties: this.properties});
  }

  define(O, onInvalidate) {
    super.define(O, onInvalidate);
    const object = Object.defineProperties(O[this.valueKey], this.objectDefinition);
    object[Parent] = O;
    for (const key in this.properties) {
      const property = this.properties[key];
      const {blueprint: {i, j}} = property;
      property.define(
        object,
        () => {
          object[Dirty][i] |= j;
          object[Parent][this.invalidateKey](key);
        },
      );
    }
    return O;
  }

  definitions() {
    const definitions = super.definitions();
    const {key, properties, toJSONKey, toJSONWithoutDefaultsKey, valueKey} = this;
    definitions[key].set = function(O) {
      for (const oKey in O) {
        if (oKey in properties) {
          this[valueKey][oKey] = O[oKey];
        }
      }
    }
    definitions[toJSONKey].value = function() {
      const value = this[valueKey];
      const json = {};
      for (const key in properties) {
        json[key] = value[properties[key].toJSONKey]();
      }
      return json;
    }
    definitions[toJSONWithoutDefaultsKey].value = function(defaults) {
      const value = this[valueKey];
      const json = {};
      for (const key in properties) {
        const propertyJson = value[properties[key].toJSONWithoutDefaultsKey](defaults?.[key]);
        if (undefined !== propertyJson) {
          json[key] = propertyJson;
        }
      }
      return isObjectEmpty(json) ? undefined : json;
    }
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
