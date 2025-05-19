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

}
