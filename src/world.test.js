import {expect, test} from 'vitest';

import World from './world.js';

import {Components} from './testing.js';

test('smoke', () => {
  const world = new World({Components});
  const entity = world.create({Position: {x: 1}});
  expect(world.diff()).to.deep.equal(new Map([[1, {Position: {x: 1}}]]));
  world.setClean();
  entity.set({Position: {y: 2}});
  expect(world.dirty).to.deep.equal(new Map([[1, new Set(['Position'])]]));
  expect(world.diff()).to.deep.equal(new Map([[1, {Position: {y: 2}}]]));
  world.setClean();
  expect(world.diff()).to.deep.equal(new Map());
  world.destroyImmediately(entity);
  expect(world.diff()).to.deep.equal(new Map([[1, false]]));
});
