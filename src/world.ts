import {
  Diff,
  // @ts-expect-error - needed for build?
  Index,
  object,
  type ProperteaObjectProps,
  Pool,
  ProperteaObject,
  type ProperteaObjectShape,
} from 'propertea'

import {
  type ComponentConfiguration,
  type ComponentExtension,
  type ComponentPool,
  OnDestroy,
  OnInitialize,
} from './component.ts'
import { Digraph } from './digraph.ts';
import { Entity, type WorldEntity } from './entity.ts'
import { Query } from './query.ts'
import { System } from './system.ts'
import { WorldDirtyBit, type EntityDiff } from './types.ts';

const ComputedComponents = Symbol('Ecstc.ComputedComponents');

interface DependencyTries {
  [ComputedComponents]: Set<string>
  [key: string]: DependencyTries
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

type PoolsFromConfig<W extends World<any, any, any>, CC> = {
  [K in keyof CC]: ComponentPool<W, CC, K>
}

class DestroyDescriptor<E extends Entity<any>> {

  destroying: boolean
  listeners: Set<(entity: E) => void>
  pending: Set<any>

  constructor() {
    this.destroying = false;
    this.listeners = new Set();
    this.pending = new Set();
  }
}

interface ComponentCollection<CC> {
  componentNames: (keyof CC)[],
  configuration: CC,
  factories: FactoriesFromConfig<CC>,
  resolve: (components: Partial<{ [K in keyof CC]: any }>) => Set<keyof CC>,
}

export type WorldComponent<
  W extends World<any, any, any>,
  K extends keyof W['_CC']
> = ReturnType<ComponentPool<W, W['_CC'], K>['allocate']>

export class World<
  CC extends { [K in keyof CC]: ComponentConfiguration<any, any> } = {},
  EntityDecorator extends object = {},
  SC extends { [K in keyof SC]: new (...args: any[]) => System<any> } = {},
> {

  declare _CC: CC
  declare _ED: EntityDecorator
  declare _SC: SC

  caret = 1;
  componentCollection: ComponentCollection<CC>
  components = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    view: new Uint8Array(0),
  };
  destroyDependencies = new Map<WorldEntity<this>, DestroyDescriptor<WorldEntity<this>>>();
  destroyed = new Set<number>();
  diff: () => Map<number, { [K in keyof CC]: ProperteaObjectShape<CC[K]['properties']> } | undefined>
  elapsed = {delta: 0, total: 0};
  entityInstances: (null | WorldEntity<this>)[] = [];
  entityCount: number = 0
  entityMap: number[] = []
  freePool: (WorldEntity<this>)[] = [];
  dirty = {
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    width: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
    view: new Uint8Array(0),
  };
  Entity: new (world: World<any, any, any>) => WorldEntity<this>
  pools: PoolsFromConfig<this, CC>
  queries: Query<this>[] = []
  systems: { [K in keyof SC]: InstanceType<SC[K]> } = {} as any

  constructor({
    components = {} as CC,
    decorateEntity,
    systems = {} as SC,
  }: {
    components: CC;
    decorateEntity?: (E: typeof Entity<World<CC, EntityDecorator, SC>>) =>
      typeof Entity<World<CC, EntityDecorator, SC>> & EntityDecorator;
    systems: SC;
  } = {} as any) {
    this.componentCollection = this.createComponentCollection(components);
    const pools = {} as PoolsFromConfig<this, CC>
    for (const componentName in this.componentCollection.configuration) {
      const factory = this.componentCollection.factories[componentName];
      pools[componentName as keyof CC] = this.createComponentPool(factory) as any;
    }
    this.pools = pools;
    this.dirty.width.value = 2 * this.componentCollection.componentNames.length;
    for (const systemName in System.sort<World<CC, EntityDecorator, SC>>(systems)) {
      (this.systems as any)[systemName] = new systems[systemName](this);
      this.systems[systemName].initialize()
    }
    const {entityInstances} = this;
    this.Entity = class extends (decorateEntity?.(Entity as any) ?? Entity as any) {
      constructor(world: World<CC, EntityDecorator, SC>) {
        super(world)
        this.index = entityInstances.length;
      }
    } as unknown as typeof this['Entity']
    this.diff = this.makeDiff();
  }

