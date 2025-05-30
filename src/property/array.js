import {Diff, Dirty, MarkClean, MarkDirty, Params, Parent, Property, ToJSON} from '../property.js';
import {PropertyRegistry} from '../register.js';

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

  [MarkDirty](dirtyKey) {
    dirtyKey = +dirtyKey;
    this[Dirty].add(dirtyKey);
    this[Parent]?.[MarkDirty]?.(this[Params].key);
  }

  push(value) {
    this.setAt(this.length, value);
  }

  // trampoline
  setAt(key, value) {
    const {element} = this[Params];
    const Property = PropertyRegistry[element.type];
    let setAt;
    if (Property.isScalar) {
      setAt = function(key, value) {
        if (this[key] !== value) {
          this[key] = value;
          this[MarkDirty](key);
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
          const property = new ElementProperty(element, key);
          Object.defineProperties(this, property.definitions());
          this[key][Parent] = this;
          this[key] = value;
          this[MarkDirty](key);
        }
      };
    }
    Object.defineProperty(this, 'setAt', {value: setAt});
    this.setAt(key, value);
  }

  [ToJSON]() {
    const {element} = this[Params];
    const Property = PropertyRegistry[element.type];
    if (Property.isScalar) {
      return this;
    }
    const json = [];
    for (const key in this) {
      json[key] = this[key][ToJSON]?.() ?? this[key];
    }
    return json;
  }

}

export class array extends Property {

  get defaultValue() {
    const state = new ArrayState();
    state[Params] = {
      element: this.blueprint.element,
      key: this.key,
    };
    return state;
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
          array[MarkDirty](i);
        }
      }
      else if (A[Symbol.iterator]) {
        array.length = 0;
        for (const element of A[Symbol.iterator]()) {
          array.push(element);
          array[MarkDirty](array.length - 1);
        }
      }
      else {
        const {deleted, ...indices} = A;
        for (const key in indices) {
          array[key] = indices[key];
          array[MarkDirty](key);
        }
        for (const key in deleted) {
          array.splice(key, 1);
          array[MarkDirty](key);
        }
      }
    }
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
