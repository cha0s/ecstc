export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const Parent = Symbol('ecstc.property.parent');

export default class Property {

  OnInvalidate = Symbol('ecstc.property.onInvalidate');
  Storage = Symbol('ecstc.property.storage');

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
    return {
      [OnInvalidate]: {
        writable: true,
        value: blueprint.onInvalidate,
      },
      [Storage]: {
        value: {
          previous: undefined,
          value: this.defaultValue,
        },
      },
      [key]: {
        get() { return this[Storage].value; },
        set(value) {
          if (this[Storage].value === value) {
            return;
          }
          this[OnInvalidate](key);
          this[Storage].previous = this[Storage].value;
          this[Storage].value = value;
        },
      },
    };
  }

  static get isScalar() {
    return true;
  }

}
