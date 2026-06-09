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
    withA: Query<typeof world>
    constructor(world: World<any, any, any>) {
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