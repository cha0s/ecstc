export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Parent = Symbol('ecstc.property.parent');

export default class Property {

  constructor(key, blueprint) {
    this.blueprint = {
      onInvalidate: () => {},
      ...blueprint,
    };
    this.key = key;
    this.privateKey = this.mangleKey(key);
  }

  define(O, onInvalidate) {
    const {blueprint} = this;
    Object.defineProperty(O, this.privateKey, {
      value: {
        onInvalidate,
        previous: undefined,
        invalidate(key) {
          blueprint.onInvalidate?.(key);
          this.onInvalidate?.(key);
        },
        value: this.defaultValue,
      },
      writable: true,
    });
    Object.defineProperties(O, this.definitions());
    return O;
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  definitions() {
    const {
      blueprint,
      key,
      privateKey,
    } = this;
    const {previous} = blueprint;
    return {
      [key]: {
        get() { return this[privateKey].value; },
        set(value) {
          if (previous) {
            this[privateKey].previous = this[privateKey].value;
          }
          if (this[privateKey].value !== value) {
            this[privateKey].value = value;
            this[privateKey].invalidate(key);
          }
        },
      },
    };
  }

  static get isScalar() {
    return true;
  }

  mangleKey(key) {
    return `$$${key}`;
  }

}
