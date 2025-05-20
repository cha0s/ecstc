class Entity {
  $$Components = {};
  constructor(id) {
    this.id = id;
  }
  addComponent(Component, values = {}) {
    this.$$Components[Component.componentName] = Component;
    this[Component.componentName] = Component.storage.create(this.id, values);
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
  has(componentName) {
    return componentName in this.$$Components;
  }
  merge(change) {
    for (const componentName in change) {
      const values = change[componentName];
      for (const key in values) {
        if (
          'object' === typeof this[componentName][key]
          && 'merge' in this[componentName][key]
        ) {
          this[componentName][key].merge(values[key]);
        }
        else {
          this[componentName][key] = values[key];
        }
      }
    }
  }
  removeComponent(Component) {
    delete this.$$Components[Component.componentName];
    this[Component.componentName] = null;
    Component.storage.destroy(this.id);
  }
  save(defaults) {
    const json = {};
    for (const componentName in this.$$Components) {
      json[componentName] = this.$$Components[componentName].storage.get(this.id).save(defaults?.[componentName]);
    }
    return json;
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
      const Component = this.$$Components[componentName].storage.get(this.id);
      const componentJson = Component.toJSONWithoutDefaults(defaults?.[componentName]);
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
