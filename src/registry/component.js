export const registry = {};

export function register(name, Component) {
  registry[name] = Component.concretize(name);
}
