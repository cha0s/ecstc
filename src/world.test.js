import {expect, test} from 'vitest';

import {ComponentRegistry, registerComponent} from './register.js';

import {Position} from './test/components.js';
import World from './world.js';

test('world', () => {
  registerComponent('Position', Position);
  const world = new World({Components: ComponentRegistry});
  const entity = world.create({Position: {x: 1}});
  entity.set({Position: {y: 2}});
  console.log(world.dirty, world.diff());
});
