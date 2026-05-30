import {
  object,
  type ProperteaObjectProps,
  type ProperteaObjectShape,
  type ProxyDecorator,
  int16,
  float32,
  Pool,
  ProperteaObject,
} from 'propertea'

import { Digraph } from './digraph.ts';

type ComponentConfiguration<
  P extends ProperteaObjectProps,
  Decorator extends object = {}
> = {
  decorator?: ProxyDecorator<ProperteaObjectShape<ProperteaObjectProps>, Decorator>;
  dependencies?: string[];
  properties: P;
}

function defineComponent<
  P extends ProperteaObjectProps,
  Decorator extends object = {}
>(definition: ComponentConfiguration<P, Decorator>) {
  return definition
}

interface DependencyTries {
  [ComputedComponents]: Set<string>
  [key: string]: DependencyTries
}

interface ProperteaObjectComponentExtension<W extends World<any, any>> {
  entity: Entity<W> | null
  [OnDestroy](): void
  [OnInitialize](): void
}

export class ComponentFactory<
  K,
  P extends ProperteaObjectProps,
  Decorator extends object = {},
> {
  componentName: K
  id: number
  isEmpty: boolean
  proxyProperty: ProperteaObject<P, Decorator>

  constructor(
    componentName: K,
    id: number,
    isEmpty: boolean,
    proxyProperty: ProperteaObject<P, Decorator>,
  ) {
      this.componentName = componentName
      this.id = id
      this.isEmpty = isEmpty
      this.proxyProperty = proxyProperty
  }
}

type FactoriesFromConfig<T> = {
  [K in keyof T]: T[K] extends ComponentConfiguration<infer P, infer E>
    ? ComponentFactory<K, P, E>
    : never
}

export const OnDestroy = Symbol('Ecstc.OnDestroy')
export const OnInitialize = Symbol('Ecstc.OnInitialize')

function identity<T>(t: T) { return t }

type PoolsFromConfig<W extends World<any, any>, CC> = {
  [K in keyof CC]: ComponentPool<W, CC, K>
}

type ComponentProps<CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<infer P, any> ? P : never

type ComponentDecorator<W extends World<any, any>, CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<any, infer D> ? D & ProperteaObjectComponentExtension<W> : never

type ComponentPool<W extends World<any, any>, CC, K extends keyof CC> =
  Pool<ProperteaObject<ComponentProps<CC, K>, ComponentDecorator<W, CC, K>>, true>

class Entity<
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
    // world.addComponentFlag(this.index, componentName);
    return this as any
  }

}

export class World<
  CC extends { [K in keyof CC]: ComponentConfiguration<any, any> },
  EntityDecorator extends object = {},
