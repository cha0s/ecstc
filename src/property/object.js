import {Codecs} from 'crunches';
import {isObjectEmpty} from '../object.js';
import {Diff, Dirty, MarkClean, Property, ToJSON, ToJSONWithoutDefaults} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ObjectState {}

export class object extends Property {

  properties = {};
  static ObjectState = ObjectState;

  constructor(fullBlueprint, key) {
    // extract storage; super shouldn't see it so we get a real object
    const {storage, ...blueprint} = fullBlueprint;
    super(blueprint, key);
    // allocate a codec for fixed-width
    const {codec} = this.constructor.compute(blueprint);
    this.codec = codec;
    // build properties
    let count = 0;
    let {offset = 0} = blueprint;
    const properties = {};
    for (const propertyKey in blueprint.properties) {
      const propertyBlueprint = blueprint.properties[propertyKey];
      // dirty flag offsets
      const i = count >> 3;
      const j = 1 << (count & 7);
      // set dirty flags for property
      class ObjectProperty extends PropertyRegistry[propertyBlueprint.type] {
        definitions() {
          const definitions = super.definitions();
          const {get, set} = definitions[propertyKey];
          definitions[propertyKey].set = function(value) {
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
        // storage? compute offset
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
    const property = this;
    // generate optimized code
    const bound = {
      ObjectState: this.constructor.ObjectState,
      Diff,
      Dirty,
      isObjectEmpty,
      MarkClean,
      properties,
      ToJSON,
      ToJSONWithoutDefaults,
    };
    const GenSetProperty = (key) => `
      this[properties['${key}'].storageKey] = properties['${key}'].defaultValue;
    `;
    const GenDiff = () => {
      const lines = [];
      let i = 0;
      let j = 1;
      for (const key in properties) {
        if (properties[key].constructor.isScalar) {
          // scalar checks dirty flag
          lines.push(`if (this[Dirty][${i}] & ${j}) { diff['${key}'] = this['${key}']; }`);
        }
        else {
          // non-scalar delegates
          lines.push(`{
            const subdiff = this['${key}'][Diff]();
            if (!isObjectEmpty(subdiff)) { diff['${key}'] = subdiff; }
          }`);
        }
        j <<= 1;
        if (256 === j) {
          j = 1;
          i += 1;
        }
      }
      return lines.join('\n');
    };
    const GenMarkClean = () => {
      const lines = [];
      for (const key in properties) {
        if (!properties[key].constructor.isScalar) {
          lines.push(`this['${key}'][MarkClean]();`)
        }
      }
      return lines.join('\n');
    };
    const GenToJSON = () => {
      return Object.entries(properties).map(([key, {constructor: {isScalar}}]) => `
        json['${key}'] = this['${key}']${isScalar ? '' : '[ToJSON]()'}
      `).join('\n');
    };
    const GenToJSONWithoutDefaults = () => {
      return Object.entries(properties).map(([key, property]) => `{
        const propertyJson = ${
          property.constructor.isScalar
            ? `
              (defaults?.['${key}'] ?? properties['${key}'].defaultValue) !== this['${key}']
                ? this['${key}']
                : undefined
            `
            : `this['${key}'][ToJSONWithoutDefaults](defaults?.['${key}'])`
        };
        if (undefined !== propertyJson) { json['${key}'] = propertyJson; }
      }`).join('\n');
    }
    this.Instance = (new Function(
      Object.keys(bound).join(','),
      `
        return class extends ObjectState {

          [Dirty] = new Uint8Array(1 + (${count} >> 3)).fill(~0);

          constructor(...args) {
            super(...args);
            ${Object.keys(properties).map(GenSetProperty).join('\n')}
          }

          [Diff]() {
            const diff = {};
            ${GenDiff()}
            return diff;
          }

          [MarkClean]() {
            ${GenMarkClean()}
            ${Array(1 + (count >> 3)).fill(0).map((n, i) => `this[Dirty][${i}] = 0;`).join('\n')}
          }

          [ToJSON]() {
            const json = {};
            ${GenToJSON()}
            return json;
          }

          [ToJSONWithoutDefaults](defaults) {
            const json = {};
            ${GenToJSONWithoutDefaults()}
            return isObjectEmpty(json) ? undefined : json;
          }
        }
      `
    ))(...Object.values(bound));
    this.Instance.property = property;
    for (const key in properties) {
      Object.defineProperties(this.Instance.prototype, properties[key].definitions());
    }
  }

  static compute(blueprint) {
    let count = 0;
    const widths = [];
    for (const propertyKey in blueprint.properties) {
      const {type, ...propertyBlueprint} = blueprint.properties[propertyKey];
      widths.push(new PropertyRegistry[type](propertyBlueprint, propertyKey).width);
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
