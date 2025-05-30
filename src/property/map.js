import {Diff, Dirty, MarkClean, MarkDirty, Params, Parent, Property, ToJSON} from '../property.js';
import {PropertyRegistry} from '../register.js';

const Ids = Symbol();

class MapState extends Map {

  [Dirty] = new Set();
  [Params] = {};

  delete(key) {
    Map.prototype.delete.call(this, key);
    this[Dirty].add(key);
    this[Parent]?.[MarkDirty]?.(this[Params].key);
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

  [MarkDirty](dirtyKey) {
    const {key, mapValue} = this[Params];
    const Property = PropertyRegistry[mapValue.type];
    if (!Property.isScalar) {
      dirtyKey = this[Ids].get(parseFloat(dirtyKey));
    }
    this[Dirty].add(dirtyKey);
    this[Parent]?.[MarkDirty]?.(key);
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
            this[MarkDirty](key);
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
          const property = new ElementProperty(mapValue, id);
          Object.defineProperties(this, property.definitions());
          this[Ids].set(id, key);
          this[id][Parent] = this;
          this[id] = value;
          if (this.get(key) !== this[id]) {
            Map.prototype.set.call(this, key, this[id]);
            this[MarkDirty]?.(`${id}`);
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
    Object.defineProperty(state, Ids, {value: new Map()});
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
