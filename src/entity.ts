import { Diff, Set as ProperteaSet, ToJSON, ToJSONWithoutDefaults } from 'propertea'

import { type ComponentConfiguration, type ComponentDependencies, type ComponentPool, OnDestroy, OnInitialize } from './component.ts'
import { WorldDirtyBit, type EntityDiff } from './types.ts'
import { type World } from './world.ts'

export type WorldEntity<W extends World<any, any, any, any>> = Entity<World<W['_CC'], W['_ED'], W['_SC'], W['_UW']>> & W['_ED']

export type EntityFromComponents<
  CC extends Record<string, ComponentConfiguration<any, any, any>>
> = Entity<any> & ComponentDependencies<CC>

export class Entity<
  W extends World<any, any, any, any> = World<any, any, any, any>,
> {

  id: number = 0
  index: number = 0
  world: W

  constructor(world: W) {
    this.world = world
    for (const componentName of world.componentCollection.componentNames) {
      Object.defineProperty(this, componentName, { value: null, writable: true })
    }
  }

  $$addDependentComponent<
    K extends keyof W['_CC']
  >(
    componentName: K,
  ) {
    if (!this.has(componentName)) {
      const { world } = this
      const component = world.pools[componentName].allocate(undefined, (component) => {
        component.entity = this
      })
      this[componentName] = component as any
      component[OnInitialize]()
      // set flags
      world.setComponentDirty(this.index, componentName, WorldDirtyBit.CHANGED)
      world.addComponentFlag(this.index, componentName)
    }
  }

  addComponent<
    K extends keyof W['_CC']
  >(
    componentName: K,
    values: Parameters<ComponentPool<W, W['_CC'], W['_UW'], K>['allocate']>[0] = {} as any
  ): this & { [P in K]: ReturnType<ComponentPool<W, W['_CC'], W['_UW'], K>['allocate']> } {
    const { world } = this
    const dependencies = world.componentCollection.dependencyMap.get(componentName as string)
    if (!dependencies) {
      return this as any
    }
    // add dependencies; -1 because the last is the requested component
    for (let i = 0; i < dependencies.length - 1; ++i) {
      this.$$addDependentComponent(dependencies[i])
    }
    if (!this.has(componentName)) {
      const component = world.pools[componentName].allocate(values, (component) => {
        component.entity = this
      })
      this[componentName] = component as any
      component[OnInitialize]()
      // set flags
      world.setComponentDirty(this.index, componentName, WorldDirtyBit.CHANGED)
      world.addComponentFlag(this.index, componentName)
    }
    return this as any
  }

  addDestroyDependency() {
    return this.world.addDestroyDependency(this)
  }

  addDestroyListener(listener: (entity: this) => void) {
    return this.world.addDestroyListener(this, listener)
  }

  destroy() {
    this.world.destroyEntity(this)
  }

  destroyComponents(): Omit<this, keyof W['_CC']> {
    const { world } = this
    let bit = (this.index + 1) * world.componentCollection.componentNames.length - 1
    let i = bit >> 3
    let j = 1 << (bit & 7)
    for (let k = world.componentCollection.componentNames.length - 1; k >= 0; --k) {
      if (world.views.components[i] & j) {
        this.$$removeComponent(world.componentCollection.componentNames[k])
      }
      j >>= 1; if (j === 0) { j = 128; i-- }
    }
    return this
  }

  diff() {
    let diff: Record<string, any> | undefined
    let bit = this.world.dirtyWidth.value * this.index
    let i = bit >> 3
    let j = 1 << (bit & 7)
    const { factories } = this.world.componentCollection
    const { dirty } = this.world.views
    for (const componentName in factories) {
      const factory = factories[componentName]
      const isDirty = dirty[i] & j
      j <<= 1; if (256 === j) { i += 1; j = 1 }
      if (!isDirty) {
        j <<= 1; if (256 === j) { i += 1; j = 1 }
        j <<= 1; if (256 === j) { i += 1; j = 1 }
        continue
      }
      const wasModified = dirty[i] & j
      j <<= 1; if (256 === j) { i += 1; j = 1 }
      const wasRemoved = dirty[i] & j
      j <<= 1; if (256 === j) { i += 1; j = 1 }
      if (wasRemoved) {
        diff ??= {}
        diff[componentName] = undefined
      }
      else if (wasModified) {
        const componentDiff = (this as any)[componentName][Diff]()
        if (factory.isEmpty || componentDiff) {
          diff ??= {}
          diff[componentName] = componentDiff ?? {}
        }
      }
    }
    return diff
  }

  has<
    K extends keyof W['_CC'],
  >(
    componentName: K,
  ): this is (
    & this
    & ComponentDependencies<{ [P in K]: W['_CC'][K] }>
  )
  {
    const { world } = this
    const { componentNames, factories } = world.componentCollection
    const bit = this.index * componentNames.length + factories[componentName].id
    return !!(world.views.components[bit >> 3] & (1 << (bit & 7)))
  }

  $$removeComponent<
    K extends keyof W['_CC']
  >(componentName: K) {
    if (this.has(componentName)) {
      const { world } = this
      const component = this[componentName]
      component[OnDestroy]()
      component.entity = null as any
      world.pools[componentName].free(this[componentName])
      this[componentName] = null as any
      // set flags
      world.setComponentDirty(this.index, componentName, WorldDirtyBit.REMOVED)
      world.removeComponentFlag(this.index, componentName)
    }
  }

  removeComponent<
    K extends keyof W['_CC']
  >(componentName: K): Omit<this, K> {
    const { world } = this
    const dependents = world.componentCollection.dependentMap.get(componentName as string)
    if (!dependents) {
      return this
    }
    // remove dependents; -1 because the last is the requested component
    for (let i = 0; i < dependents.length - 1; ++i) {
      this.$$removeComponent(dependents[i])
    }
    if (this.has(componentName)) {
      const component = this[componentName]
      component[OnDestroy]()
      component.entity = null as any
      world.pools[componentName].free(this[componentName] as any)
      this[componentName] = null as any
      // set flags
      world.setComponentDirty(this.index, componentName, WorldDirtyBit.REMOVED)
      world.removeComponentFlag(this.index, componentName)
    }
    return this
  }

  set<
    K extends keyof W['_CC']
  >(change: EntityDiff<K>) {
    for (const componentName in change) {
      const values = change[componentName]
      if (undefined === values) {
        this.removeComponent(componentName)
      }
      else if (!this.has(componentName)) {
        this.addComponent(componentName, values as any)
      }
      else {
        ;(this as any)[componentName][ProperteaSet](values)
      }
    }
  }

  toJSON() {
    const { world } = this
    const json: Record<string, any> = {} as any
    const { componentCollection: { componentNames } } = world
    let i = 0
    let j = 1
    for (let k = 0; k < componentNames.length; ++k) {
      if (world.views.components[i] & j) {
        const componentName = componentNames[k] as string
        json[componentName] = (this as any)[componentName][ToJSON]()
      }
      j <<= 1; if (256 === j) { i += 1; j = 1 }
    }
    return json
  }

  toJSONWithoutDefaults<
    K extends keyof W['_CC']
  >(defaults: Record<K, any>) {
    const { world } = this
    const json: Record<K, any> = {} as any
    const { componentCollection: { componentNames } } = world
    let bit = this.index * componentNames.length
    let i = bit >> 3
    let j = 1 << (bit & 7)
    for (let k = 0; k < componentNames.length; ++k) {
      if (world.views.components[i] & j) {
        const componentName = componentNames[k] as K
        const propertyJson = (this as any)[componentName][ToJSONWithoutDefaults](
          defaults?.[componentName]
        )
        if (propertyJson) {
          json[componentName] = propertyJson
        }
      }
      j <<= 1; if (256 === j) { i += 1; j = 1 }
    }
    return json
  }

}

