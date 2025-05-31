import {Codecs} from 'crunches';
import {isObjectEmpty} from '../object.js';
import {Diff, Dirty, MarkClean, Property, ToJSON, ToJSONWithoutDefaults} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ObjectInstance {}

export class object extends Property {

  properties = {};
  static BaseInstance = ObjectInstance;

  constructor(fullBlueprint, key) {
    // extract storage; super shouldn't see it so we get a real object
    const {storage, ...blueprint} = fullBlueprint;
    super(blueprint, key);
    // allocate a codec for fixed-width
    const {codec} = this.constructor.compute(blueprint);
    this.codec = codec;
    // build properties
    let count = 0;
    let offset = blueprint.offset ?? 0;
    const properties = {};
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      class ObjectProperty extends PropertyRegistry[propertyBlueprint.type] {
        definitions() {
          const definitions = super.definitions();
          const {blueprint: {i, j}, key} = this;
          const {get, set} = definitions[key];
          definitions[key].set = function(value) {
            let doInvalidation = false
            if (get.call(this) !== value) {
              doInvalidation = true;
            }
            set.call(this, value);
            if (doInvalidation) {
              this[Dirty][i] |= j;
            }
          };
          return definitions;
        }
      }
      const property = new ObjectProperty({
        ...propertyBlueprint,
        // dirty flag offsets
        i: count >> 3,
        j: 1 << (count & 7),
        // delegate storage
        ...storage && {
          offset,
          storage: ((offset) => ({
            get(O, property) { return storage.get(O, property, offset); },
            set(O, property, value) { storage.set(O, property, value, offset); },
          }))(offset),
        },
      }, propertyKey);
      properties[propertyKey] = property;
      count += 1;
      offset += property.width;
    }
    this.count = count;
    this.properties = properties;
    const keys = Object.keys(properties);
    const property = this;
    this.Instance = (new Function(
      'BaseInstance, Dirty, properties, ToJSON, ToJSONWithoutDefaults, property, isObjectEmpty, MarkClean, Diff',
      `
        return class extends BaseInstance {
          [Dirty] = new Uint8Array(1 + (${count} >> 3)).fill(~0);
          static property = property;

          constructor(...args) {
            super(...args);
            ${
              Object.entries(properties)
                .map(([key]) => `this[properties['${key}'].storageKey] = properties['${key}'].defaultValue;`).join('\n')
            }
          }

          [Diff]() {
            const diff = {};
            ${(() => {
              const lines = [];
              let i = 0;
              let j = 1;
              for (let k = 0; k < count; ++k) {
                if (properties[keys[k]].constructor.isScalar) {
                  lines.push(`
                    if (this[Dirty][${i}] & ${j}) {
                      diff['${keys[k]}'] = this['${keys[k]}'];
                    }
                  `);
                }
                else {
                  lines.push(`
                    {
                      const subdiff = this['${keys[k]}'][Diff]();
                      if (!isObjectEmpty(subdiff)) {
                        diff['${keys[k]}'] = subdiff;
                      }
                    }
                  `);
                }
                j <<= 1;
                if (256 === j) {
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
              for (const key in properties) {
                if (!properties[key].constructor.isScalar) {
                  lines.push(`this['${key}'][MarkClean]();`)
                }
              }
              return lines.join('\n');
            })()}
            ${Array(1 + (count >> 3)).fill(0).map((n, i) => `this[Dirty][${i}] = 0;`).join('\n')}
          }
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
    ))(this.constructor.BaseInstance, Dirty, properties, ToJSON, ToJSONWithoutDefaults, property, isObjectEmpty, MarkClean, Diff);
    for (const key in properties) {
      Object.defineProperties(this.Instance.prototype, properties[key].definitions());
    }
  }

  static compute(blueprint) {
    let count = 0;
    const widths = [];
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyBlueprint, propertyKey);
      widths.push(property.width);
      count += 1;
    }
    const width = widths.some((width) => 0 === width) ? 0 : widths.reduce((l, r) => l + r, 0);
    let codec;
    if (width > 0) {
      codec = new Codecs.object(blueprint);
    }
    return {codec, count, width};
  }

  get defaultValue() {
    return new this.Instance();
  }

  definitions() {
    const definitions = super.definitions();
    const {key, properties} = this;
    definitions[key].set = function(O) {
      const object = this[key];
      for (const propertyKey in O) {
        if (propertyKey in properties) {
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
