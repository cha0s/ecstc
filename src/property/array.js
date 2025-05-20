import Property, {Diff, Dirty, MarkClean, MarkDirty, OnInvalidate, Parent, Storage} from '../property.js';
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
    const keys = Object.keys(this);
    if (keys.length > 0) {
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
    const {blueprint: {element}, [OnInvalidate]: OnInvalidateSymbol} = O[Parent];
    const Property = PropertyRegistry[element.type];
    let setAt;
    if (Property.isScalar) {
      setAt = function(key, value) {
        const O = this[Parent];
        if (this[key] !== value) {
          this[key] = value;
          this[Dirty].add(key);
          O[OnInvalidateSymbol](key);
        }
      };
    }
    else {
      class ElementProperty extends Property {
        get definitions() {
          const definitions = super.definitions;
          definitions[this.key].configurable = true;
          definitions[this.key].enumerable = true;
          return definitions;
        }
      }
      setAt = function(key, value) {
        const O = this[Parent];
        const property = new ElementProperty(key, element);
        property.define(this);
        if (this[key] !== value) {
          this[key] = value;
          this[key][MarkDirty]?.();
          const {[property[OnInvalidate]]: onInvalidate} = this;
          this[property[OnInvalidate]] = () => {
            this[Dirty].add(key);
            onInvalidate(key);
            O[OnInvalidateSymbol](key);
          };
          this[property[OnInvalidate]]();
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

  define(O) {
    super.define(O);
    O[Parent] = this;
    O[this[Storage]].value[Parent] = O;
    return O;
  }

  get definitions() {
    const definitions = super.definitions;
    const {value} = definitions[this[Storage]].value;
    definitions[this[Storage]] = {
      value: Object.defineProperty({}, 'value', {
        get: () => value,
        set: (A) => {
          if (A instanceof Array) {
            value.length = 0;
            for (let i = 0; i < A.length; ++i) {
              value.setAt(i, A[i]);
            }
            value[MarkDirty]();
          }
          else if (A[Symbol.iterator]) {
            value.length = 0;
            for (const element of A[Symbol.iterator]()) {
              value.push(element);
            }
            value[MarkDirty]();
          }
          else {
            const {deleted, ...indices} = A;
            for (const key in indices) {
              value[Dirty].add(key);
              value[key] = indices[key];
            }
            for (const key in deleted) {
              value[Dirty].add(key);
              value.splice(key, 1);
            }
          }
        },
      }),
    };
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
