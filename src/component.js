import Digraph from './digraph.js';
import Pool from './pool.js';
import {
  Diff, Dirty, MarkClean, MarkDirty, Parent, ToJSON, ToJSONWithoutDefaults,
} from './property.js';
import {PropertyRegistry} from './register.js';

const ComputedComponents = Symbol();

export default class Component {

  static componentName = 'Component';
  static Concrete = null;
  static dependencies = [];
  entityId = 0;
  static Pool = Pool;

  // delegate to a concrete component
  // this seals the object shape and increases performance
  constructor() {
    if (!this.constructor.Concrete) {
      this.constructor.Concrete = this.constructor.concretize();
    }
    if (!this.constructor.concreteProperties) {
      return new this.constructor.Concrete();
    }
  }

  static concretize() {
    let count = 0;
    // concretize properties and precompute dirty flag offsets
    const concreteProperties = {};
    const {reservedProperties} = this;
    for (const key in this.properties) {
      if (reservedProperties.has(key)) {
        throw new SyntaxError(`${this.componentName} contains reserved property '${key}'`);
      }
      const blueprint = this.properties[key];
      concreteProperties[key] = new PropertyRegistry[blueprint.type](key, {
        ...blueprint,
        i: count >> 5,
        j: 1 << (count & 31),
      });
      count += 1;
    }
    class ConcreteComponent extends this {
      static concreteProperties = concreteProperties;
      static count = count;
      static name = `Concrete<${this.componentName}>`;
      [Dirty] = new Uint32Array(1 + (count >> 5));
      constructor() {
        super();
        for (const key in this.constructor.concreteProperties) {
          const concreteProperty = this.constructor.concreteProperties[key];
          const {blueprint: {i, j}, constructor: {isScalar}, onInvalidateKey} = concreteProperty;
          if (!isScalar && Parent in this[key]) {
            this[key][Parent] = this;
          }
          this[onInvalidateKey] = (key) => {
            this[Dirty][i] |= j;
            this.onInvalidate(key);
          };
        }
      }
    }
    for (const key in concreteProperties) {
      concreteProperties[key].define(ConcreteComponent.prototype);
    }
    return ConcreteComponent;
  }

  destroy() {
    this.onDestroy();
    this.entityId = 0;
  }

  [Diff]() {
    const {count, properties} = this.constructor;
    const diff = {};
    const keys = Object.keys(properties);
    let i = 0;
    let j = 1;
    for (let k = 0; k < count; ++k) {
      if (this[Dirty][i] & j) {
        const key = keys[k];
        if (this[key][Diff]) {
          diff[key] = this[key][Diff]();
        }
        else {
          diff[key] = this[key];
        }
      }
      j <<= 1;
      if (0 === j) {
        j = 1;
        i += 1;
      }
    }
    return diff;
  }

  initialize(onInvalidate, values) {
    for (const key in this.constructor.concreteProperties) {
      const {onInvalidateKey} = this.constructor.concreteProperties[key];
      const {[onInvalidateKey]: onInvalidatePrevious} = this;
      this[onInvalidateKey] = (key) => {
        onInvalidatePrevious(key);
        onInvalidate(key);
      };
    }
    this.set(values);
    this.onInitialize();
  }

  static instantiate(Components) {
    const dependencyGraph = new Digraph();
    for (const componentName in Components) {
      dependencyGraph.ensureTail(componentName);
      for (const dependency of Components[componentName].dependencies) {
        // adding in reverse order to make tree traversal more natural
        dependencyGraph.addDependency(dependency, componentName);
      }
    }
    function expandDependencies(componentName, computed = new Set()) {
      dependencyGraph.visit(componentName, (dependent) => { computed.add(dependent); });
      return Array.from(computed).reverse();
    }
    const componentPool = {};
    const dependencyMap = new Map();
    const dependencyTries = {[ComputedComponents]: new Set()};
    // reverse since we added in reverse order
    const sortedComponentNames = dependencyGraph.sort().reverse();
    const componentNameSorter = (l, r) => {
      return sortedComponentNames.indexOf(l) - sortedComponentNames.indexOf(r);
    };
    for (const componentName of sortedComponentNames) {
      const Component = Components[componentName];
      componentPool[componentName] = new Component.Pool(Component);
      dependencyMap.set(
        componentName,
        Array.from(expandDependencies(componentName)).sort(componentNameSorter),
      );
    }
    function resolve(components) {
      let walk = dependencyTries;
      cacheMiss: {
        for (const componentName in components) {
          if (!(componentName in walk)) {
            break cacheMiss;
          }
          walk = walk[componentName];
        }
        return walk[ComputedComponents];
      }
      const computed = new Set();
      walk = dependencyTries;
      for (const componentName of Object.keys(components).sort(componentNameSorter)) {
        for (const dependency of dependencyMap.get(componentName)) {
          computed.add(dependency);
        }
        if (!(componentName in walk)) {
          walk[componentName] = {[ComputedComponents]: new Set(computed)}
        }
        walk = walk[componentName];
      }
      return walk[ComputedComponents];
    }
    return {componentPool, resolve, sortedComponentNames};
  }

  [MarkClean]() {
    const {count, properties} = this.constructor;
    const keys = Object.keys(properties);
    let i = 0;
    let j = 1;
    for (let k = 0; k < count; ++k) {
      if (this[Dirty][i] & j) {
        const key = keys[k];
        if (this[key][Dirty]) {
          this[key][MarkClean]();
        }
      }
      j <<= 1;
      if (0 === j) {
        j = 1;
        i += 1;
      }
    }
    for (let i = 0; i < this[Dirty].length; ++i) {
      this[Dirty][i] = 0;
    }
  }

  [MarkDirty]() {
    const {properties} = this.constructor;
    const keys = Object.keys(properties);
    for (const key of keys) {
      if (this[key][MarkDirty]) {
        this[key][MarkDirty]();
      }
    }
    for (let i = 0; i < this[Dirty].length; ++i) {
      this[Dirty][i] = ~0;
    }
  }

  onDestroy() {}
  onInitialize() {}
  onInvalidate() {}

  /* v8 ignore next 3 */
  static get properties() {
    return {};
  }

  static get reservedProperties() {
    return new Set([
      'destroy', 'initialize',
      'onDestroy', 'onInitialize', 'onInvalidate', 'set',
    ]);
  }

  set(values) {
    for (const key in values) {
      if (key in this.constructor.properties) {
        this[key] = values[key];
      }
    }
    return this;
  }

  [ToJSON]() {
    const {concreteProperties} = this.constructor;
    const json = {};
    for (const key in concreteProperties) {
      json[key] = this[concreteProperties[key].toJSONKey]();
    }
    return json;
  }

  [ToJSONWithoutDefaults](defaults) {
    const {concreteProperties} = this.constructor;
    const json = {};
    for (const key in concreteProperties) {
      const propertyJson = this[concreteProperties[key].toJSONWithoutDefaultsKey](defaults?.[key]);
      if (undefined !== propertyJson) {
        json[key] = propertyJson;
      }
    }
    return json;
  }

}
