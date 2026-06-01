import { Diff, Set as ProperteaSet, ToJSON, ToJSONWithoutDefaults } from 'propertea'

import { type ComponentPool, OnDestroy, OnInitialize } from './component.ts'
import { WorldDirtyBit, type EntityDiff } from './types.ts';
import { type World } from './world.ts'

export class Entity<
  W extends World<any, any>,
> {

  id: number = 0
  index: number = 0
  world: W

  constructor(world: W) {
    this.world = world
  }

  addComponent<
    K extends keyof W['_CC']
  >(
    componentName: K,
    values: Parameters<ComponentPool<W, W['_CC'], K>['allocate']>[0] = {} as any
  ): this & { [P in K]: ReturnType<ComponentPool<W, W['_CC'], K>['allocate']> } {
    const {world} = this;
    const component = world.pools[componentName].allocate(values, (component) => {
      component.entity = this;
    });
    Object.defineProperty(this, componentName, { value: component, writable: true });
    component[OnInitialize]();
    // set flags
    world.setComponentDirty(this.index, componentName, WorldDirtyBit.CHANGED);
    world.addComponentFlag(this.index, componentName);
    return this as any
  }

  destroyComponents(): Omit<this, keyof W['_CC']> {
    const {world} = this;
    let bit = (this.index + 1) * world.componentCollection.componentNames.length - 1;
    for (let k = world.componentCollection.componentNames.length - 1; k >= 0; --k) {
      if (world.components.view[bit >> 3] & (1 << (bit & 7))) {
        this.removeComponent(world.componentCollection.componentNames[k]);
      }
      bit -= 1;
    }
    return this
  }

  diff() {
    let diff: Record<string, any> | undefined;
    let bit = this.world.dirty.width.value * this.index;
    const { factories } = this.world.componentCollection
    for (const componentName in factories) {
      const factory = factories[componentName];
      const wasAdded = this.world.dirty.view[bit >> 3] & (1 << (bit & 7));
      bit += 1;
      const wasRemoved = this.world.dirty.view[bit >> 3] & (1 << (bit & 7));
      bit += 1;
      if (wasRemoved) {
        diff ??= {};
        diff[componentName] = false;
      }
      else if (wasAdded) {
        const componentDiff = (this as Record<string, any>)[componentName][Diff]();
        if (factory.isEmpty || componentDiff) {
          diff ??= {};
          diff[componentName] = componentDiff ?? {};
        }
      }
    }
    return diff;
  }

  has<
    K extends keyof W['_CC'],
    E extends this,
  >(
    componentName: K,
  ): this is (
    & this
    & { [P in K]: ReturnType<ComponentPool<W, W['_CC'], K>['allocate']> & { entity: E } }
  )
  {
    const {world} = this;
    const {componentNames, factories} = world.componentCollection;
    const bit = this.index * componentNames.length + factories[componentName].id;
    return !!(world.components.view[bit >> 3] & (1 << (bit & 7)));
  }

  removeComponent<
    K extends keyof W['_CC']
  >(componentName: K): Omit<this, K> {
    const {world} = this;
    if (this.has(componentName)) {
      const component = this[componentName]
      component[OnDestroy]();
      component.entity = null as any;
      world.pools[componentName].free(this[componentName]);
      this[componentName] = null as any;
      // set flags
      world.setComponentDirty(this.index, componentName, WorldDirtyBit.REMOVED);
      world.removeComponentFlag(this.index, componentName);
    }
    return this
  }

  set<
    K extends keyof W['_CC']
  >(change: EntityDiff<K>) {
    for (const componentName in change) {
      const values = change[componentName];
      if (false === values) {
        this.removeComponent(componentName);
      }
      else if (!this.has(componentName)) {
        this.addComponent(componentName, values as any);
      }
      else {
        (this as Record<string, any>)[componentName][ProperteaSet](values);
      }
    }
  }

  toJSON() {
    const {world} = this;
    const json: Record<string, any> = {} as any;
    let bit = this.index * world.componentCollection.componentNames.length;
    for (let k = 0; k < world.componentCollection.componentNames.length; ++k) {
      const i = bit >> 3;
      const j = 1 << (bit & 7);
      if (world.components.view[i] & j) {
        const componentName = world.componentCollection.componentNames[k] as string;
        json[componentName] =
          (this as Record<string, any>)[componentName][ToJSON]();
      }
      bit += 1;
    }
    return json;
  }

  toJSONWithoutDefaults<
    K extends keyof W['_CC']
  >(defaults: Record<K, any>) {
    const {world} = this;
    const json: Record<K, any> = {} as any;
    let bit = this.index * world.componentCollection.componentNames.length;
    for (let k = 0; k < world.componentCollection.componentNames.length; ++k) {
      const i = bit >> 3;
      const j = 1 << (bit & 7);
      if (world.components.view[i] & j) {
        const componentName = world.componentCollection.componentNames[k] as K;
        const propertyJson = (this as Record<K, any>)[componentName][ToJSONWithoutDefaults](defaults?.[componentName]);
        if (propertyJson) {
          json[componentName] = propertyJson;
        }
      }
      bit += 1;
    }
    return json;
  }

}

