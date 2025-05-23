import Property, {Diff, Dirty, MarkClean, MarkDirty, Parent} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ArrayState extends Array {

  [Dirty] = new Set();

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
    const O = this[Parent];
    const {blueprint: {element}, privateKey} = O[Parent];
    const Property = PropertyRegistry[element.type];
    let setAt;
    if (Property.isScalar) {
      setAt = function(key, value) {
        const O = this[Parent];
        if (this[key] !== value) {
          this[key] = value;
          this[Dirty].add(key);
          O[privateKey].invalidate(key);
        }
      };
    }
    else {
      class ElementProperty extends Property {
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
            O[privateKey].invalidate(key);
          });
          this[key] = value;
          this[key][MarkDirty]?.();
          this[property.privateKey].invalidate(key);
        }
      };
    }
    Object.defineProperty(this, 'setAt', {value: setAt});
    this.setAt(key, value);
  }

  toJSON() {
    const json = [];
    for (const key in this) {
      if ('object' === typeof this[key] && 'toJSON' in this[key]) {
        json[key] = this[key].toJSON();
      }
      else {
        json[key] = this[key];
      }
    }
    return json;
  }

}

export class array extends Property {

  get defaultValue() {
    return new ArrayState();
  }

  define(O, onInvalidate) {
    super.define(O, onInvalidate);
    O[Parent] = this;
    O[this.privateKey].value[Parent] = O;
    return O;
  }

  definitions() {
    const definitions = super.definitions();
    const {privateKey} = this;
    definitions[this.key].set = function(A) {
      if (A instanceof Array) {
        this[privateKey].value.length = 0;
        for (let i = 0; i < A.length; ++i) {
          this[privateKey].value.setAt(i, A[i]);
        }
        this[privateKey].value[MarkDirty]();
      }
      else if (A[Symbol.iterator]) {
        this[privateKey].value.length = 0;
        for (const element of A[Symbol.iterator]()) {
          this[privateKey].value.push(element);
        }
        this[privateKey].value[MarkDirty]();
      }
      else {
        const {deleted, ...indices} = A;
        for (const key in indices) {
          this[privateKey].value[Dirty].add(key);
          this[privateKey].value[key] = indices[key];
        }
        for (const key in deleted) {
          this[privateKey].value[Dirty].add(key);
          this[privateKey].value.splice(key, 1);
        }
      }
    }
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
