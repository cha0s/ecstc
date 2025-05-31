import {Diff, Dirty, MarkClean, Params, Property, ToJSON} from '../property.js';
import {PropertyRegistry} from '../register.js';

const Ids = Symbol();

class MapState extends Map {

  [Dirty] = new Set();
  [Ids] = new Map();
  [Params] = {};

  delete(key) {
    Map.prototype.delete.call(this, key);
    this[Dirty].add(key);
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

  // trampoline
  set(key, value) {
    const {mapValue} = this[Params];
    const Property = PropertyRegistry[mapValue.type];
    let set;
    if (Property.isScalar) {
      set = {
        value: function(key, value) {
          if (this.get(key) !== value) {
            Map.prototype.set.call(this, key, value);
            this[Dirty].add(key);
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
          if (!this[Ids].has(key)) {
            const id = Math.random();
            new ElementProperty(
              {
                ...mapValue,
                storage: {
                  get: (O, property) => { return O[property.storageKey]; },
                  set: (O, property, value) => {
                    O[property.storageKey] = value;
                    this[Dirty].add(key);
                  },
                },
              },
              id,
            ).define(this);
            this[Ids].set(key, id);
          }
          const id = this[Ids].get(key);
          this[id] = value;
          if (this.get(key) !== this[id]) {
            Map.prototype.set.call(this, key, this[id]);
            this[Dirty].add(key);
          }
        },
      };
    }
    Object.defineProperty(this, 'set', set);
    this.set(key, value);
  }

  [ToJSON]() {
    const {mapValue} = this[Params];
    const Property = PropertyRegistry[mapValue.type];
    if (Property.isScalar) {
      return Array.from(this.entries());
    }
    const json = [];
    for (const key of this.keys()) {
      json.push([key, this.get(key)[ToJSON]()]);
    }
    return json;
  }

}

export class map extends Property {

  get defaultValue() {
    const state = new MapState();
    state[Params] = {
      key: this.key,
      mapValue: this.blueprint.value,
    };
    return state;
  }

  definitions() {
    const definitions = super.definitions();
    const {key} = this;
    definitions[this.key].set = function(M) {
      const map = this[key];
      for (const entry of M[Symbol.iterator]()) {
        if (1 === entry.length) {
          map.delete(entry[0]);
        }
        else {
          map.set(entry[0], entry[1]);
        }
      }
    };
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
