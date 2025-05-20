export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Parent = Symbol('ecstc.property.parent');
export const Storage = Symbol('ecstc.property.storage');

export default class Property {

  [OnInvalidate] = Symbol('ecstc.propertyInstance.onInvalidate');
  [Storage] = Symbol('ecstc.propertyInstance.storage');

  constructor(key, blueprint) {
    this.blueprint = {
      onInvalidate: () => {},
      ...blueprint,
    };
    this.key = key;
  }

  define(O) {
    Object.defineProperties(O, this.definitions);
    return O;
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  get definitions() {
    const {blueprint, [OnInvalidate]: OnInvalidateLocal, [Storage]: StorageLocal, key} = this;
    const {previous} = blueprint;
    const validator = [blueprint.onInvalidate];
    validator.invoke = function(key) {
      for (let i = 0; i < this.length; ++i) {
        this[i]?.(key);
      }
    };
    return {
      [OnInvalidateLocal]: {
        value: validator,
      },
      [StorageLocal]: {
        value: {
          ...previous && {
            previous: undefined,
          },
          value: this.defaultValue,
        },
      },
      [key]: {
        get() { return this[StorageLocal].value; },
        set(value) {
          if (previous) {
            this[StorageLocal].previous = this[StorageLocal].value;
          }
          if (this[StorageLocal].value !== value) {
            this[OnInvalidateLocal].invoke(key);
            this[StorageLocal].value = value;
          }
        },
      },
    };
  }

  static get isScalar() {
    return true;
  }

}
