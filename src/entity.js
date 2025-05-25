import {isObjectEmpty} from './object.js';

class Entity {

  Components = {};
  onInvalidate = () => {};

  constructor(id, onInvalidate) {
    this.id = id;
    this.onInvalidate = onInvalidate ?? (() => {});
  }

  addComponent(Component, values) {
    const {componentName} = Component;
    this.Components[componentName] = Component;
    const component = Component.storage.create(this.id);
    component.initialize(() => {
      this.onInvalidate(componentName);
    }, values);
    this.onInvalidate(componentName);
    this[componentName] = component;
  }

  destroy() {
    const componentNames = [];
    for (const componentName in this.Components) {
      componentNames.push(componentName);
    }
    for (let i = componentNames.length - 1; i >= 0; --i) {
      this.removeComponent(this.Components[componentNames[i]]);
    }
  }

  diff() {
    const diff = {};
    for (const componentName in this.Components) {
      diff[componentName] = this[componentName].diff();
    }
    return diff;
  }

  has(componentName) {
    return componentName in this.Components;
  }

  removeComponent(Component) {
    delete this.Components[Component.componentName];
    this[Component.componentName] = null;
    Component.storage.destroy(this.id);
  }

  set(change) {
    for (const componentName in change) {
      this[componentName].set(change[componentName]);
    }
  }

  toJSON() {
    const json = {};
    for (const componentName in this.Components) {
      json[componentName] = this[componentName].toJSON();
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const json = {};
    for (const componentName in this.Components) {
      const componentJson = this[componentName].toJSONWithoutDefaults(defaults?.[componentName]);
      if (!isObjectEmpty(componentJson)) {
        json[componentName] = componentJson;
      }
    }
    return json;
  }
}

export default Entity;
