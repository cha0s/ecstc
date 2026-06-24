import { object, string, uint8, type ProperteaObjectShape, type ProxyMixed } from 'propertea';
import { expect, test, vi } from 'vitest';

import { defineComponent, OnInitialize } from './component.ts';
import { type Entity } from './entity.ts'
import type { Query } from './query.ts';
import { System } from './system.ts'
import systemTestBuffer from './system.test.wat?multi_memory';
import { World } from './world.ts'

test('decoration', () => {
  const globalProperties = {
    x: string(),
  }
  const Global = defineComponent(globalProperties)
  let masterX: string = ''
  const A = defineComponent({}, {
    decorator: (Component) => {
      return class extends Component {

        [OnInitialize](this: { entity: Entity<WorldWithMaster> }) {
          const { master } = this.entity.world
          masterX = master.x
        }

      }
    },
  })
  class WorldWithMaster extends World<any, any, any, any> {
    constructor(configuration: any) {
      super(configuration)
      const { Global: master } = this.createEntity({ Global: {} })
      master.x = 'blah'
    }
    get master(): ProxyMixed<ProperteaObjectShape<typeof globalProperties>> {
      return this.entityByIndex(0)?.Global
    }
  }
  const world = WorldWithMaster.create({ components: { A, Global }, systems: {}})
  world.createEntity({ A: {} })
  expect(masterX).to.equal('blah')
})

test('handles nonexistent components', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const world = World.create({ components: { A }, systems: {}})
  expect(() => world.createEntity({ A: { test: 1 }, C: {} })).not.toThrow()
})

test('dependency resolution', () => {
  const C = defineComponent({
    test: uint8(),
  })
  const D = defineComponent({
    test: string(),
  }, {
    dependencies: { C },
  })
  const F = defineComponent({
    test: uint8(),
  })
  const A = defineComponent({
    test: uint8(),
  }, {
    dependencies: { F },
  })
  const B = defineComponent({
    test: string().default('hi'),
  }, {
    dependencies: { A },
  })
  const E = defineComponent({
    test: string(),
  }, {
    decorator: (Component) => {
      return class extends Component {
        someMethod() {
          return this.entity.B.test
        }
      }
    },
    dependencies: { B, C },
  })
  const G = defineComponent({
    test: uint8(),
  })
  const world = World.create({ components: { A, B, C, D, E, F, G }, systems: {}})
  // create adds deps
  {
    const entity = world.createEntity({B: {}})
    expect(entity.has('F')).to.equal(true)
    expect(entity.has('A')).to.equal(true)
    expect(entity.has('B')).to.equal(true)
  }
  // adding a component adds deps
  {
    const entity = world.createEntity({})
    entity.addComponent('B')
    expect(entity.has('F')).to.equal(true)
    expect(entity.has('A')).to.equal(true)
    expect(entity.has('B')).to.equal(true)
  }
  // removing a component removes deps
  {
    const entity = world.createEntity({E: {}})
    expect(entity.has('F')).to.equal(true)
    expect(entity.has('A')).to.equal(true)
    expect(entity.has('B')).to.equal(true)
    expect(entity.E.someMethod()).to.equal('hi')
    expect(entity.has('C')).to.equal(true)
    expect(entity.has('E')).to.equal(true)
    entity.removeComponent('A')
    expect(entity.has('F')).to.equal(true)
    expect(entity.has('A')).to.equal(false)
    expect(entity.has('B')).to.equal(false)
    expect(entity.has('C')).to.equal(true)
    expect(entity.has('E')).to.equal(false)
  }
  // destroying removes in dependency order
  {
    const entity = world.createEntity({B: {}})
    const spy = vi.spyOn(entity, '$$removeComponent')
    world.destroyEntityImmediately(entity)
    expect(spy.mock.calls).to.deep.equal([['B'], ['A'], ['F']])
  }
})

