import Property, {Diff, Dirty, MarkClean, MarkDirty, Parent} from '../property.js';
import {PropertyRegistry} from '../register.js';

class ArrayState extends Array {

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
    const {blueprint: {element}, OnInvalidate, Storage} = this;
    const Property = PropertyRegistry[element.type];
    const definitions = {
      [Parent]: {
        value: this,
      },
      [Dirty]: {
        value: new Set(),
      },
    };
    if (Property.isScalar) {
      definitions.setAt = {
        value: function(key, value) {
          if (this[key] !== value) {
            this[key] = value;
            this[Dirty].add(key);
            O[OnInvalidate](key);
          }
        },
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
      definitions.setAt = {
        value: function(key, value) {
          const property = new ElementProperty(key, element);
          property.define(this);
          if (this[key] !== value) {
            this[key] = value;
            this[key][MarkDirty]?.();
            const {[property.OnInvalidate]: onInvalidate} = this;
            this[property.OnInvalidate] = () => {
              this[Dirty].add(key);
              onInvalidate(key);
              O[OnInvalidate](key);
            };
            this[property.OnInvalidate]();
          }
        },
      };
    }
    Object.defineProperties(O[Storage].value, definitions);
    return O;
  }

  get definitions() {
    const definitions = super.definitions;
    const {value} = definitions[this.Storage].value;
    definitions[this.Storage] = {
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
