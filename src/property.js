export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Params = Symbol('ecstc.property.params');
export const Parent = Symbol('ecstc.property.parent');
export const ToJSON = Symbol('ecstc.property.toJSON');
export const ToJSONWithoutDefaults = Symbol('ecstc.property.toJSONWithoutDefaults');

export class Property {

  constructor(key, blueprint) {
    this.blueprint = blueprint;
    this.key = key;
    this.onInvalidateKey = Symbol(`onInvalidate(${key})`);
    this.invalidateKey = Symbol(`invalidate(${key})`);
    this.toJSONKey = Symbol(`toJSON(${key})`);
    this.toJSONWithoutDefaultsKey = Symbol(`toJSONWithoutDefaults(${key})`);
    this.valueKey = Symbol(key);
  }

  define(O, onInvalidate) {
    Object.defineProperties(O, this.definitions());
    if (onInvalidate) {
      O[this.onInvalidateKey] = onInvalidate;
    }
    return O;
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  definitions() {
    const {
      blueprint,
      invalidateKey,
      key,
      onInvalidateKey,
      toJSONKey,
      toJSONWithoutDefaultsKey,
      valueKey,
    } = this;
    const property = this;
    return {
      [invalidateKey]: {
        configurable: true,
        value() {
          blueprint.onInvalidate?.(key);
          this[onInvalidateKey](key);
        },
      },
      [onInvalidateKey]: {
        configurable: true,
        value: () => {},
        writable: true,
      },
      [toJSONKey]: {
        value() {
          return this[valueKey];
        },
      },
      [toJSONWithoutDefaultsKey]: {
        value(defaults) {
          return (defaults ?? property.defaultValue) !== this[valueKey]
            ? this[valueKey]
            : undefined;
        }
      },
      [valueKey]: {
        configurable: true,
        value: this.defaultValue,
        writable: true,
      },
      [key]: {
        get() { return this[valueKey]; },
        set(value) {
          if (this[valueKey] !== value) {
            this[valueKey] = value;
            this[invalidateKey](key);
          }
        },
        configurable: true,
        enumerable: true,
      },
    };
  }

  static get isScalar() {
    return true;
  }

}
