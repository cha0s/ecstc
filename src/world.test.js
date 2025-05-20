import {expect, test} from 'vitest';

import {OnInvalidate} from './property.js';
import {ComponentRegistry, registerComponent} from './register.js';

import {Position} from './test/components.js';
import World from './world.js';

test('world', () => {
  registerComponent('Position', Position);
  const world = new World({Components: ComponentRegistry});
  const entity = world.createSpecific(1, {});
  console.log(entity);
});
