import Digraph from './digraph.js';

const ComputedComponents = Symbol('ComputedComponents');

export function createCollection(Components) {
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
  const dependencyMap = new Map();
  const dependencyTries = {[ComputedComponents]: new Set()};
  // reverse since we added in reverse order
  const sorted = dependencyGraph.sort().reverse();
  const componentNameSorter = (l, r) => {
    return sorted.indexOf(l) - sorted.indexOf(r);
  };
  for (const componentName of sorted) {
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
  let componentId = 0;
  const components = {};
  for (const componentName of sorted) {
    const Component = Components[componentName];
    const id = componentId;
    const CollectedComponent = class extends Component {
      static componentName = componentName;
      static id = id;
      static isEmpty = 0 === Object.keys(Component.properties).length;
    };
    components[componentName] = CollectedComponent;
    componentId += 1;
  }
  return {componentNames: Object.keys(components), components, resolve};
}

export class Component {

  static dependencies = [];

  /* v8 ignore next */
  static get properties() { return {}; }

  static proxy(Proxy) {
    return class extends Proxy {
      entity = null;
      onDestroy() {}
      onInitialize() {}
    };
  }

}
