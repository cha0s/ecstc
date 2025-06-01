import {Diff, Dirty, MarkClean, Property, ToJSON} from '../property.js';
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

  push(value) {
    this.setAt(this.length, value);
  }

  // trampoline
  setAt(key, value) {
    const {element} = this.constructor;
    const Property = PropertyRegistry[element.type];
    let setAt;
    if (Property.isScalar) {
      setAt = function(key, value) {
        if (this[key] !== value) {
          this[key] = value;
          this[Dirty].add(+key);
        }
      };
    }
    else {
      setAt = function(key, value) {
        if (this[key] !== value) {
          new Property(
            {
              ...element,
              storage: {
                get: (O, property) => { return O[property.storageKey]; },
                set: (O, property, value) => {
                  O[property.storageKey] = value;
                  this[Dirty].add(key);
                },
              },
            },
            key,
          ).define(this);
          this[key] = value;
          this[Dirty].add(+key);
        }
      };
    }
    Object.defineProperty(this, 'setAt', {value: setAt});
    this.setAt(key, value);
  }

  [ToJSON]() {
    const {element} = this.constructor;
    const Property = PropertyRegistry[element.type];
    if (Property.isScalar) {
      return this;
    }
    const json = [];
    for (const key in this) {
      json[key] = this[key][ToJSON]();
    }
    return json;
  }

}

export class array extends Property {

  static ArrayState = ArrayState;

  constructor(blueprint, key) {
    super(blueprint, key);
    this.ArrayState = class extends this.constructor.ArrayState {
      static element = blueprint.element;
    };
  }

  get defaultValue() {
    return new this.ArrayState();
  }

  definitions() {
    const definitions = super.definitions();
    const {key} = this;
    definitions[key].set = function(A) {
      const array = this[key];
      if (A instanceof Array) {
        array.length = 0;
        for (let i = 0; i < A.length; ++i) {
          array.setAt(i, A[i]);
          array[Dirty].add(i);
        }
      }
      else if (A[Symbol.iterator]) {
        array.length = 0;
        for (const element of A[Symbol.iterator]()) {
          array.push(element);
          array[Dirty].add(array.length - 1);
        }
      }
      else {
        const {deleted, ...indices} = A;
        for (const key in indices) {
          array[key] = indices[key];
          array[Dirty].add(+key);
        }
        for (const key in deleted) {
          array.splice(key, 1);
          array[Dirty].add(+key);
        }
      }
    }
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
