export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Parent = Symbol('ecstc.property.parent');

export default class Property {

  constructor(key, blueprint) {
    this.blueprint = blueprint;
    this.key = key;
    this.onInvalidateKey = Symbol(Math.random());
    this.invalidateKey = Symbol('invalidate');
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
    const {blueprint, invalidateKey, key, onInvalidateKey, valueKey} = this;
    return {
      [invalidateKey]: {
        configurable: true,
        enumerable: true,
        value() {
          blueprint.onInvalidate?.(key);
          this[onInvalidateKey](key);
        },
      },
      [onInvalidateKey]: {
        configurable: true,
        enumerable: true,
        value: () => {},
        writable: true,
      },
      [valueKey]: {
        configurable: true,
        enumerable: true,
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
