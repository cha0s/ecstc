export const Diff = Symbol('Diff');
export const Dirty = Symbol('Dirty');
export const MarkClean = Symbol('MarkClean');
export const ToJSON = Symbol('ToJSON');
export const ToJSONWithoutDefaults = Symbol('ToJSONWithoutDefaults');

export class Property {

  codec = null;
  storageKey = null;

  constructor(blueprint = {}, key = '') {
    this.blueprint = blueprint;
    this.key = key;
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  define(O = {}) {
    Object.defineProperties(O, this.definitions());
    O[this.storageKey] = this.defaultValue;
    return O;
  }

  definitions() {
    const {blueprint: {onChange, storage}, key} = this;
    const property = this;
    const definitions = {};
    if (storage) {
      definitions[key] = {
        get() { return storage.get(this, property); },
        ...onChange
          ? {
            set(value) {
              let doInvalidation = false
              if (storage.get(this, property) !== value) {
                doInvalidation = true;
              }
              storage.set(this, property, value);
              if (doInvalidation) {
                onChange(value, this, property);
              }
            },
          }
          : {
            set(value) { storage.set(this, property, value); },
          },
        enumerable: true,
      };
    }
    else {
      const storageKey = Symbol(`storage(${key})`);
      definitions[storageKey] = {
        value: undefined,
        writable: true,
      };
      definitions[key] = {
        configurable: true,
        get() { return this[storageKey]; },
        ...onChange
          ? {
            set(value) {
              let doInvalidation = false
              if (this[storageKey] !== value) {
                doInvalidation = true;
              }
              this[storageKey] = value;
              if (doInvalidation) {
                onChange(value, this, property);
              }
            },
          }
          : {
            set(value) { this[storageKey] = value; },
          },
        enumerable: true,
      };
      this.storageKey = storageKey;
    }
    return definitions;
  }

  static get isScalar() {
    return true;
  }

  get width() {
    return this.codec?.size() ?? 0;
  }

}
