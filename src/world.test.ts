import { string, uint8 } from 'propertea';
import { assert, expect, test } from 'vitest';

import { defineComponent } from './component.ts';
import type { Query } from './query.ts';
import { System } from './system.ts'
import systemTestBuffer from './system.test.wat?multi_memory';
import { World } from './world.ts'

test('handles nonexistent components', () => {
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
  })
  const world = World.create({ components: { A }, systems: {}})
  expect(() => world.createEntity({ A: { test: 1 }, C: {} })).not.toThrow()
})

test('dependencies', () => {
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
  })
  const B = defineComponent({
    dependencies: ['A'],
    properties: {
      test: string(),
    },
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
    properties: {
      test: uint8(),
    },
  })
  const B = defineComponent({
    properties: {
      test: string(),
    },
  })
  const world = World.create({ components: { A, B }, systems: {}})
  const entity = world.createEntity({ B: { test: 'foo' }})
  world.markClean()
  entity.B.test = 'bar'
  expect(world.diff()).to.deep.equal(new Map([[1, { B: { test: 'bar' }}]]))
  world.markClean()
  world.set(new Map([[1, { B: { test: 'baz' }}]]) as any)
  expect(world.diff()).to.deep.equal(new Map([[1, { B: { test: 'baz' }}]]))
  world.markClean()
  world.set(new Map([[2, { B: { test: 'bap' }}]]) as any)
  expect(world.diff()).to.deep.equal(new Map([[2, { B: { test: 'bap' }}]]))
  expect(world.entityInstances).toHaveLength(2)
  world.markClean()
  world.set(new Map([[2, false]]) as any)
  world.tick(0)
  expect(world.entities.size).to.equal(1)
  world.markClean()
  world.set(new Map([[3, false]]) as any)
  expect(world.entities.size).to.equal(1)
})

test('destruction', () => {
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
  })
  const B = defineComponent({
    dependencies: ['A'],
    properties: {
      test: string(),
    },
  })
  const world = World.create({ components: { A, B }, systems: {}})
  // no dependency
  let entity = world.createEntity({ A: { test: 1 }})
  world.markClean()
  world.destroyEntity(entity)
  world.tick(0)
  expect(world.diff()).to.deep.equal(new Map([[1, false]]))
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
  expect(world.diff()).to.deep.equal(new Map([[2, false]]))
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
    properties: {
      test: uint8(),
    },
  })
  const B = defineComponent({
    properties: {
      test: string(),
    },
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
  const results = Array.from((world.systems.Includes as any).withA.select()).map((entity: any) => entity.A.test)
  expect(results).to.deep.equal(
    // all 25
    Array(3).fill(25)
      // except the last one
      .concat(14)
  )
})

test('query after existing', () => {
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
  })
  const world = World.create({ components: { A }, systems: { }})
  world.createEntity({ A: { test: 1 } })
  expect(Array.from(world.query({ includes: ['A'] }).select())).toHaveLength(1)
})
