import { uint8 } from 'propertea';
import { expect, test, vi } from 'vitest';

import { defineComponent } from './component.ts';
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
  class Discrete extends System {
    frequency = 1;
  }
  const system = new Discrete(world)
  system.initialize()
  const spy = vi.spyOn(system, 'tick')
  expect(system.remaining).to.equal(1)
  // 20 ticks
  system.tickWithChecks({ delta: 20, total: 30 })
  expect(spy).toHaveBeenCalledTimes(20)
  for (let i = 0; i < 20; ++i) {
    expect(spy).toHaveBeenNthCalledWith(1 + i, { delta: 1, total: 10 + 1 + i })
  }
  expect(system.remaining).to.equal(1)
  spy.mockClear()
  // no tick...
  system.tickWithChecks({ delta: 0.5, total: 30.5 })
  // expect(accumulator).to.equal(20)
  expect(system.remaining).to.equal(0.5)
  expect(spy).toHaveBeenCalledTimes(0)
  spy.mockClear()
  // 1 tick
  system.tickWithChecks({ delta: 0.5, total: 31 })
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenCalledWith({ delta: 1, total: 31 })
  expect(system.remaining).to.equal(1)
  spy.mockClear()
  // scheduled tick
  system.schedule()
  system.tickWithChecks({ delta: 0.5, total: 31.5 })
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenCalledWith({ delta: 0.5, total: 31.5 })
  expect(system.remaining).to.equal(1)
  spy.mockClear()
})

test('queries', () => {
  const A = defineComponent({
    test: uint8(),
  })
  class CatchesDupes extends System {
    constructor(world: World<any>) {
      super(world)
      this.query('default', { includes: { A } })
      this.query('default', { excludes: { A } })
    }
  }
  expect(() => {
    World.create({ components: {}, systems: { CatchesDupes }})
  }).toThrow()
})
