export const registry = {};

export function register(componentName, Component) {
  registry[componentName] = class extends Component {
    static componentName = componentName;
  };
  // const {Storage} = registry[componentName];
  // registry[componentName].storage = new Storage(registry[componentName]);
}
