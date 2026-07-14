import {
  Diff,
  // @ts-expect-error - needed for build?
  Index,
  Memory,
  object,
  type ProperteaObjectProps,
  Pool,
  ProperteaObject,
  type ProperteaObjectProxyInterface,
  type TrackedMemory,
} from 'propertea'

import {
  type ComponentConfiguration,
  type ComponentExtension,
  type ComponentPool,
  OnDestroy,
  OnInitialize,
} from './component.ts'
import { Digraph } from './digraph.ts'
import { Entity, type EntityFromComponents, type WorldEntity } from './entity.ts'
import { Query } from './query.ts'
import { System } from './system.ts'
import { WorldDirtyBit, type EntityDiff } from './types.ts'

const ComputedComponents = Symbol('Ecstc.ComputedComponents')

interface DependencyTries<K> {
  [ComputedComponents]: Set<K>
  [key: string]: DependencyTries<K>
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
  [K in keyof T]: T[K] extends ComponentConfiguration<infer P, infer E, any>
    ? ComponentFactory<K, P, E>
    : never
}

type PoolsFromConfig<W extends World<any, any, any, any>, CC, UseWasm extends boolean> = {
  [K in keyof CC]: ComponentPool<W, CC, UseWasm, K>
}

class DestroyDescriptor<E extends Entity<any>> {

  destroying: boolean
  listeners: Set<(entity: E) => void>
  pending: Set<any>

  constructor() {
    this.destroying = false
    this.listeners = new Set()
    this.pending = new Set()
  }
}

interface ComponentCollection<CC> {
  componentNames: (keyof CC)[]
  configuration: CC
  dependencyMap: Map<keyof CC, (keyof CC)[]>
  dependentMap: Map<keyof CC, (keyof CC)[]>
  factories: FactoriesFromConfig<CC>
  resolve: (components: Partial<{ [K in keyof CC]: any }>) => Set<keyof CC>
}

export type WorldComponent<
  W extends World<any, any, any, any>,
  K extends keyof W['_CC']
> = ReturnType<ComponentPool<W, W['_CC'], W['_UW'], K>['allocate']>

export class World<
  CC extends { [K in keyof CC]: ComponentConfiguration<any, any, any> } = {},
  EntityDecorator extends object = {},
  SC extends { [K in keyof SC]: new (...args: any[]) => System<any, any> } = {},
  UseWasm extends boolean = any,
