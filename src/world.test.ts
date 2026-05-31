import { string, uint8 } from 'propertea';
import { expect, test } from 'vitest';

import { defineComponent } from './component.ts';
import type { Query } from './query.ts';
import { System } from './system.ts'
import systemTestBuffer from './system.test.wat?multi_memory';
import { World } from './world.ts'

// test dirty flags for component manipulation

test('continuous', () => {
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
  for (let i = 0; i < 5; ++i) {
    world.createEntity({ A: { test: 10 + i } })
  }
  world.markClean()
  // sets every `entity.A.test` to 25 except the last one
  ;(world.systems.Includes.wasm as any).tick()
  expect(world.diff()).to.deep.equal(new Map(
    // sets 4
    Array(4).fill(25)
      .map((test, i) => [i + 1, { A: { test }}]),
  ))
  const results = Array.from((world.systems.Includes as any).withA.select()).map((entity: any) => entity.A.test)
  expect(results).to.deep.equal(
    // all 25
    Array(4).fill(25)
      // except the last one
      .concat(14)
  )
})
