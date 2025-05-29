import { Codecs } from 'crunches';
import {isObjectEmpty} from '../object.js';
import {Diff, Dirty, MarkClean, MarkDirty, Parent, Property, ToJSON, ToJSONWithoutDefaults} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ObjectInstance {

  constructor() {
    const {invalidateKey, properties} = this.constructor.property;
    // let markDirtyCode = '';
    for (const key in properties) {
      const property = properties[key];
      const {blueprint: {i, j}} = property;
      this[property.onInvalidateKey] = () => {
        this[Dirty][i] |= j;
        this[Parent]?.[invalidateKey](key);
      };
      if (!property.constructor.isScalar && Parent in this[key]) {
        this[key][Parent] = this;
      }
      // if (!property.constructor.isScalar) {
      //   // console.log(property)
      //   markDirtyCode += `this['${key}'][MarkDirty]();\n`;
      //   // this[key][MarkDirty]();
      // }
    }

    // console.log(this.constructor.property.count)
    // for (const key in properties) {
    //   if (this[key][MarkDirty]) {
    //     this[key][MarkDirty]();
    //   }
    // }
    // console.trace(this[Parent], this[Dirty]);
    // for (let i = 0; i < Math.ceil(count / 32); ++i) {
    //   markDirtyCode += `this[Dirty][${i}] = ~0;\n`;
    //   // this[Dirty][i] = ~0;
    // }
    // // markDirtyCode += `for (let i = 0; i < this[Dirty].length; ++i) { this[Dirty][i] = ~0; }`;
    // const f = new Function('Dirty, MarkDirty', `return () => { ${markDirtyCode} }`);
    // this[MarkDirty] = f(Dirty, MarkDirty);
    // console.log(this[MarkDirty].toString());

  }

  [Diff]() {
    const {count, properties} = this.constructor.property;
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
    const {count, properties} = this.constructor.property;
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

  // [MarkDirty]() {
  //   const {properties} = this.constructor.property;
  //   // const keys = Object.keys(properties);
  //   for (const key in properties) {
  //     if (this[key][MarkDirty]) {
  //       this[key][MarkDirty]();
  //     }
  //   }
  //   for (let i = 0; i < this[Dirty].length; ++i) {
  //     this[Dirty][i] = ~0;
  //   }
  // }

  [ToJSON]() {
    const {properties} = this.constructor.property;
    const json = {};
    for (const key in properties) {
      json[key] = this[properties[key].toJSONKey]();
    }
    return json;
  }

  [ToJSONWithoutDefaults](defaults) {
    const {properties} = this.constructor.property;
    const json = {};
    for (const key in properties) {
      const propertyJson = this[properties[key].toJSONWithoutDefaultsKey](defaults?.[key]);
      if (undefined !== propertyJson) {
        json[key] = propertyJson;
      }
    }
    return isObjectEmpty(json) ? undefined : json;
  }

}

export class object extends Property {

  properties = {};
  static BaseInstance = ObjectInstance;

  constructor(key, fullBlueprint) {
    // extract storage; super shouldn't see it so we get a real object
    const {storage, ...blueprint} = fullBlueprint;
    super(key, blueprint);
    // allocate a codec for fixed-width
    if (this.constructor.width(blueprint) > 0) {
      this.codec = new Codecs.object(blueprint);
    }
    // build properties
    let count = 0;
    let offset = blueprint.offset ?? 0;
    const properties = {};
    let markDirtyCode = '';
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
            get(O, codec) { return storage.get(O, codec, offset); },
            set(O, codec, value) { storage.set(O, codec, value, offset); },
          }))(offset),
        },
      });
      if (!Property.isScalar) {
        markDirtyCode += `this['${propertyKey}'][MarkDirty]();\n`;
      }
      properties[propertyKey] = property;
      count += 1;
      offset += property.width;
    }
    for (let i = 0; i < 1 + (count >> 5); ++i) {
      markDirtyCode += `this[Dirty][${i}] = ~0;\n`;
    }
    this.count = count;
    this.properties = properties;
    const property = this;
    this.Instance = class extends this.constructor.BaseInstance {
      [Dirty] = new Uint32Array(1 + (count >> 5));
      [MarkDirty] = (new Function('Dirty, MarkDirty', `return function() { ${markDirtyCode} }`))(Dirty, MarkDirty);
      [Parent] = null;
      static property = property;
    };
    for (const key in properties) {
      properties[key].define(this.Instance.prototype);
    }
  }

  get defaultValue() {
    return new this.Instance();
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
      return this[key][ToJSON]();
    }
    definitions[toJSONWithoutDefaultsKey].value = function(defaults) {
      const json = this[key][ToJSONWithoutDefaults](defaults);
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

  static width(blueprint) {
    const widths = [];
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyKey, propertyBlueprint);
      widths.push(property.width);
    }
    return widths.some((width) => 0 === width) ? 0 : widths.reduce((l, r) => l + r, 0);
  }

}
