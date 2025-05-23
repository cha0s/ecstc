import {expect, test} from 'vitest';

import {ComponentRegistry, registerComponent} from './register.js';

import {Position} from './test/components.js';
import World from './world.js';

test('world', () => {
  registerComponent('Position', Position);
  const world = new World({Components: ComponentRegistry});
  const entity = world.create({Position: {x: 1}});
  expect(world.diff()).to.deep.equal(new Map([[1, {Position: {x: 1, y: 0}}]]));
  world.setClean();
  entity.set({Position: {y: 2}});
  expect(world.dirty).to.deep.equal(new Map([[1, new Set(['Position'])]]));
  expect(world.diff()).to.deep.equal(new Map([[1, {Position: {x: 1, y: 2}}]]));
  world.setClean();
  expect(world.diff()).to.deep.equal(new Map());
  world.destroyImmediately(entity);
  expect(world.diff()).to.deep.equal(new Map([[1, false]]));
});
