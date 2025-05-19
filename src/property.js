const Storage = Symbol('ecstc.property.storage');

export default class Property {

  constructor(key, blueprint) {
    this.blueprint = blueprint;
    this.key = key;
  }

  define(O) {
    return Object.defineProperties(O, this.definitions);
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  get definitions() {
    const {blueprint, key} = this;
    return {
      [Storage]: {
        enumerable: true,
        value: this.defaultValue,
        writable: true,
      },
      [key]: {
        get() { return this[Storage]; },
        set(value) {
          if (this[Storage] !== value) {
            blueprint.onChange?.(key, value);
            this[Storage] = value;
          }
        },
      },
    };
  }

}