  static create<
    CC extends { [K in keyof CC]: ComponentConfiguration<any, any> },
    ED extends object = {},
    SC extends { [K in keyof SC]: new (...args: any[]) => System<any> } = {},
  >({
    components = {} as CC,
    decorateEntity,
    systems = {} as SC,
  }: {
    components: CC;
    decorateEntity?: (E: new (world: any) => Entity<any>) => new (world: any) => Entity<any> & ED;
    systems: SC;
  } = {} as any): World<CC, ED, SC> {
    return new this({ components, decorateEntity: decorateEntity as any, systems })
  }

  addComponentFlag(index: number, componentName: keyof CC) {
    const {componentNames, factories} = this.componentCollection;
    const bit = index * componentNames.length + factories[componentName].id;
    this.components.view[bit >> 3] |= 1 << (bit & 7);
    this.reindex(this.entityInstances[index] as Entity<typeof this> & EntityDecorator);
  }

  addDestroyDependency(entity: WorldEntity<this>) {
    if (!this.destroyDependencies.has(entity)) {
      this.destroyDependencies.set(entity, new DestroyDescriptor());
    }
    const {pending} = this.destroyDependencies.get(entity)!;
    const token = {};
    pending.add(token);
    return () => { pending.delete(token); };
  }

  addDestroyListener(entity: WorldEntity<this>, listener: (entity: WorldEntity<this>) => void) {
    if (!this.destroyDependencies.has(entity)) {
      this.destroyDependencies.set(entity, new DestroyDescriptor());
    }
    this.destroyDependencies.get(entity)!.listeners.add(listener);
    return () => {
      if (this.destroyDependencies.has(entity)) {
        this.destroyDependencies.get(entity)!.listeners.delete(listener);
      }
    };
  }

