import Digraph from './digraph.js';
import Pool from './pool.js';
import {PropertyRegistry} from './register.js';

const ComputedComponents = Symbol();

export default class Component extends PropertyRegistry.object.BaseInstance {

  static componentName = 'Component';
  static dependencies = [];
  entity = null;
  static Pool = Pool;
  static property = null;

  destroy() {
    this.onDestroy();
    this.entity = null;
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
        if (!(componentName in Components)) {
          continue;
        }
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

  onDestroy() {}
  onInitialize() {}
  onInvalidate() {}

  /* v8 ignore next 3 */
  static get properties() {
    return {};
  }

  static get reservedProperties() {
    return new Set([
      'destroy', 'entity', 'initialize',
      'onDestroy', 'onInitialize', 'onInvalidate', 'set',
    ]);
  }

  set(values) {
    for (const key in values) {
      if (key in this.constructor.properties) {
        this[key] = values[key];
      }
    }
  }

}
