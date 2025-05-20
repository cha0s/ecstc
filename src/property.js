export const Diff = Symbol();
export const Dirty = Symbol();
export const MarkClean = Symbol();
export const MarkDirty = Symbol();
export const OnInvalidate = Symbol();
export const Parent = Symbol();

export default class Property {

  OnInvalidate = Symbol();
  Storage = Symbol();

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
    const {blueprint, OnInvalidate, Storage, key} = this;
    const {previous} = blueprint;
    return {
      [OnInvalidate]: {
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
            this[OnInvalidate](key);
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
