export const registry = {};

export function register(name, Component) {
  registry[name] = class extends Component {
    static componentName = name;
  };
}
