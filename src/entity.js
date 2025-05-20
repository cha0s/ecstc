import {OnInvalidate} from './property.js';

class Entity {

  $$Components = {};
  [OnInvalidate] = () => {};

  constructor(id) {
    this.id = id;
  }

  addComponent(Component, values = {}) {
    const {componentName} = Component;
    this.$$Components[componentName] = Component;
    const component = Component.storage.create(this.id);
    component[OnInvalidate] = () => {
      this[OnInvalidate](componentName);
    };
    const valuesWithDefaults = {...values};
    for (const key in this.constructor.properties) {
      if (!(key in valuesWithDefaults)) {
        valuesWithDefaults[key] = this.constructor.properties[key].defaultValue;
      }
    }
    component.set(valuesWithDefaults);
    this[Component.componentName] = component;
  }

  destroy() {
    const componentNames = [];
    for (const componentName in this.$$Components) {
      componentNames.push(componentName);
    }
    for (let i = componentNames.length - 1; i >= 0; --i) {
      this.removeComponent(this.$$Components[componentNames[i]]);
    }
  }

  diff() {
    const diff = {};
    for (const componentName in this.$$Components) {
      diff[componentName] = this.$$Components[componentName].storage.get(this.id).diff();
    }
    return diff;
  }

  has(componentName) {
    return componentName in this.$$Components;
  }

  removeComponent(Component) {
    delete this.$$Components[Component.componentName];
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
    for (const componentName in this.$$Components) {
      json[componentName] = this.$$Components[componentName].storage.get(this.id).toJSON();
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const json = {};
    for (const componentName in this.$$Components) {
      const component = this.$$Components[componentName].storage.get(this.id);
      const componentJson = component.toJSONWithoutDefaults(defaults?.[componentName]);
      let hasAnything = false;
      for (const i in componentJson) { // eslint-disable-line no-unused-vars
        hasAnything = true;
        break;
      }
      if (hasAnything) {
        json[componentName] = componentJson;
      }
    }
    return json;
  }
}

export default Entity;
