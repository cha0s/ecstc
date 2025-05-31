export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const Params = Symbol('ecstc.property.params');
export const Parent = Symbol('ecstc.property.parent');
export const ToJSON = Symbol('ecstc.property.toJSON');
export const ToJSONWithoutDefaults = Symbol('ecstc.property.toJSONWithoutDefaults');

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
        value: this.defaultValue,
        writable: true,
      };
      definitions[key] = {
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
