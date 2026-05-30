import { type ComponentPool, OnInitialize } from './component.ts'
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

}