test('diff', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  const C = defineComponent({
    test: object({
      x: uint8(),
    }),
  })
  const world = World.create({ components: { A, B, C }, systems: {}})
  const entity = world.createEntity({ B: { test: 'foo' }})
  // creation diff
  expect(world.diff()).to.deep.equal(new Map([[1, { B: { test: 'foo' }}]]))
  world.markClean()
  // modification diff
  entity.B.test = 'bar'
  expect(world.diff()).to.deep.equal(new Map([[1, { B: { test: 'bar' }}]]))
  world.markClean()
  // set diff
  world.set(new Map([[entity.id, { B: { test: 'baz' }}]]) as any)
  expect(world.diff()).to.deep.equal(new Map([[1, { B: { test: 'baz' }}]]))
  world.markClean()
  world.set(new Map([[2, { B: { test: 'bap' }}]]) as any)
  expect(world.diff()).to.deep.equal(new Map([[2, { B: { test: 'bap' }}]]))
  expect(world.entityInstances).toHaveLength(2)
  world.markClean()
  world.set(new Map([[2, undefined]]) as any)
  world.tick(0)
  expect(world.entityCount).to.equal(1)
  world.markClean()
  world.set(new Map([[3, undefined]]) as any)
  expect(world.entityCount).to.equal(1)
  const entity2 = world.createEntity({ C: { test: { x: 2 } }})
  world.markClean()
  entity2.C.test.x = 4
  expect(world.diff()).to.deep.equal(new Map([[entity2.id, { C: { test: { x: 4 } }}]]))
  // typed diff
  const diff = world.diff()
  const O = diff.get(entity2.id)
  expect(O!.C).to.deep.equal({ test: { x: 4 } })
})

test('destruction', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  }, {
    dependencies: { A },
  })
  const world = World.create({ components: { A, B }, systems: {}})
  // no dependency
  let entity = world.createEntity({ A: { test: 1 }})
  world.markClean()
  world.destroyEntity(entity)
  world.tick(0)
  expect(world.diff()).to.deep.equal(new Map([[1, undefined]]))
  // dependency
  entity = world.createEntity({ A: { test: 1 }})
  world.markClean()
  const allowDestruction = world.addDestroyDependency(entity)
  const allowDestruction2 = world.addDestroyDependency(entity)
  world.destroyEntity(entity)
  world.tick(0)
  expect(world.diff()).to.deep.equal(new Map())
  allowDestruction()
  world.tick(0)
  expect(world.diff()).to.deep.equal(new Map())
  allowDestruction2()
  world.tick(0)
  expect(world.diff()).to.deep.equal(new Map([[2, undefined]]))
  // listen and clear
  entity = world.createEntity({ A: { test: 1 }})
  let heard = 0
  const cancel = world.addDestroyListener(entity, (destroyed) => {
    expect(entity === destroyed)
    heard += 4
  })
  const cancel2 = world.addDestroyListener(entity, (destroyed) => {
    expect(entity === destroyed)
    heard += 1
  })
  cancel()
  world.clear()
  expect(heard).to.equal(1)
  expect(() => cancel2()).not.toThrow()
  expect(() => world.destroy()).not.toThrow()
})

test('tick', () => {
  let ticked = false
  class Tick extends System {
    tick() {
      ticked = true
    }
  }
  const world = World.create({ components: {}, systems: { Tick }})
  world.tick(0)
  expect(ticked).to.equal(true)
})

test('wasm', async () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  class Includes extends System<true, any> {
    withA: Query<true, typeof world>
    constructor(world: World<any, any, any, true>) {
      super(world)
      this.withA = this.query('withA', { includes: ['A'], useWasm: true })
    }
  }
  const world = World.create({ components: { A, B }, systems: { Includes }, useWasm: true })
  await world.instantiateWasm({ Includes: systemTestBuffer })
  // 5 entities,
  const entities = []
  for (let i = 0; i < 5; ++i) {
    entities.push(world.createEntity({ A: { test: 10 + i } }))
  }
  // destroy second entity and recreate it
  world.destroyEntityImmediately(entities[1])
  world.markClean()
  // sets every `entity.A.test` to 25 except the last one
  ;(world.systems.Includes.wasm as any).tick()
  expect(world.diff()).to.deep.equal(new Map([
    [1, { A: { test: 25 } }],
    [3, { A: { test: 25 } }],
    [4, { A: { test: 25 } }],
  ]))
  const results = Array.from(world.systems.Includes.withA.select()).map((entity: any) => entity.A.test)
  expect(results).to.deep.equal(
    // all 25
    Array(3).fill(25)
      // except the last one
      .concat(14)
  )
})

test('query after existing', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const world = World.create({ components: { A }, systems: { }})
  world.createEntity({ A: { test: 1 } })
  expect(Array.from(world.query({ includes: ['A'] }).select())).toHaveLength(1)
})

test('pool reuse', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const world = World.create({ components: { A }, systems: { }})
  const entity = world.createEntity({ A: { test: 1 } })
  world.createEntity({ A: { test: 2 } })
  world.createEntity({ A: { test: 3 } })
  world.destroyEntityImmediately(entity)
  world.tick(0)
  world.createEntity({ A: { test: 4 } })
  expect(world.diff()).to.deep.equal(new Map([
    [1, undefined],
    [2, { A: { test: 2 }}],
    [3, { A: { test: 3 }}],
    [4, { A: { test: 4 }}],
  ]))
})
