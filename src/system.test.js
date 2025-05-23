import {expect, test} from 'vitest';

import System from './system.js';
import {fakeEnvironment} from './test/components.js';

const {one, two, three} = fakeEnvironment();

test('smoke', () => {
  expect(() => new System()).not.toThrowError();
});

test('queries', () => {
  class Querying extends System {
    static queries() {
      return {
        foo: ['A', '!B'],
        bar: ['B'],
      };
    }
  }
  const system = new Querying();
  system.reindex(one);
  system.reindex(two);
  system.reindex(three);
  expect(Array.from(system.select('foo')).map(({id}) => id)).to.deep.equal([3]);
  expect(Array.from(system.select('bar')).map(({id}) => id)).to.deep.equal([1, 2]);
  system.deindex(three);
  expect(Array.from(system.select('foo')).map(({id}) => id)).to.deep.equal([]);
  expect(Array.from(system.select('bar')).map(({id}) => id)).to.deep.equal([1, 2]);
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
  class Scheduled extends System {
    tick(elapsed) {
      ticks.push(elapsed);
    }
  }
  const system = new Scheduled();
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([0.5]);
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  system.active = false;
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5]);
  system.active = true;
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([0.5, 0.5, 0.5]);
});

test('tick scheduling', () => {
  const ticks = [];
  class Scheduled extends System {
    frequency = 1;
    tick(elapsed) {
      ticks.push(elapsed);
    }
  }
  const system = new Scheduled();
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([]);
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([1]);
  system.schedule();
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  system.active = false;
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([1, 0.5]);
  system.active = true;
  system.tickWithChecks(0.5);
  expect(ticks).to.deep.equal([1, 0.5, 1]);
});
