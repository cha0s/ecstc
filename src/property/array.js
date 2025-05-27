import {Diff, Dirty, MarkClean, MarkDirty, Params, Parent, Property} from '../property.js';
import {PropertyRegistry} from '../register.js';

const Properties = Symbol();

class ArrayState extends Array {

  [Dirty] = new Set();
  [Params] = {};

  [Diff]() {
    const diff = {};
    for (const key of this[Dirty]) {
      if (!(key in this)) {
        if (!diff.deleted) {
          diff.deleted = [];
        }
        diff.deleted.push(+key);
      }
      else {
        diff[key] = this[key][Diff] ? this[key][Diff]() : this[key];
      }
    }
    if (diff.deleted) {
      diff.deleted.sort((l, r) => r - l);
    }
    return diff;
  }

  [MarkClean]() {
    const keys = Object.keys(this);
    if (keys.length > 0) {
      if (this[keys[0]][MarkClean]) {
        for (const key of keys) {
          this[key][MarkClean]();
        }
      }
    }
    this[Dirty].clear();
  }

  [MarkDirty]() {
    if (this.length > 0) {
      const keys = Object.keys(this);
      if (this[keys[0]][MarkDirty]) {
        for (const key of keys) {
          this[key][MarkDirty]();
          this[Dirty].add(+key);
        }
      }
      else {
        for (const key of keys) {
          this[Dirty].add(+key);
        }
      }
    }
  }

  push(value) {
    this.setAt(this.length, value);
  }

  // trampoline
  setAt(key, value) {
    const {element, invalidateKey, propertyKey} = this[Params];
    const Property = PropertyRegistry[element.type];
    let setAt;
    if (Property.isScalar) {
      setAt = function(key, value) {
        const O = this[Parent];
        if (this[key] !== value) {
          this[key] = value;
          this[Dirty].add(key);
          O[invalidateKey](key);
        }
      };
    }
    else {
      class ElementProperty extends Property {
        define(O, onInvalidate) {
          super.define(O, onInvalidate);
          O[propertyKey] = this;
        }
        definitions() {
          const definitions = super.definitions();
          definitions[this.key].configurable = true;
          definitions[this.key].enumerable = true;
          return definitions;
        }
      }
      setAt = function(key, value) {
        if (this[key] !== value) {
          const O = this[Parent];
          const property = new ElementProperty(key, element);
          property.define(this, () => {
            this[Dirty].add(key);
            O[invalidateKey](key);
          });
          this[Properties][key] = property;
          this[key] = value;
          this[key][MarkDirty]?.();
          this[property.invalidateKey](key);
        }
      };
    }
    Object.defineProperty(this, 'setAt', {value: setAt});
    this.setAt(key, value);
  }

}

export class array extends Property {

  get defaultValue() {
    const state = new ArrayState();
    state[Params] = {
      element: this.blueprint.element,
      invalidateKey: this.invalidateKey,
      propertyKey: Symbol('property'),
    };
    Object.defineProperty(state, Properties, {value: {}});
    return state;
  }

  define(O, onInvalidate) {
    super.define(O, onInvalidate);
    O[Parent] = this;
    O[this.valueKey][Parent] = O;
    return O;
  }

  definitions() {
    const definitions = super.definitions();
    const {blueprint: {element}, toJSONKey, valueKey} = this;
    const Property = PropertyRegistry[element.type];
    definitions[this.key].set = function(A) {
      if (A instanceof Array) {
        this[valueKey].length = 0;
        for (let i = 0; i < A.length; ++i) {
          this[valueKey].setAt(i, A[i]);
        }
        this[valueKey][MarkDirty]();
      }
      else if (A[Symbol.iterator]) {
        this[valueKey].length = 0;
        for (const element of A[Symbol.iterator]()) {
          this[valueKey].push(element);
        }
        this[valueKey][MarkDirty]();
      }
      else {
        const {deleted, ...indices} = A;
        for (const key in indices) {
          this[valueKey][Dirty].add(key);
          this[valueKey][key] = indices[key];
        }
        for (const key in deleted) {
          this[valueKey][Dirty].add(key);
          this[valueKey].splice(key, 1);
        }
      }
    }
    definitions[toJSONKey].value = function() {
      const value = this[valueKey];
      if (Property.isScalar) {
        return value;
      }
      const json = [];
      for (const key in value) {
        const property = value[Properties][key];
        json[key] = value[property.toJSONKey]();
      }
      return json;
    }
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
