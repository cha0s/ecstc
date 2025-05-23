import {isObjectEmpty} from './object.js';
import {OnInvalidate} from './property.js';

class Entity {

  $$Components = {};
  onInvalidate = () => {};

  constructor(id) {
    this.id = id;
  }

  addComponent(Component, values = {}) {
    const {componentName} = Component;
    this.$$Components[componentName] = Component;
    const component = Component.storage.create(this.id);
    // recursive invalidation
    component[OnInvalidate] = () => { this.onInvalidate(componentName); };
    // set component properties from values or defaults
    for (const key in component.constructor.properties) {
      component[key] = key in values ? values[key] : component.properties[key].defaultValue;
    }
    // if the component has no properties, invalidate manually
    if (isObjectEmpty(component.constructor.properties)) {
      component[OnInvalidate]();
    }
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
    // destroy
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
