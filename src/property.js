export const Diff = Symbol('ecstc.property.diff');
export const Dirty = Symbol('ecstc.property.dirty');
export const MarkClean = Symbol('ecstc.property.markClean');
export const MarkDirty = Symbol('ecstc.property.markDirty');
export const OnInvalidate = Symbol('ecstc.property.onInvalidate');
export const Parent = Symbol('ecstc.property.parent');

export default class Property {

  constructor(key, blueprint) {
    this.blueprint = blueprint;
    this.key = key;
    this.privateKey = Symbol(key);
  }

  define(O, onInvalidate) {
    Object.defineProperties(O, this.definitions());
    O[this.privateKey].onInvalidate = onInvalidate;
    return O;
  }

  get defaultValue() {
    return this.blueprint.defaultValue;
  }

  definitions() {
    if (!this.$$definitions) {
      const {blueprint, key, privateKey} = this;
      this.$$definitions = {
        [privateKey]: {
          value: {
            invalidate() {
              blueprint.onInvalidate?.(key);
              this.onInvalidate?.(key);
            },
            value: this.defaultValue,
          },
          writable: true,
        },
        [key]: {
          get() { return this[privateKey].value; },
          set(value) {
            if (this[privateKey].value !== value) {
              this[privateKey].value = value;
              this[privateKey].invalidate(key);
            }
          },
        },
      };
    }
    return this.$$definitions;
  }

  static get isScalar() {
    return true;
  }

  mangleKey(key) {
    return `$$${key}`;
  }

}
