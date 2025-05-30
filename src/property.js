export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Params = Symbol('ecstc.property.params');
export const Parent = Symbol('ecstc.property.parent');
export const ToJSON = Symbol('ecstc.property.toJSON');
export const ToJSONWithoutDefaults = Symbol('ecstc.property.toJSONWithoutDefaults');

export class Property {

  codec = null;

  constructor(key, blueprint = {}) {
    this.blueprint = blueprint;
    this.key = key;
    this.onInvalidateKey = Symbol(`onInvalidate(${key})`);
    this.invalidateKey = Symbol(`invalidate(${key})`);
    this.storageKey = Symbol(`storage(${key})`);
  }

  define(O) {
    return Object.defineProperties(O, this.definitions());
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  definitions() {
    const {
      blueprint,
      codec,
      invalidateKey,
      key,
      onInvalidateKey,
      storageKey,
    } = this;
    const {storage} = blueprint;
    return {
      [invalidateKey]: {
        configurable: true,
        value() {
          blueprint.onInvalidate?.(key);
          this[onInvalidateKey](key);
        },
      },
      [onInvalidateKey]: {
        configurable: true,
        value: () => {},
        writable: true,
      },
      [storageKey]: codec && storage
        ? {
          get() { return storage.get(this, codec); },
          set(value) { storage.set(this, codec, value); },
        }
        : {
          configurable: true,
          value: this.defaultValue,
          writable: true,
        },
      [key]: {
        get() { return this[storageKey]; },
        set(value) {
          if (this[storageKey] !== value) {
            this[storageKey] = value;
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

  get width() {
    return this.codec?.size() ?? 0;
  }

}
