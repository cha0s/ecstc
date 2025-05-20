export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Parent = Symbol('ecstc.property.parent');

export default class Property {

  [OnInvalidate] = Symbol('ecstc.propertyInstance.onInvalidate');
  Storage = Symbol('ecstc.propertyInstance.storage');

  constructor(key, blueprint) {
    this.blueprint = {
      onInvalidate: () => {},
      ...blueprint,
    };
    this.key = key;
  }

  define(O) {
    return Object.defineProperties(O, this.definitions);
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  get definitions() {
    const {blueprint, [OnInvalidate]: OnInvalidateLocal, Storage, key} = this;
    const {previous} = blueprint;
    return {
      [OnInvalidateLocal]: {
        writable: true,
        value: blueprint.onInvalidate,
      },
      [Storage]: {
        value: {
          ...previous && {
            previous: undefined,
          },
          value: this.defaultValue,
        },
      },
      [key]: {
        get() { return this[Storage].value; },
        set(value) {
          if (previous) {
            this[Storage].previous = this[Storage].value;
          }
          if (this[Storage].value !== value) {
            this[OnInvalidateLocal](key);
            this[Storage].value = value;
          }
        },
      },
    };
  }

  static get isScalar() {
    return true;
  }

}
