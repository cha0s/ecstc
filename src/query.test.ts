import { string, uint8 } from 'propertea';
import { expect, test } from 'vitest';

import { defineComponent } from './component.ts';
import type { Query } from './query.ts';
import { System } from './system.ts'
import { World } from './world.ts'

test('free pool use', async () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  class Includes extends System {
    withA: Query<any, typeof world>
    constructor(world: World<any, any, any, any>) {
      super(world)
      this.withA = this.query('withA', { includes: ['A'] })
    }

  }
  const world = World.create({ components: { A, B }, systems: { Includes }})
  const { withA } = world.systems.Includes
  const entity = world.createEntity({ A: { test: 10 } })
  expect(withA.count).to.equal(1)
  world.createEntity({ A: { test: 11 } })
  expect(withA.count).to.equal(2)
  world.destroyEntityImmediately(entity)
  expect(withA.count).to.equal(2)
  // reused
  world.createEntity({ A: { test: 12 }})
  expect(withA.count).to.equal(2)
})

test('onDeindex', async () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  let wasInserted = false
  class Includes extends System {
    withA: Query<any, typeof world>
    constructor(world: World<any, any, any, any>) {
      super(world)
      this.withA = this.query('withA', {
        onDeindex: (deindexed) => {
          wasInserted = entity === deindexed
        },
        includes: ['A'],
      })
    }

  }
  const world = World.create({ components: { A, B }, systems: { Includes }})
  const entity = world.createEntity({ A: { test: 10 } })
  expect(wasInserted).to.equal(false)
  world.destroyEntityImmediately(entity)
  expect(wasInserted).to.equal(true)
})

test('onInsert', async () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  let insertedEntity: any
  class Includes extends System {
    withA: Query<any, typeof world>
    constructor(world: World<any, any, any, any>) {
      super(world)
      this.withA = this.query('withA', {
        onInsert: (inserted) => {
          insertedEntity = inserted
        },
        includes: ['A'],
      })
    }
  }
  const world = World.create({ components: { A, B }, systems: { Includes }})
  expect(world.createEntity({ A: { test: 10 } })).to.equal(insertedEntity)
})
