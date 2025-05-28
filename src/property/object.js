import { Codecs } from 'crunches';
import {isObjectEmpty} from '../object.js';
import {Diff, Dirty, MarkClean, MarkDirty, Params, Parent, Property} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ObjectState {

  constructor(params) {
    const {count, properties} = params;
    Object.defineProperty(this, Dirty, {value: new Uint32Array(1 + (count >> 5))});
    Object.defineProperty(this, Params, {value: params});
    Object.defineProperty(this, Parent, {writable: true, value: null});
    for (const key in properties) {
      const property = properties[key];
      const {blueprint: {i, j}} = property;
      this[property.onInvalidateKey] = () => {
        this[Dirty][i] |= j;
        this[Parent][params.invalidateKey](key);
      };
      if (!property.constructor.isScalar && Parent in this[key]) {
        this[key][Parent] = this;
      }
    }
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

  properties = {};

  constructor(key, fullBlueprint) {
    // extract storage; super shouldn't see it so we get a real object
    const {storage, ...blueprint} = fullBlueprint;
    super(key, blueprint);
    // calculate width up front and allocate a codec for fixed-width
    const widths = [];
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyKey, propertyBlueprint);
      widths.push(property.width);
    }
    if (!widths.some((width) => 0 === width)) {
      this.codec = new Codecs.object(blueprint);
    }
    // build properties
    let count = 0;
    let offset = blueprint.offset ?? 0;
    const properties = {};
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyKey, {
        ...propertyBlueprint,
        // dirty flag offsets
        i: count >> 5,
        j: 1 << (count & 31),
        // delegate storage
        ...(storage && this.codec) && {
          offset,
          storage: ((offset) => ({
            get(codec) { return storage.get(codec, offset); },
            set(codec, value) { storage.set(codec, value, offset); },
          }))(offset),
        },
      });
      properties[propertyKey] = property;
      count += 1;
      offset += property.width;
    }
    this.count = count;
    this.properties = properties;
    this.ConcreteState = class extends ObjectState {};
    for (const key in properties) {
      properties[key].define(this.ConcreteState.prototype);
    }
  }

  get defaultValue() {
    return new this.ConcreteState({
      count: this.count,
      invalidateKey: this.invalidateKey,
      properties: this.properties,
    });
  }

  define(O) {
    super.define(O);
    O[this.key][Parent] = O;
    return O;
  }

  definitions() {
    const definitions = super.definitions();
    const {key, properties, toJSONKey, toJSONWithoutDefaultsKey} = this;
    definitions[key].set = function(O) {
      const object = this[key];
      for (const key in O) {
        if (key in properties) {
          object[key] = O[key];
        }
      }
    }
    definitions[toJSONKey].value = function() {
      const object = this[key];
      const json = {};
      for (const key in properties) {
        json[key] = object[properties[key].toJSONKey]();
      }
      return json;
    }
    definitions[toJSONWithoutDefaultsKey].value = function(defaults) {
      const object = this[key];
      const json = {};
      for (const key in properties) {
        const propertyJson = object[properties[key].toJSONWithoutDefaultsKey](defaults?.[key]);
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

  get width() {
    let width = 0;
    for (const key in this.properties) {
      width += this.properties[key].width;
    }
    return width;
  }

}
