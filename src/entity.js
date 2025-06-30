import {Diff, Set as ProperteaSet, ToJSON, ToJSONWithoutDefaults} from 'propertea';

class Entity {

  world = null;

  constructor(world, id) {
    this.world = world;
    this.id = id;
  }

  addComponent(componentName, values) {
    const {world} = this;
    world.setComponentDirty(this.index, componentName, 0);
    const o = this.index * world.collection.componentNames.length + world.collection.components[componentName].id;
    const i = o >> 3;
    const j = 1 << (o & 7);
    world.components.view[i] |= j;
    const component = world.pool[componentName].allocate(values, (component) => {
      component.entity = this;
    });
    component.onInitialize();
    this[componentName] = component;
  }

  destroyComponents() {
    const {world} = this;
    let o = (this.index + 1) * world.collection.componentNames.length - 1;
    for (let k = world.collection.componentNames.length - 1; k >= 0; --k) {
      const i = o >> 3;
      const j = 1 << (o & 7);
      if (world.components.view[i] & j) {
        this.removeComponent(world.collection.componentNames[k]);
      }
      o -= 1;
    }
  }

  diff() {
    let diff;
    let o = this.world.dirty.width.value * this.index, i, j;
    for (const componentName in this.world.collection.components) {
      const Component = this.world.collection.components[componentName];
      i = o >> 3;
      j = 1 << (o & 7);
      const wasAdded = this.world.dirty.view[i] & j;
      o += 1;
      i = o >> 3;
      j = 1 << (o & 7);
      const wasRemoved = this.world.dirty.view[i] & j;
      o += 1;
      i = o >> 3;
      j = 1 << (o & 7);
      const wasUpdated = this.world.dirty.view[i] & j;
      o += 1;
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
    const o = this.index * world.collection.componentNames.length + world.collection.components[componentName].id;
    const i = o >> 3;
    const j = 1 << (o & 7);
    return !!(world.components.view[i] & j);
  }

  removeComponent(componentName) {
    const {world} = this;
    world.setComponentDirty(this.index, componentName, 1);
    const o = this.index * world.collection.componentNames.length + world.collection.components[componentName].id;
    const i = o >> 3;
    const j = 1 << (o & 7);
    world.components.view[i] &= ~j;
    this[componentName].onDestroy();
    this[componentName].entity = null;
    world.pool[componentName].free(this[componentName]);
    this[componentName] = null;
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
    let o = this.index * world.collection.componentNames.length;
    for (let k = 0; k < world.collection.componentNames.length; ++k) {
      const i = o >> 3;
      const j = 1 << (o & 7);
      if (world.components.view[i] & j) {
        const componentName = world.collection.componentNames[k];
        json[componentName] = this[componentName][ToJSON]();
      }
      o += 1;
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const {world} = this;
    const json = {};
    let o = this.index * world.collection.componentNames.length;
    for (let k = 0; k < world.collection.componentNames.length; ++k) {
      const i = o >> 3;
      const j = 1 << (o & 7);
      if (world.components.view[i] & j) {
        const componentName = world.collection.componentNames[k];
        const propertyJson = this[componentName][ToJSONWithoutDefaults](defaults?.[componentName]);
        if (propertyJson) {
          json[componentName] = propertyJson;
        }
      }
      o += 1;
    }
    return json;
  }
}

export default Entity;
