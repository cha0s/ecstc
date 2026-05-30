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

interface ProperteaObjectComponentExtension<W> {
  entity: Entity<W> | null
  [OnDestroy](): void
  [OnInitialize](): void
}

export class ComponentFactory<
  P extends ProperteaObjectProps,
  Decorator extends object = {},
> {
  componentName: string
  id: number
  isEmpty: boolean
  proxyProperty: ProperteaObject<P, Decorator>

  constructor(
    componentName: string,
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
    ? ComponentFactory<P, E>
    : never
}

export const OnDestroy = Symbol('Ecstc.OnDestroy')
export const OnInitialize = Symbol('Ecstc.OnInitialize')

function identity<T>(t: T) { return t }

function createComponentCollection<
  T extends { [K in keyof T]: ComponentConfiguration<any, any> },
>(configuration: T) {
  const dependencyGraph = new Digraph();
  const factories = {} as FactoriesFromConfig<T>
  let componentId = 0
  for (const componentName in configuration) {
    dependencyGraph.ensureTail(componentName);
    for (const dependency of configuration[componentName].dependencies ?? []) {
      // adding in reverse order to make tree traversal more natural
      dependencyGraph.addDependency(dependency, componentName);
    }
    const { decorator, properties } = configuration[componentName];
    const proxyProperty = object(properties, (Component) => {
      return class extends (decorator ? decorator : identity)(Component) {
        entity: Entity<this> | null = null
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
  function resolve(componentNames: string[]) {
    let walk = dependencyTries;
    cacheMiss: {
      for (const componentName in componentNames) {
        if (!(componentName in walk)) {
          break cacheMiss;
        }
        walk = walk[componentName];
      }
      return walk[ComputedComponents];
    }
    walk = dependencyTries;
    const computed = new Set<string>(componentNames);
    for (const componentName of componentNames.sort(componentNameSorter)) {
      if (!(componentName in configuration)) {
        continue;
      }
      for (const dependency of dependencyMap.get(componentName)!) {
        computed.add(dependency);
      }
      if (!(componentName in walk)) {
        walk[componentName] = {[ComputedComponents]: new Set(computed)}
      }
      walk = walk[componentName];
    }
    return walk[ComputedComponents];
  }
  return {componentNames: Object.keys(configuration), configuration, factories, resolve};
}

type PoolsFromConfig<W, CC> = {
  [K in keyof CC]: ComponentPool<W, CC, K>
}

type ComponentProps<CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<infer P, any> ? P : never

type ComponentDecorator<W, CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<any, infer D> ? D & ProperteaObjectComponentExtension<W> : never

type ComponentPool<W, CC, K extends keyof CC> =
  Pool<ProperteaObject<ComponentProps<CC, K>, ComponentDecorator<W, CC, K>>, true>

class Entity<W> {
  id: number = 0
  index: number = 0
  world: W
  constructor(world: W) {
    this.world = world
  }
}

export class World<
  CC extends { [K in keyof CC]: ComponentConfiguration<any, any> },
  EntityDecorator extends object = {},
> {

  componentCollection: ReturnType<typeof createComponentCollection>
  components = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    width: 0,
    view: new Uint8Array(0),
  };
  entityInstances = [];
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
    this.componentCollection = createComponentCollection(components);
    const pools = {} as PoolsFromConfig<this, CC>
    for (const componentName in this.componentCollection.configuration) {
      const factory = this.componentCollection.factories[componentName];
      pools[componentName as keyof CC] = this.componentPool(factory) as any;
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

  componentPool<
    P extends ProperteaObjectProps,
    Decorator extends object = {},
  >(factory: ComponentFactory<P, Decorator & ProperteaObjectComponentExtension<this>>) {
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

  setComponentDirty(index: number, componentName: string, bit: number) {
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
const entity = new world.Entity(world)
const position = world.allocateComponent(entity, 'Position', {x: 35} )

type StrictNumber<T extends number> = 0 extends (1 & T) ? never : T
function test<T extends number>(t: StrictNumber<T>) { console.log(t) }
test(position.foo())
test(position.entity?.id!)
test(position.x)
test(entity.foo())
