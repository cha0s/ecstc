import { Codecs } from 'crunches';
import {isObjectEmpty} from '../object.js';
import {Diff, Dirty, MarkClean, MarkDirty, Parent, Property, ToJSON, ToJSONWithoutDefaults} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ObjectInstance {}

export class object extends Property {

  properties = {};
  static BaseInstance = ObjectInstance;

  constructor(key, fullBlueprint) {
    // extract storage; super shouldn't see it so we get a real object
    const {storage, ...blueprint} = fullBlueprint;
    super(key, blueprint);
    // allocate a codec for fixed-width
    const {codec} = this.constructor.compute(blueprint);
    this.codec = codec;
    // build properties
    let count = 0;
    let offset = blueprint.offset ?? 0;
    const properties = {};
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      const Property = class extends PropertyRegistry[propertyBlueprint.type] {
        definitions() {
          const definitions = super.definitions();
          const {key, storageKey} = this;
          const {set} = definitions[key];
          definitions[key].set = function(value) {
            let doInvalidation = false
            if (this[storageKey] !== value) {
              doInvalidation = true;
            }
            set.call(this, value);
            if (doInvalidation) {
              this[MarkDirty](key);
            }
          };
          return definitions;
        }
      }
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
      properties[propertyKey] = property;
      count += 1;
      offset += property.width;
    }
    this.count = count;
    this.properties = properties;
    const keys = Object.keys(properties);
    const property = this;
    this.Instance = (new Function(
      'BaseInstance, Dirty, count, MarkDirty, properties, ToJSON, ToJSONWithoutDefaults, Parent, property, isObjectEmpty, MarkClean, Diff',
      `
        return class extends BaseInstance {
          [Dirty] = new Uint32Array(1 + (count >> 5)).fill(~0);
          static property = property;

          constructor(...args) {
            super(...args);
            ${
              Object.entries(properties)
                .filter(([, property]) => !property.constructor.isScalar)
                .map(([key]) => `this['${key}'][Parent] = this;`).join('\n')
            }
          }

          [Diff]() {
            const diff = {};
            ${(() => {
              const lines = [];
              let i = 0;
              let j = 1;
              for (let k = 0; k < count; ++k) {
                lines.push(`
                  if (this[Dirty][${i}] & ${j}) { diff['${keys[k]}'] = ${
                    !properties[keys[k]].constructor.isScalar
                      ? `this['${keys[k]}'][Diff]()`
                      : `this['${keys[k]}']`
                  }; }
                `);
                j <<= 1;
                if (0 === j) {
                  j = 1;
                  i += 1;
                }
              }
              return lines.join('\n');
            })()}
            return diff;
          }
          [MarkClean]() {
            ${(() => {
              const lines = [];
              let i = 0;
              let j = 1;
              for (let k = 0; k < count; ++k) {
                if (!properties[keys[k]].constructor.isScalar) {
                  lines.push(`if (this[Dirty][${i}] & ${j}) { this['${keys[k]}'][MarkClean](); }`)
                }
                j <<= 1;
                if (0 === j) {
                  j = 1;
                  i += 1;
                }
              }
              return lines.join('\n');
            })()}
            ${Array(1 + (count >> 5)).fill(0).map((n, i) => `this[Dirty][${i}] = 0;`).join('\n')}
          }
          [MarkDirty](dirtyKey) {
            const {blueprint: {i, j}} = properties[dirtyKey];
            this[Dirty][i] |= j;
            this[Parent]?.[MarkDirty]?.('${key}');
          }
          [Parent] = null;
          [ToJSON]() {
            const json = {};
            ${
              Object.entries(properties).map(([key, property]) => (
                property.constructor.isScalar
                  ? `json['${key}'] = this['${key}'];`
                  : `json['${key}'] = this['${key}'][ToJSON]();`
              )).join('\n')
            }
            return json;
          }
          [ToJSONWithoutDefaults](defaults) {
            const json = {};
            ${
              Object.entries(properties).map(([key, property], i) => (
                [
                  `const propertyJson${i} = ${
                    property.constructor.isScalar
                      ? `
                        (defaults?.['${key}'] ?? properties['${key}'].defaultValue) !== this['${key}']
                          ? this['${key}']
                          : undefined
                      `
                      : `this['${key}'][ToJSONWithoutDefaults](defaults?.['${key}'])`
                  };`,
                  `if (undefined !== propertyJson${i}) { json['${key}'] = propertyJson${i}; }`,
                ].join('\n')
              )).join('\n')
            }
            return isObjectEmpty(json) ? undefined : json;
          }
        }
      `
    ))(this.constructor.BaseInstance, Dirty, count, MarkDirty, properties, ToJSON, ToJSONWithoutDefaults, Parent, property, isObjectEmpty, MarkClean, Diff);
    for (const key in properties) {
      properties[key].define(this.Instance.prototype);
    }
  }

  static compute(blueprint) {
    let count = 0;
    const widths = [];
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyKey, propertyBlueprint);
      widths.push(property.width);
      count += 1;
    }
    const width = widths.some((width) => 0 === width) ? 0 : widths.reduce((l, r) => l + r, 0);
    let codec;
    if (width > 0) {
      codec = new Codecs.object(blueprint);
    }
    return {
      codec,
      count,
      width,
    };
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
    const {key, properties} = this;
    definitions[key].set = function(O) {
      const object = this[key];
      for (const propertyKey in O) {
        if (propertyKey in properties) {
          this[key][MarkDirty](propertyKey);
          object[propertyKey] = O[propertyKey];
        }
      }
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
