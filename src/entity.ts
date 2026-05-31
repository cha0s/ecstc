import { type ComponentPool, OnDestroy, OnInitialize } from './component.ts'
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
    values: Parameters<ComponentPool<W, W['_CC'], K>['allocate']>[0]
  ): this & { [P in K]: ReturnType<ComponentPool<W, W['_CC'], K>['allocate']> } {
    const {world} = this;
    const component = world.pools[componentName].allocate(values, (component) => {
      component.entity = this;
    });
    component[OnInitialize]();
    Object.defineProperty(this, componentName, { value: component });
    // set flags
    world.setComponentDirty(this.index, componentName, 0);
    world.addComponentFlag(this.index, componentName);
    return this as any
  }

  destroyComponents() {
    const {world} = this;
    let bit = (this.index + 1) * world.componentCollection.componentNames.length - 1;
    for (let k = world.componentCollection.componentNames.length - 1; k >= 0; --k) {
      if (world.components.view[bit >> 3] & (1 << (bit & 7))) {
        this.removeComponent(world.componentCollection.componentNames[k]);
      }
      bit -= 1;
    }
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
      world.setComponentDirty(this.index, componentName, 1);
      world.removeComponentFlag(this.index, componentName);
    }
    return this
  }

}

