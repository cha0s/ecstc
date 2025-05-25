import {ComponentRegistry} from '../src/register.js';
import World from '../src/world.js';

import '../src/test/components.js';

const world = new World({Components: ComponentRegistry});
const entities = Array(10000);
for (let j = 0; j < 10; ++j) {
  for (let i = 0; i < entities.length; ++i) {
    entities[i] = world.createSpecific(i + 1, {Position: {x: 1.0}});
  }
}

let start;
function measure(label) {
  console.log(
    `\x1b[33m${((performance.now() - start) / entities.length * 1000).toFixed(4)}\x1b[0mμs`,
    label,
  );
}
start = performance.now();
for (let i = 0; i < entities.length; ++i) {
  entities[i] = world.createSpecific(i + 1, {Position: {x: 1}});
}
measure('create');

const values = Array(entities.length).fill(0).map(() => Math.random());
start = performance.now();
for (let i = 0; i < entities.length; ++i) {
  if (i & 1) {
    entities[i].Position.x = values[i];
  }
  else {
    entities[i].Position.y = values[i];
  }
}
measure('set properties');

const positions = Array(entities.length);
start = performance.now();
for (let i = 0; i < entities.length; ++i) {
  positions[i] = entities[i].toJSONWithoutDefaults();
}
measure('without defaults');