  clear() {
    for (const entity of this.entityInstances) {
      if (entity) {
        this.destroyEntityImmediately(entity);
      }
    }
    this.caret = 1;
    this.entityCount = 0
    this.entityInstances.length = 0;
    this.markClean();
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
      const { decorator, properties = {} } = configuration[componentName];
      type InnerThis = typeof this
      const proxyProperty = object(properties, (Component) => {
        class ExtendedComponent extends Component {
          entity: Entity<InnerThis> | null = null
          ;[OnDestroy]() { }
          [OnInitialize]() { }
        }
        return decorator?.(ExtendedComponent) ?? ExtendedComponent
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
    return {
      componentNames: Object.keys(configuration) as (keyof CC)[],
      configuration,
      factories,
      resolve,
    };
  }

  createComponentPool<
    P extends ProperteaObjectProps,
    Decorator extends object = {},
  >(factory: ComponentFactory<keyof CC, P, any>) {
    class ComponentPool extends Pool<
      ProperteaObject<P, Decorator & ComponentExtension<World<CC, EntityDecorator, SC>>>
    > {
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
          this.setComponentDirty(
            pool.proxies[index]!.entity.index,
            factory.componentName,
            WorldDirtyBit.CHANGED,
          );
        }
      },
    });
    const width = pool.property.dirtyByteWidth; // hoisted for use in `onDirty` above
    return pool;
  }

  createEntity<
    C extends Partial<{ [K in keyof CC]: Parameters<ComponentPool<this, CC, K>['allocate']>[0] }>
  >(
    components: C = {} as C,
  ) {
    return this.createSpecificEntity(this.nextId(), components);
  }

  createSpecificEntity<
    C extends Partial<{ [K in keyof CC]: Parameters<ComponentPool<this, CC, K>['allocate']>[0] }>
  >(
    entityId: number,
    components: C = {} as C,
  ) {
    if (this.entityCount === this.dirty.nextGrow) {
      this.dirty.memory.grow(1);
      this.dirty.view = new Uint8Array(this.dirty.memory.buffer);
      this.dirty.nextGrow = Math.floor(
        this.dirty.memory.buffer.byteLength / (this.dirty.width.value / 8)
      );
    }
    if (this.entityCount === this.components.nextGrow) {
      this.components.memory.grow(1);
      this.components.view = new Uint8Array(this.components.memory.buffer);
      this.components.nextGrow = Math.floor(this.components.memory.buffer.byteLength / (
        this.componentCollection.componentNames.length / 8
      ));
    }
    let entity: WorldEntity<World<CC, EntityDecorator, SC>>;
    if (this.freePool.length > 0) {
      entity = this.freePool.pop()!;
      this.entityInstances[entity.index] = entity;
    }
    else {
      entity = new this.Entity(this);
      this.entityInstances.push(entity);
    }
    this.entityCount += 1
    entity.id = entityId;
    this.entityMap[entityId] = entity.index
    for (const componentName of this.componentCollection.resolve(components)) {
      if (componentName in this.componentCollection.configuration) {
        entity.addComponent(componentName, components[componentName as keyof C] as any);
      }
    }
    this.reindex(entity);
    return entity as (
      & typeof entity
      & { [K in keyof C]: (
          & ReturnType<ComponentPool<World<CC, EntityDecorator, SC>, CC, K & keyof CC>['allocate']>
          & { entity: typeof entity }
        ) }
    )
  }

  deindex(entity: WorldEntity<this>) {
    for (const query of this.queries) {
      query.deindex(entity as Entity<typeof this> & EntityDecorator);
    }
  }

  destroy() {
    this.clear();
    this.components = {
      memory: new WebAssembly.Memory({initial: 0}),
      nextGrow: 0,
      view: new Uint8Array(0),
    };
    this.dirty = {
      memory: new WebAssembly.Memory({initial: 0}),
      nextGrow: 0,
      width: this.dirty.width,
      view: new Uint8Array(0),
    };
    this.freePool = [];
  }

  destroyEntity(entity: WorldEntity<this>) {
    if (!this.destroyDependencies.has(entity)) {
      const descriptor = new DestroyDescriptor()
      descriptor.destroying = true;
      this.destroyDependencies.set(entity, descriptor);
    }
    else {
      this.destroyDependencies.get(entity)!.destroying = true;
    }
  }

  destroyEntityImmediately(entity: WorldEntity<this>) {
    if (this.destroyDependencies.has(entity)) {
      for (const listener of this.destroyDependencies.get(entity)!.listeners) {
        listener(entity);
      }
      this.destroyDependencies.delete(entity);
    }
    this.deindex(entity);
    entity.destroyComponents();
    this.freePool.push(entity);
    delete this.entityMap[entity.id]
    this.entityCount -= 1
    this.entityInstances[entity.index] = null;
    this.destroyed.add(entity.id);
  }

  entity(id: number): WorldEntity<this> | null {
    return this.entityInstances[id]
  }

  async instantiateWasm(wasm: Record<string, BufferSource>) {
    const promises = [];
    for (const systemName in wasm) {
      promises.push(
        /* v8 ignore next */
        this.systems[systemName as keyof SC].instantiateWasm(wasm[systemName])
          .catch((error) => {
            error.message = `System(${systemName}).instantiateWasm: ${error.message}`;
            throw error;
          }),
      );
    }
    return Promise.all(promises);
  }

  makeDiff(): () => Map<number, { [K in keyof CC]: ProperteaObjectShape<CC[K]['properties']> } | undefined> {
    const increment = `j <<= 1; if (256 === j) { i += 1; j = 1; }`;
    return (new Function('Diff', `
      return function() {
        const map = new Map();
        let i = 0, j = 1;
        const {view} = this.dirty;
        for (let k = 0; k < this.entityInstances.length; ++k) {
          const entity = this.entityInstances[k];
          if (!entity) {
            for (let l = 0; l < ${JSON.stringify(this.componentCollection.componentNames.length)}; ++l) {
              ${increment}
              ${increment}
            }
            continue;
          }
          let diff;
          ${this.componentCollection.componentNames.map((componentName) => {
            const sanitizedComponentName = JSON.stringify(componentName)
            return `
              {
                const wasModified = view[i] & j;
                ${increment}
                const wasRemoved = view[i] & j;
                ${increment}
                if (wasRemoved) {
                  diff ??= {};
                  diff[${sanitizedComponentName}] = false;
                }
                else if (wasModified) {
                  const componentDiff = entity[${sanitizedComponentName}][Diff]();
                  const factory = this.componentCollection.factories[${sanitizedComponentName}];
                  if (factory.isEmpty || componentDiff) {
                    diff ??= {};
                    diff[${sanitizedComponentName}] = componentDiff ?? {};
                  }
                }
              }
            `
          }).join('\n')}
          if (diff) {
            map.set(entity.id, diff);
          }
        }
        for (const entityId of this.destroyed) {
          map.set(entityId, undefined);
        }
        return map;
      }
    `))(Diff);
  }

  markClean() {
    for (const componentName in this.pools) {
      this.pools[componentName].markClean();
    }
    this.dirty.view.fill(0);
    this.destroyed.clear();
  }

  nextId() {
    return this.caret++;
  }

  query(configuration: ConstructorParameters<typeof Query<this>>[0]) {
    const query = new Query<this>(configuration);
    for (const entity of this.entityInstances) {
      if (entity) {
        query.reindex(entity);
      }
    }
    this.queries.push(query);
    return query;
  }

  reindex(entity: WorldEntity<this>) {
    for (const query of this.queries) {
      query.reindex(entity as WorldEntity<typeof this>);
    }
  }

  removeComponentFlag(index: number, componentName: keyof CC) {
    const {componentNames, factories} = this.componentCollection;
    const bit = index * componentNames.length + factories[componentName].id;
    this.components.view[bit >> 3] &= ~(1 << (bit & 7));
    this.reindex(this.entityInstances[index]!);
  }

  set(diff: Map<number, EntityDiff<keyof CC> | undefined>) {
    for (const [entityId, change] of diff) {
      this.setEntity(entityId, change);
    }
  }

  setComponentDirty(index: number, componentName: keyof CC, bit: WorldDirtyBit) {
    const o = this.dirty.width.value * index + 2 * this.componentCollection.factories[componentName].id + bit;
    const i = o >> 3;
    const j = 1 << (o & 7);
    this.dirty.view[i] |= j;
  }

  setEntity(entityId: number, change: EntityDiff<keyof CC> | undefined) {
    const entity = this.entityInstances[this.entityMap[entityId]];
    if (entity) {
      if (undefined === change) {
        this.destroyEntity(entity);
      }
      else {
        entity.set(change);
      }
    }
    else if (change) {
      this.createSpecificEntity(entityId, change as any);
    }
  }

  tick(delta: number) {
    this.elapsed = {delta, total: this.elapsed.total + delta};
    this.tickWithElapsed();
  }

  tickSystems() {
    for (const systemName in this.systems) {
      this.systems[systemName].tickWithChecks(this.elapsed);
    }
  }

  tickWithElapsed() {
    this.tickSystems();
    for (const [entity, {destroying, pending}] of this.destroyDependencies) {
      if (destroying && 0 === pending.size) {
        this.destroyEntityImmediately(entity);
      }
    }
  }

  toJSON() {
    const json = []
    for (const entity of this.entityInstances) {
      if (entity) {
        json.push(entity.toJSONWithoutDefaults({}))
      }
    }
    return json
  }

  wasmImports() {
    return {
      dirty: this.dirty.memory,
      dirty_width: this.dirty.width,
    };
  }

}