> {
  declare _CC: CC

  componentCollection: ReturnType<typeof this.createComponentCollection>
  components = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    width: 0,
    view: new Uint8Array(0),
  };
  entityInstances: (Entity<World<CC, EntityDecorator>> & EntityDecorator)[] = [];
  entities = new Map();
  freePool: (Entity<World<CC, EntityDecorator>> & EntityDecorator)[] = [];
  dirty = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    width: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
    view: new Uint8Array(0),
  };
  Entity: new (world: this) => Entity<World<CC, EntityDecorator>> & EntityDecorator
  pools: PoolsFromConfig<this, CC>

  constructor({
    components = {} as CC,
    // Systems = {},
    decorateEntity,
  }: {
    components: CC;
    decorateEntity?: (E: typeof Entity<World<CC, EntityDecorator>>) => typeof Entity<World<CC, EntityDecorator>> & EntityDecorator;
  } = {} as any) {
    this.componentCollection = this.createComponentCollection(components);
    const pools = {} as PoolsFromConfig<this, CC>
    for (const componentName in this.componentCollection.configuration) {
      const factory = this.componentCollection.factories[componentName];
      pools[componentName as keyof CC] = this.createComponentPool(factory) as any;
    }
    this.pools = pools;
    this.dirty.width.value = 2 * this.componentCollection.componentNames.length;
    // for (const systemName in System.sort(Systems)) {
    //   this.systems[systemName] = new Systems[systemName](this);
    // }
    const {entityInstances} = this;
    this.Entity = class extends (decorateEntity?.(Entity as any) ?? Entity as any) {
      constructor(world: World<CC, EntityDecorator>) {
        super(world)
        this.index = entityInstances.length;
      }
    } as unknown as typeof this['Entity']
    // this.diff = this.makeDiff();
  }

  static create<
    CC extends { [K in keyof CC]: ComponentConfiguration<any, any> },
    ED extends object = {},
  >({
    components = {} as CC,
    decorateEntity,
  }: {
    components: CC;
    decorateEntity?: (E: new (world: any) => Entity<any>) => new (world: any) => Entity<any> & ED;
  } = {} as any): World<CC, ED> {
    return new World({ components, decorateEntity: decorateEntity as any })
  }

  allocateComponent<K extends keyof CC>(
    entity: Entity<this>,
    componentName: K,
    value?: Parameters<ComponentPool<this, CC, K>['allocate']>[0],
  ): ReturnType<ComponentPool<this, CC, K>['allocate']> {
    const component = (
      this.pools[componentName] as unknown as ComponentPool<this, CC, K>
    ).allocate<ProperteaObjectComponentExtension<this>>(value, (component) => {
      component.entity = entity
    })
    return component as any
  }

  createComponentCollection(configuration: CC) {
    const dependencyGraph = new Digraph();
    const factories = {} as FactoriesFromConfig<CC>
    let componentId = 0
    for (const componentName in configuration) {
      dependencyGraph.ensureTail(componentName);
      for (const dependency of configuration[componentName].dependencies ?? []) {
        // adding in reverse order to make tree traversal more natural
        dependencyGraph.addDependency(dependency, componentName);
      }
      const { decorator, properties } = configuration[componentName];
      type InnerThis = typeof this
      const proxyProperty = object(properties, (Component) => {
        return class extends (decorator ? decorator : identity)(Component) {
          entity: Entity<InnerThis> | null = null
          ;[OnDestroy]() {}
          [OnInitialize]() {}
        }
      })
      factories[componentName] = new ComponentFactory(
        componentName,
        componentId,
        0 === Object.keys(properties).length,
        proxyProperty,
      ) as any
      componentId += 1;
    }
    function expandDependencies(componentName: string) {
      const computed = new Set<string>()
      dependencyGraph.visit(componentName, (dependent) => { computed.add(dependent); });
      return Array.from(computed).reverse();
    }
    const dependencyMap = new Map<string, string[]>();
    const dependencyTries: DependencyTries = {[ComputedComponents]: new Set()};
    // reverse since we added in reverse order
    const sorted = dependencyGraph.sort().reverse();
    const componentNameSorter = (l: string, r: string) => {
      return sorted.indexOf(l) - sorted.indexOf(r);
    };
    for (const componentName of sorted) {
      dependencyMap.set(
        componentName,
        expandDependencies(componentName).sort(componentNameSorter),
      );
    }
    function resolve(components: Partial<{ [K in keyof CC]: any }>) {
      let walk = dependencyTries;
      cacheMiss: {
        for (const componentName in components) {
          if (!(componentName in walk)) {
            break cacheMiss;
          }
          walk = walk[componentName];
        }
        return walk[ComputedComponents] as Set<keyof CC>;
      }
      walk = dependencyTries;
      const keys = Object.keys(components)
      const computed = new Set<string>(keys);
      for (const componentName of keys.sort(componentNameSorter)) {
        if (!(componentName in configuration)) {
          continue;
        }
        for (const dependency of dependencyMap.get(componentName)!) {
          computed.add(dependency);
        }
        if (!(componentName in walk)) {
          walk[componentName] = {[ComputedComponents]: computed}
        }
        walk = walk[componentName];
      }
      return walk[ComputedComponents] as unknown as Set<keyof CC>;
    }
    return {componentNames: Object.keys(configuration), configuration, factories, resolve};
  }

  createComponentPool<
    P extends ProperteaObjectProps,
    Decorator extends object = {},
  >(factory: ComponentFactory<keyof CC, P, any>) {
    class ComponentPool extends Pool<ProperteaObject<P, Decorator & ProperteaObjectComponentExtension<this>>, true> {
      wasmImports() {
        return {
          ...super.wasmImports(),
          id: new WebAssembly.Global({value: 'i32'}, factory.id)
        }
      }
    }
    const pool = new ComponentPool(factory.proxyProperty, {
      onDirty: (bit) => {
        const index = Math.floor(bit / width);
        if (index < pool.proxies.length) {
          const proxy = pool.proxies[index]
          if (proxy) {
            this.setComponentDirty(proxy.entity.index, factory.componentName, 0);
          }
        }
      },
    });
    const width = pool.property.dirtyByteWidth; // hoisted for use in `onDirty` above
    return pool;
  }

  createSpecificEntity(
    entityId: number,
    components: Partial<{ [K in keyof CC]: Parameters<ComponentPool<this, CC, K>['allocate']>[0] }>,
  ) {
    if (this.entities.size === this.dirty.nextGrow) {
      this.dirty.memory.grow(1);
      this.dirty.view = new Uint8Array(this.dirty.memory.buffer);
      this.dirty.nextGrow = Math.floor(this.dirty.memory.buffer.byteLength / (this.dirty.width.value / 8));
    }
    if (this.entities.size === this.components.nextGrow) {
      this.components.memory.grow(1);
      this.components.view = new Uint8Array(this.components.memory.buffer);
      this.components.nextGrow = Math.floor(this.components.memory.buffer.byteLength / (this.componentCollection.componentNames.length / 8));
    }
    let entity: Entity<World<CC, EntityDecorator>> & EntityDecorator;
    if (this.freePool.length > 0) {
      entity = this.freePool.pop()!;
      this.entityInstances[entity.index] = entity;
    }
    else {
      entity = new this.Entity(this);
      this.entityInstances.push(entity);
    }
    entity.id = entityId;
    this.entities.set(entityId, entity);
    for (const componentName of this.componentCollection.resolve(components)) {
      if (componentName in this.componentCollection.configuration) {
        entity.addComponent(componentName, components[componentName]);
      }
    }
    // this.reindex(entity);
    return entity as typeof entity & { [K in keyof CC]: ReturnType<ComponentPool<this, CC, K>['allocate']> }
  }

  setComponentDirty(index: number, componentName: keyof CC, bit: number) {
    const o = this.dirty.width.value * index + 2 * this.componentCollection.factories[componentName].id + bit;
    const i = o >> 3;
    const j = 1 << (o & 7);
    this.dirty.view[i] |= j;
  }

}

//
// ====================================
//

const ComputedComponents = Symbol('Ecstc.ComputedComponents');

const Position = defineComponent({
  decorator: (Component) => {
    return class Blah extends Component {
      foo() { return 1 }
    }
  },
  properties: {
    x: int16(),
    y: int16(),
  },
})

const Angle = defineComponent({
  dependencies: ['Position'],
  properties: {
    angle: float32(),
  }
})

const Tag = defineComponent({
  properties: {}
})

const componentsConfiguration = {
  Angle,
  Position,
  Tag,
}

const world = World.create({
  components: componentsConfiguration,
  decorateEntity: (Entity) => class extends Entity { foo() { return 42 }}
})
// const entity = new world.Entity(world)
// const entity = world.createSpecificEntity(1, {Position: {x: 35}})
const entity = world.createSpecificEntity(1, {})
  .addComponent('Position', {x: 35})

// const position = world.allocateComponent(entity, 'Position', {x: 35} )

type StrictNumber<T extends number> = 0 extends (1 & T) ? never : T
function test<T extends number>(t: StrictNumber<T>) { console.log(t) }
test(entity.Position.foo())
test(entity.Position.entity?.id!)
test(entity.Position.x)
test(entity.foo())
