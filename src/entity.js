import {Diff, Set as ProperteaSet} from 'propertea';

class Entity {

  componentNames = new Set();
  // removed = new Set();
  world = null;

  constructor(world, id) {
    this.world = world;
    this.id = id;
  }

  addComponent(componentName, values) {
    this.world.setComponentDirty(this.index, componentName, 0);
    this.componentNames.add(componentName);
    const component = this.world.pool[componentName].allocate(values, (component) => {
      component.entity = this;
    });
    component.onInitialize();
    this[componentName] = component;
  }

  destroy() {
    this.world.destroy(this);
  }

  destroyComponents() {
    // destroy in reverse order as dependencies are added first and should be removed last
    for (const componentName of Array.from(this.componentNames).reverse()) {
      this.removeComponent(componentName);
    }
  }

  diff() {
    let diff;
    let o = this.world.dirty.width * this.index, i, j;
    for (const componentName in this.world.collection.components) {
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
        if (componentDiff) {
          diff ??= {};
          diff[componentName] = componentDiff;
        }
      }
    }
    return diff;
  }

  has(componentName) {
    return this.componentNames.has(componentName);
  }

  removeComponent(componentName) {
    this.world.setComponentDirty(this.index, componentName, 1);
    this.componentNames.delete(componentName);
    this[componentName].onDestroy();
    this[componentName].entity = null;
    this.world.pool[componentName].free(this[componentName]);
    this[componentName] = null;
  }

  set(change) {
    for (const componentName in change) {
      const values = change[componentName];
      if (false === values) {
        this.removeComponent(componentName);
      }
      else if (!this.componentNames.has(componentName)) {
        this.addComponent(componentName, values);
      }
      else {
        this[componentName][ProperteaSet](values);
      }
    }
  }

  toJSON() {
    const json = {};
    for (const componentName of this.componentNames) {
      json[componentName] = this[componentName].toJSON();
    }
    return json;
  }

  toJSONWithoutDefaults(defaults) {
    const json = {};
    for (const componentName of this.componentNames) {
      const propertyJson = this[componentName].toJSONWithoutDefaults(defaults?.[componentName]);
      if (propertyJson) {
        json[componentName] = propertyJson;
      }
    }
    return json;
  }
}

export default Entity;
