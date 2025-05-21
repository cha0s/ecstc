import Property, {Diff, Dirty, MarkClean, MarkDirty, OnInvalidate, Parent, Storage} from '../property.js';
import {PropertyRegistry} from '../register.js';

class MapState extends Map {

  [Dirty] = new Set();

  delete(key) {
    const O = this[Parent];
    Map.prototype.delete.call(this, key);
    this[Dirty].add(key);
    O[O[Parent][OnInvalidate]](key);
  }

  [Diff]() {
    const diff = [];
    for (const key of this[Dirty]) {
      if (!this.has(key)) {
        diff.push([key]);
      }
      else {
        diff.push([key, this.get(key)[Diff] ? this.get(key)[Diff]() : this.get(key)]);
      }
    }
    return diff;
  }

  [MarkClean]() {
    const entries = Array.from(this);
    if (entries.length > 0) {
      if (entries[0][1][MarkClean]) {
        for (const entry of entries) {
          entry[1][MarkClean]();
        }
      }
    }
    this[Dirty].clear();
  }

  [MarkDirty]() {
    const entries = Array.from(this);
    if (entries.length > 0) {
      if (entries[0][1][MarkDirty]) {
        for (const entry of entries) {
          entry[1][MarkDirty]();
          this[Dirty].add(entry[0]);
        }
      }
      else {
        for (const entry of entries) {
          this[Dirty].add(entry[0]);
        }
      }
    }
  }

  toJSON() {
    const json = [];
    for (const [key, value] of this) {
      if ('object' === typeof value && 'toJSON' in value) {
        json.push([key, value.toJSON()]);
      }
      else {
        json.push([key, value]);
      }
    }
    return json;
  }

  // trampoline
  set(key, value) {
    const O = this[Parent];
    const {blueprint: {element}, [OnInvalidate]: OnInvalidateSymbol} = O[Parent];
    const Property = PropertyRegistry[element.type];
    let set;
    if (Property.isScalar) {
      set = {
        value: function(key, value) {
          if (this.get(key) !== value) {
            Map.prototype.set.call(this, key, value);
            this[Dirty].add(key);
            O[OnInvalidateSymbol](key);
          }
        },
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
      set = {
        value: function(key, value) {
          const id = Math.random();
          const property = new ElementProperty(id, element);
          property.define(this);
          this[property[Storage]].onInvalidate = () => {
            this[Dirty].add(key);
            O[OnInvalidateSymbol](key);
          };
          this[id] = value;
          if (this.get(key) !== this[id]) {
            this[id][MarkDirty]?.();
            Map.prototype.set.call(this, key, this[id]);
            this[property[OnInvalidate]](key);
          }
        },
      };
    }
    Object.defineProperty(this, 'set', set);
    this.set(key, value);
  }

}

export class map extends Property {

  get defaultValue() {
    return new MapState();
  }

  define(O) {
    super.define(O);
    O[Parent] = this;
    O[this[Storage]].value[Parent] = O;
    return O;
  }

  definitions() {
    const definitions = super.definitions();
    const {value} = definitions[this[Storage]].value;
    definitions[this[Storage]] = {
      value: Object.defineProperty({}, 'value', {
        get: () => value,
        set: (M) => {
          for (const entry of M[Symbol.iterator]()) {
            if (1 === entry.length) {
              value.delete(entry[0]);
            }
            else {
              value.set(entry[0], entry[1]);
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
