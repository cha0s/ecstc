import {expect, test} from 'vitest';

import System from './system.js';
import World from './world.js';
import {Components, fakeEnvironment} from './testing.js';

test('smoke', () => {
  expect(() => new System()).not.toThrowError();
});

test('priority', () => {
  class First extends System {
    static priority = {phase: 'pre'};
  }
  class AfterBeforeNormal extends System {
    static priority = {after: 'Before'};
  }
  class BeforeNormal extends System {
    static priority = {before: 'Normal'};
  }
  class BetweenNormalAndAfterBeforeNormal {
    static priority = {before: ['AfterBeforeNormal'], after: ['Normal']};
  }
  class Normal extends System {}
  expect(
    Object.keys(System.sort({
      Normal,
      AfterBeforeNormal,
      BeforeNormal,
      First,
    })),
  ).to.deep.equal([
    'First',
    'BeforeNormal',
    'AfterBeforeNormal',
    'Normal',
  ]);
  expect(
    Object.keys(System.sort({
      Normal,
      AfterBeforeNormal,
      BeforeNormal,
      First,
      BetweenNormalAndAfterBeforeNormal,
    })),
  ).to.deep.equal([
    'First',
    'BeforeNormal',
    'Normal',
    'BetweenNormalAndAfterBeforeNormal',
    'AfterBeforeNormal',
  ]);
});

test('tick', () => {
  const ticks = [];
  const world = new World({Systems: {Scheduled: class extends System {
    tick(elapsed) {
      ticks.push(elapsed.delta);
    }
  }}});
  const {Scheduled} = world.systems;
  world.tick(0.5);
  expect(ticks).to.deep.equal([0.5]);
  world.tick(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  Scheduled.active = false;
  world.tick(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  world.tick(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  world.tick(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  Scheduled.active = true;
  world.tick(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5, 0.5]);
});

test('tick scheduling', () => {
  const ticks = [];
  const world = new World({Systems: {Scheduled: class extends System {
    static frequency = 1;
    tick(elapsed) {
      ticks.push(elapsed.delta);
    }
  }}});
  const {Scheduled} = world.systems;
  world.tick(0.5);
  expect(ticks).to.deep.equal([]);
  world.tick(0.5);
  expect(ticks).to.deep.equal([1]);
  Scheduled.schedule();
  world.tick(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  world.tick(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  Scheduled.active = false;
  world.tick(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  world.tick(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  Scheduled.active = true;
  world.tick(0.5);
  expect(ticks).to.deep.equal([1, 0.5, 1]);
});

test('queries', () => {
  let count;
  class Counter extends System {
    onInitialize() {
      this.bs = this.query(['B']);
    }
    tick() {
      ({count} = this.bs);
    }
  }
  const world = new World({Components, Systems: {Counter}})
  world.create({B: {}});
  world.create({B: {}});
  world.tick();
  expect(count).to.equal(2);
});
