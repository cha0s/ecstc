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
    const {blueprint: {storage}, key} = this;
    const property = this;
    const definitions = {};
    if (storage) {
      definitions[key] = {
        get() { return storage.get(this, property); },
        set(value) { storage.set(this, property, value); },
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
        set(value) { this[storageKey] = value; },
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
