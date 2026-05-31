import { expect, test } from 'vitest';

import { type Elapsed, System } from './system.ts'
import { World } from './world.ts'

test('continuous', () => {
  const world = World.create()
  let accumulator = { count: 0, delta: 0 }
  class Continuous extends System {
    tick(elapsed: Elapsed) {
      accumulator.count += 1
      accumulator.delta += elapsed.delta
    }
  }
  const system = new Continuous(world)
  system.initialize()
  expect(system.remaining).to.equal(0)
  // 1 tick
  system.tickWithChecks({ delta: 20, total: 30 })
  expect(accumulator.count).to.equal(1)
  expect(accumulator.delta).to.equal(20)
  expect(system.remaining).to.equal(0)
  // 1 tick
  system.tickWithChecks({ delta: 0.5, total: 30.5 })
  expect(accumulator.count).to.equal(2)
  expect(accumulator.delta).to.equal(20.5)
  expect(system.remaining).to.equal(0)
  // 1 tick
  system.tickWithChecks({ delta: 0.5, total: 31 })
  expect(accumulator.count).to.equal(3)
  expect(accumulator.delta).to.equal(21)
  expect(system.remaining).to.equal(0)
})

test('discrete', () => {
  const world = World.create()
  let accumulator = 0
  class Discrete extends System {
    frequency = 1;
    tick(elapsed: Elapsed) {
      accumulator += 1
      expect(elapsed.delta).to.equal(1)
      expect(elapsed.total).to.equal(10 + accumulator)
    }
  }
  const system = new Discrete(world)
  system.initialize()
  expect(system.remaining).to.equal(1)
  // 20 ticks
  system.tickWithChecks({ delta: 20, total: 30 })
  expect(accumulator).to.equal(20)
  expect(system.remaining).to.equal(1)
  // no tick...
  system.tickWithChecks({ delta: 0.5, total: 30.5 })
  expect(accumulator).to.equal(20)
  expect(system.remaining).to.equal(0.5)
  // 1 tick
  system.tickWithChecks({ delta: 0.5, total: 31 })
  expect(accumulator).to.equal(21)
  expect(system.remaining).to.equal(1)
})