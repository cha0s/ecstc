import {Diff, Set as ProperteaSet, ToJSON, ToJSONWithoutDefaults} from 'propertea';

class Entity {

  world = null;

  constructor(world, id) {
    this.world = world;
    this.id = id;
  }

  addComponent(componentName, values) {
    const {world} = this;
    const component = world.pool[componentName].allocate(values, (component) => {
      component.entity = this;
    });
    component.onInitialize();
    this[componentName] = component;
    // set flags
    world.setComponentDirty(this.index, componentName, 0);
    world.addComponentFlag(this.index, componentName);
  }

  destroyComponents() {
    const {world} = this;
    let bit = (this.index + 1) * world.collection.componentNames.length - 1;
    for (let k = world.collection.componentNames.length - 1; k >= 0; --k) {
      if (world.components.view[bit >> 3] & (1 << (bit & 7))) {
        this.removeComponent(world.collection.componentNames[k]);
      }
      bit -= 1;
    }
  }

  diff() {
    let diff;
    let bit = this.world.dirty.width.value * this.index;
    for (const componentName in this.world.collection.components) {
      const Component = this.world.collection.components[componentName];
      const wasAdded = this.world.dirty.view[bit >> 3] & (1 << (bit & 7));
      bit += 1;
      const wasRemoved = this.world.dirty.view[bit >> 3] & (1 << (bit & 7));
      bit += 1;
      const wasUpdated = this.world.dirty.view[bit >> 3] & (1 << (bit & 7));
      bit += 1;
      if (wasRemoved) {
        diff ??= {};
        diff[componentName] = false;
      }
      else if (wasAdded || wasUpdated) {
        const componentDiff = this[componentName][Diff]();
        if (Component.isEmpty || componentDiff) {
          diff ??= {};
          diff[componentName] = componentDiff ?? {};
        }
      }
    }
    return diff;
  }

  has(componentName) {
    const {world} = this;
    const {componentNames, components} = world.collection;
    const bit = this.index * componentNames.length + components[componentName].id;
    return !!(world.components.view[bit >> 3] & (1 << (bit & 7)));
  }

  removeComponent(componentName) {
    const {world} = this;
    this[componentName].onDestroy();
    this[componentName].entity = null;
    world.pool[componentName].free(this[componentName]);
    this[componentName] = null;
    // set flags
    world.setComponentDirty(this.index, componentName, 1);
    world.removeComponentFlag(this.index, componentName);
  }

  set(change) {
    for (const componentName in change) {
      const values = change[componentName];
      if (false === values) {
        this.removeComponent(componentName);
      }
      else if (!this.has(componentName)) {
        this.addComponent(componentName, values);
      }
      else {
        this[componentName][ProperteaSet](values);
      }
    }
  }

  toJSON() {
    const {world} = this;
    const json = {};
    let bit = this.index * world.collection.componentNames.length;
    for (let k = 0; k < world.collection.componentNames.length; ++k) {
      const i = bit >> 3;
      const j = 1 << (bit & 7);
      if (world.components.view[i] & j) {
        const componentName = world.collection.componentNames[k];
        json[componentName] = this[componentName][ToJSON]();
      }
      bit += 1;
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const {world} = this;
    const json = {};
    let bit = this.index * world.collection.componentNames.length;
    for (let k = 0; k < world.collection.componentNames.length; ++k) {
      const i = bit >> 3;
      const j = 1 << (bit & 7);
      if (world.components.view[i] & j) {
        const componentName = world.collection.componentNames[k];
        const propertyJson = this[componentName][ToJSONWithoutDefaults](defaults?.[componentName]);
        if (propertyJson) {
          json[componentName] = propertyJson;
        }
      }
      bit += 1;
    }
    return json;
  }
}

export default Entity;