> {

  declare _CC: CC
  declare _ED: EntityDecorator
  declare _SC: SC
  declare _UW: UseWasm

  caret = 1
  componentCollection: ComponentCollection<CC>
  components: TrackedMemory<UseWasm>
  destroyDependencies = new Map<WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>, DestroyDescriptor<WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>>>()
  destroyed = new Set<WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>>()
  diff: () => Map<number, { [K in keyof CC]: ProperteaObjectProxyInterface<CC[K]['properties']> } | undefined>
  elapsed = {delta: 0, total: 0}
  entityInstances: (null | WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>)[] = []
  entityCount: number = 0
  entityMap: number[] = []
  freePool: (WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>)[] = []
  dirty: TrackedMemory<UseWasm>
  dirtyWidth = new WebAssembly.Global({mutable: true, value: 'i32'}, 0)
  Entity: new (world: World<any, any, any, any>) => WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>
  pools: PoolsFromConfig<World<CC, EntityDecorator, SC, UseWasm>, CC, UseWasm>
  queries: Query[] = []
  systems: { [K in keyof SC]: InstanceType<SC[K]> } = {} as any
  useWasm: UseWasm
  views = {
    components: new Uint8Array(0),
    dirty: new Uint8Array(0),
  }

  constructor({
    components = {} as CC,
    decorateEntity,
    systems = {} as SC,
    useWasm = false as any,
  }: {
    components: CC
    decorateEntity?: (E: typeof Entity<World<CC, EntityDecorator, SC, UseWasm>>) =>
      typeof Entity<World<CC, EntityDecorator, SC, UseWasm>> & EntityDecorator
    systems: SC
    useWasm?: UseWasm
  } = {} as any) {
    this.useWasm = useWasm
    this.componentCollection = this.createComponentCollection(components)
    const pools = {} as PoolsFromConfig<World<CC, EntityDecorator, SC, UseWasm>, CC, UseWasm>
    for (const componentName in this.componentCollection.configuration) {
      const factory = this.componentCollection.factories[componentName]
      pools[componentName as keyof CC] = this.createComponentPool(factory) as any
    }
    this.pools = pools
    this.components = {
      memory: useWasm ? new WebAssembly.Memory({ initial: 0 }) : new Memory() as any,
      nextGrow: 0,
    }
    this.dirty = {
      memory: useWasm ? new WebAssembly.Memory({ initial: 0 }) : new Memory() as any,
      nextGrow: 0,
    }
    this.dirtyWidth.value = 2 * this.componentCollection.componentNames.length
    for (const systemName in systems) {
      (this.systems as any)[systemName] = new systems[systemName](this)
      this.systems[systemName].initialize()
    }
    const {entityInstances} = this
    this.Entity = class extends (decorateEntity?.(Entity as any) ?? Entity as any) {
      constructor(world: World<CC, EntityDecorator, SC>) {
        super(world)
        this.index = entityInstances.length
      }
    } as unknown as typeof this['Entity']
    this.diff = this.makeDiff()
  }

  static create<
    CC extends { [K in keyof CC]: ComponentConfiguration<any, any, any> },
    ED extends object = {},
    SC extends { [K in keyof SC]: new (...args: any[]) => System<any, any> } = {},
    UW extends boolean = any,
  >({
    components = {} as CC,
    decorateEntity,
    systems = {} as SC,
    useWasm = false as UW,
  }: {
    components: CC
    decorateEntity?: (E: typeof Entity<World<CC, ED, SC, UW>>) =>
      typeof Entity<World<CC, ED, SC, UW>> & ED
    systems: SC
    useWasm?: UW
  } = {} as any): World<CC, ED, SC, UW> {
    return new this({ components, decorateEntity: decorateEntity as any, systems, useWasm })
  }

  addComponentFlag(index: number, componentName: keyof CC) {
    const {componentNames, factories} = this.componentCollection
    const bit = index * componentNames.length + factories[componentName].id
    this.views.components[bit >> 3] |= 1 << (bit & 7)
    this.reindex(this.entityInstances[index] as Entity<typeof this> & EntityDecorator)
  }

  addDestroyDependency(entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>) {
    if (!this.destroyDependencies.has(entity)) {
      this.destroyDependencies.set(entity, new DestroyDescriptor())
    }
    const {pending} = this.destroyDependencies.get(entity)!
    const token = {}
    pending.add(token)
    return () => { pending.delete(token); }
  }

  addDestroyListener(entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>, listener: (entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>) => void) {
    if (!this.destroyDependencies.has(entity)) {
      this.destroyDependencies.set(entity, new DestroyDescriptor())
    }
    this.destroyDependencies.get(entity)!.listeners.add(listener)
    return () => {
      if (this.destroyDependencies.has(entity)) {
        this.destroyDependencies.get(entity)!.listeners.delete(listener)
      }
    }
  }

  clear() {
    for (const entity of this.entityInstances) {
      if (entity) {
        this.destroyEntityImmediately(entity)
      }
    }
    this.caret = 1
    this.entityCount = 0
    this.entityInstances.length = 0
    this.markClean()
  }

  createComponentCollection(configuration: CC) {
    const dependencyGraph = new Digraph<keyof CC>()
    const factories = {} as FactoriesFromConfig<CC>
    let componentId = 0
    for (const componentName in configuration) {
      dependencyGraph.ensureTail(componentName as keyof CC)
      for (const dependency of Object.keys(configuration[componentName].dependencies ?? {})) {
        // adding in reverse order to make tree traversal more natural
        dependencyGraph.addDependency(dependency as keyof CC, componentName as keyof CC)
      }
    }
    // reverse since we added in reverse order
    const sorted = dependencyGraph.sort().reverse() as (keyof CC)[]
    for (const componentName of sorted) {
      const { decorator, properties = {} } = configuration[componentName]
      const proxyProperty = object(properties, (Component) => {
        class ExtendedComponent extends Component {
          entity: Entity<World<CC, EntityDecorator, SC, UseWasm>> | null = null
          ;[OnDestroy]() { }
          ;[OnInitialize]() { }
        }
        return decorator?.(ExtendedComponent as any) ?? ExtendedComponent
      })
      factories[componentName] = new ComponentFactory(
        componentName,
        componentId,
        0 === Object.keys(properties).length,
        proxyProperty,
      ) as any
      componentId += 1
    }
    // compute dependency graphs
    function expandDependencies(componentName: keyof CC) {
      const computed = new Set<keyof CC>()
      dependencyGraph.visit(componentName, (dependent) => { computed.add(dependent); })
      return Array.from(computed).reverse()
    }
    const dependencyMap = new Map<keyof CC, (keyof CC)[]>()
    const dependencyTries: DependencyTries<keyof CC> = {[ComputedComponents]: new Set()}
    for (const componentName of sorted) {
      dependencyMap.set(componentName, expandDependencies(componentName))
    }
    // reverse to map dependents
    const dependentMap = new Map<keyof CC, (keyof CC)[]>()
    for (const [dependent, dependencies] of dependencyMap) {
      for (const dependency of dependencies) {
        if (!dependentMap.has(dependency)) {
          dependentMap.set(dependency, [])
        }
        dependentMap.get(dependency)!.unshift(dependent)
      }
    }
    function resolve(components: Partial<{ [K in keyof CC]: any }>) {
      let walk = dependencyTries
      cacheMiss: {
        for (const componentName in components) {
          if (!(componentName in walk)) {
            break cacheMiss
          }
          walk = walk[componentName]
        }
        return walk[ComputedComponents] as Set<keyof CC>
      }
      walk = dependencyTries
      const computed = new Set<keyof CC>()
      for (const componentName in components) {
        if (!(componentName in configuration)) {
          continue
        }
        for (const dependency of dependencyMap.get(componentName)!) {
          computed.add(dependency)
        }
        if (!(componentName in walk)) {
          walk[componentName] = {[ComputedComponents]: new Set(computed)}
        }
        walk = walk[componentName]
      }
      return walk[ComputedComponents] as unknown as Set<keyof CC>
    }
    return {
      componentNames: sorted,
      configuration,
      dependencyMap,
      dependentMap,
      factories,
      resolve,
    }
  }

  createComponentPool<
    P extends ProperteaObjectProps,
    Decorator extends object = {},
  >(factory: ComponentFactory<keyof CC, P, any>) {
    class ComponentPool extends Pool<
      ProperteaObject<P, Decorator & ComponentExtension<World<CC, EntityDecorator, SC>>>,
      UseWasm
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
        const index = Math.floor(bit / width)
        if (index < pool.proxies.length) {
          this.setComponentDirty(
            pool.proxies[index]!.entity.index,
            factory.componentName,
            WorldDirtyBit.CHANGED,
          )
        }
      },
      useWasm: this.useWasm,
    })
    const width = pool.property.dirtyByteWidth; // hoisted for use in `onDirty` above
    return pool
  }

  createEntity<
    C extends Partial<{ [K in keyof CC]: Parameters<ComponentPool<World<CC, EntityDecorator, SC, UseWasm>, CC, UseWasm, K>['allocate']>[0] }>
  >(
    components: C = {} as C,
  ) {
    return this.createSpecificEntity(this.nextId(), components)
  }

  createSpecificEntity<
    C extends Partial<{ [K in keyof CC]: Parameters<ComponentPool<World<CC, EntityDecorator, SC, UseWasm>, CC, UseWasm, K>['allocate']>[0] }>
  >(
    entityId: number,
    components: C = {} as C,
  ) {
    if (this.entityCount === this.dirty.nextGrow) {
      this.dirty.memory.grow(1)
      this.views.dirty = new Uint8Array(this.dirty.memory.buffer)
      this.dirty.nextGrow = Math.floor(
        this.dirty.memory.buffer.byteLength / (this.dirtyWidth.value / 8)
      )
    }
    if (this.entityCount === this.components.nextGrow) {
      this.components.memory.grow(1)
      this.views.components = new Uint8Array(this.components.memory.buffer)
      this.components.nextGrow = Math.floor(this.components.memory.buffer.byteLength / (
        this.componentCollection.componentNames.length / 8
      ))
    }
    let entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>
    if (this.freePool.length > 0) {
      entity = this.freePool.pop()!
      this.entityInstances[entity.index] = entity
    }
    else {
      entity = new this.Entity(this)
      this.entityInstances.push(entity)
    }
    this.entityCount += 1
    entity.id = entityId
    this.entityMap[entityId] = entity.index
    for (const componentName of this.componentCollection.resolve(components)) {
      if (componentName in this.componentCollection.configuration) {
        entity.addComponent(componentName, components[componentName as keyof C] as any)
      }
    }
    this.reindex(entity)
    return entity as (
      & typeof entity
      & { [K in keyof C]: (
          & ReturnType<ComponentPool<World<CC, EntityDecorator, SC>, CC, UseWasm, K & keyof CC>['allocate']>
          & { entity: typeof entity }
        ) }
    )
  }

  deindex(entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>) {
    for (const query of this.queries) {
      query.deindex(entity as any)
    }
  }

  destroy() {
    this.clear()
    this.components = {
      memory: this.useWasm ? new WebAssembly.Memory({ initial: 0 }) : new Memory() as any,
      nextGrow: 0,
    }
    this.dirty = {
      memory: this.useWasm ? new WebAssembly.Memory({ initial: 0 }) : new Memory() as any,
      nextGrow: 0,
    }
    this.views = {
      components: new Uint8Array(0),
      dirty: new Uint8Array(0),
    }
    this.freePool = []
  }

  destroyEntity(entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>) {
    if (!this.destroyDependencies.has(entity)) {
      const descriptor = new DestroyDescriptor()
      descriptor.destroying = true
      this.destroyDependencies.set(entity, descriptor)
    }
    else {
      this.destroyDependencies.get(entity)!.destroying = true
    }
  }

  destroyEntityImmediately(entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>) {
    if (this.destroyDependencies.has(entity)) {
      for (const listener of this.destroyDependencies.get(entity)!.listeners) {
        listener(entity)
      }
      this.destroyDependencies.delete(entity)
    }
    this.deindex(entity)
    entity.destroyComponents()
    delete this.entityMap[entity.id]
    this.entityInstances[entity.index] = null
    this.entityCount -= 1
    this.destroyed.add(entity)
  }

  entity(id: number): WorldEntity<World<CC, EntityDecorator, SC, UseWasm>> | null {
    return this.entityInstances[this.entityMap[id]]
  }

  entityByIndex(index: number): WorldEntity<World<CC, EntityDecorator, SC, UseWasm>> | null {
    return this.entityInstances[index]
  }

  async instantiateWasm(wasm: Record<string, BufferSource>) {
    const promises = []
    for (const systemName in wasm) {
      promises.push(
        /* v8 ignore next */
        this.systems[systemName as keyof SC].instantiateWasm(wasm[systemName])
          .catch((error) => {
            error.message = `System(${systemName}).instantiateWasm: ${error.message}`
            throw error
          }),
      )
    }
    return Promise.all(promises)
  }

  makeDiff(): () => Map<number, { [K in keyof CC]: ProperteaObjectProxyInterface<CC[K]['properties']> } | undefined> {
    const increment = `j <<= 1; if (256 === j) { i += 1; j = 1; }`
    return (new Function('Diff', `
      return function() {
        const map = new Map()
        let i = 0, j = 1
        const view = this.views.dirty
        for (let k = 0; k < this.entityInstances.length; ++k) {
          const entity = this.entityInstances[k]
          if (!entity) {
            for (let l = 0; l < ${JSON.stringify(this.componentCollection.componentNames.length)}; ++l) {
              ${increment}
              ${increment}
            }
            continue
          }
          let diff
          ${this.componentCollection.componentNames.map((componentName) => {
            const sanitizedComponentName = JSON.stringify(componentName)
            return `
              {
                const wasModified = view[i] & j
                ${increment}
                const wasRemoved = view[i] & j
                ${increment}
                if (wasRemoved) {
                  diff ??= {}
                  diff[${sanitizedComponentName}] = false
                }
                else if (wasModified) {
                  const componentDiff = entity[${sanitizedComponentName}][Diff]()
                  const factory = this.componentCollection.factories[${sanitizedComponentName}]
                  if (factory.isEmpty || componentDiff) {
                    diff ??= {}
                    diff[${sanitizedComponentName}] = componentDiff ?? {}
                  }
                }
              }
            `
          }).join('\n')}
          if (diff) {
            map.set(entity.id, diff)
          }
        }
        for (const entity of this.destroyed) {
          map.set(entity.id, undefined)
        }
        return map
      }
    `))(Diff)
  }

  markClean() {
    for (const componentName in this.pools) {
      this.pools[componentName].markClean()
    }
    this.views.dirty.fill(0)
    for (const entity of this.destroyed) {
      this.freePool.push(entity)
    }
    this.destroyed.clear()
  }

  nextId() {
    return this.caret++
  }

  query<
    Includes extends Record<string, ComponentConfiguration<any, any, any>> = {}
  >(configuration: (
    | {
      onDeindex?: (entity: EntityFromComponents<Includes>) => void,
      onInsert?: (entity: EntityFromComponents<Includes>) => void,
      excludes?: Record<string, ComponentConfiguration<any, any, any>>,
      includes: Includes,
    }
    | {
      onDeindex?: (entity: EntityFromComponents<Includes>) => void,
      onInsert?: (entity: EntityFromComponents<Includes>) => void,
      excludes: Record<string, ComponentConfiguration<any, any, any>>,
      includes?: Includes,
    }
  )) {
    const query = new Query({
      ...configuration,
      useWasm: this.useWasm,
    })
    for (const entity of this.entityInstances) {
      if (entity) {
        query.reindex(entity)
      }
    }
    this.queries.push(query as any)
    return query
  }

  reindex(entity: WorldEntity<World<CC, EntityDecorator, SC, UseWasm>>) {
    for (const query of this.queries) {
      query.reindex(entity as any)
    }
  }

  removeComponentFlag(index: number, componentName: keyof CC) {
    const {componentNames, factories} = this.componentCollection
    const bit = index * componentNames.length + factories[componentName].id
    this.views.components[bit >> 3] &= ~(1 << (bit & 7))
    this.reindex(this.entityInstances[index]!)
  }

  set(diff: Map<number, EntityDiff<keyof CC> | undefined>) {
    for (const [entityId, change] of diff) {
      this.setEntity(entityId, change)
    }
  }

  setComponentDirty(index: number, componentName: keyof CC, bit: WorldDirtyBit) {
    const o = this.dirtyWidth.value * index + 2 * this.componentCollection.factories[componentName].id + bit
    const i = o >> 3
    const j = 1 << (o & 7)
    this.views.dirty[i] |= j
  }

  setEntity(entityId: number, change: EntityDiff<keyof CC> | undefined) {
    const entity = this.entityInstances[this.entityMap[entityId]]
    if (entity) {
      if (undefined === change) {
        this.destroyEntity(entity)
      }
      else {
        entity.set(change)
      }
    }
    else if (change) {
      this.createSpecificEntity(entityId, change as any)
    }
  }

  tick(delta: number) {
    this.elapsed = {delta, total: this.elapsed.total + delta}
    this.tickWithElapsed()
  }

  tickSystems() {
    for (const systemName in this.systems) {
      this.systems[systemName].tickWithChecks(this.elapsed)
    }
  }

  tickWithElapsed() {
    this.tickSystems()
    for (const [entity, {destroying, pending}] of this.destroyDependencies) {
      if (destroying && 0 === pending.size) {
        this.destroyEntityImmediately(entity)
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
      dirty_width: this.dirtyWidth,
    }
  }

}
