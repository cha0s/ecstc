import {Diff, Dirty, MarkClean, MarkDirty, Params, Parent, Property} from '../property.js';
import {PropertyRegistry} from '../register.js';

const Properties = Symbol();

class MapState extends Map {

  [Dirty] = new Set();
  [Params] = {};

  delete(key) {
    const O = this[Parent];
    Map.prototype.delete.call(this, key);
    this[Dirty].add(key);
    O[O[Parent].invalidateKey](key);
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

  // trampoline
  set(key, value) {
    const O = this[Parent];
    const {invalidateKey, mapValue} = this[Params];
    const Property = PropertyRegistry[mapValue.type];
    let set;
    if (Property.isScalar) {
      set = {
        value: function(key, value) {
          if (this.get(key) !== value) {
            Map.prototype.set.call(this, key, value);
            this[Dirty].add(key);
            O[invalidateKey](key);
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
          const property = new ElementProperty(id, mapValue);
          property.define(this);
          this[property.onInvalidateKey] = () => {
            this[Dirty].add(key);
            O[invalidateKey](key);
          };
          this[Properties].set(key, property);
          this[id] = value;
          if (this.get(key) !== this[id]) {
            this[id][MarkDirty]?.();
            Map.prototype.set.call(this, key, this[id]);
            this[property.invalidateKey](key);
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
    const state = new MapState();
    state[Params] = {mapValue: this.blueprint.value, invalidateKey: this.invalidateKey};
    Object.defineProperty(state, Properties, {value: new Map()});
    return state;
  }

  define(O) {
    super.define(O);
    O[Parent] = this;
    O[this.valueKey][Parent] = O;
    return O;
  }

  definitions() {
    const definitions = super.definitions();
    const {blueprint: {value}, toJSONKey, valueKey} = this;
    const Property = PropertyRegistry[value.type];
    definitions[this.key].set = function(M) {
      for (const entry of M[Symbol.iterator]()) {
        if (1 === entry.length) {
          this[valueKey].delete(entry[0]);
        }
        else {
          this[valueKey].set(entry[0], entry[1]);
        }
      }
    };
    definitions[toJSONKey].value = function() {
      const value = this[valueKey];
      if (Property.isScalar) {
        return Array.from(value.entries());
      }
      const json = [];
      for (const key of value.keys()) {
        const property = value[Properties].get(key);
        json.push([key, value[property.toJSONKey]()]);
      }
      return json;
    }
    return definitions;
  }

  static get isScalar() {
    return false;
  }

}
