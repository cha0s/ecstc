import { object, string, uint8, type ProperteaObjectShape, type ProxyMixed } from 'propertea';
import { assert, expect, test } from 'vitest';

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
  class WorldWithMaster extends World<any, any, any> {
    constructor(configuration: any) {
      super(configuration)
      const { Global: master } = this.createEntity({ Global: {} })
      master.x = 'blah'
    }
    get master(): ProxyMixed<ProperteaObjectShape<typeof globalProperties>> {
      return this.entity(0)?.Global
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

test('dependencies', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  }, {
    dependencies: ['A'],
  })
  const world = World.create({ components: { A, B }, systems: {}})
  const entity = world.createEntity({ B: { test: 'foo' }})
  // @ts-expect-error - TODO, not sure if possible
  assert.exists(entity.A)
  // TODO - coalescence
  // entity.removeComponent('A')
  // assert.notExists(entity.B)
  // const entity2 = world.createEntity()
  // entity2.addComponent('B', {})
  // assert.exists(entity2.A)
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
    dependencies: ['A'],
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
  class Includes extends System {
    withA: Query<typeof world>
    constructor(world: World<any>) {
      super(world)
      this.withA = this.query('withA', { includes: ['A'] })
    }
  }
  const world = World.create({ components: { A, B }, systems: { Includes }})
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
