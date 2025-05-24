import {ComponentRegistry} from '../src/register.js';
import World from '../src/world.js';

import '../src/test/components.js';

const world = new World({Components: ComponentRegistry});
const entities = Array(50000);
for (let j = 0; j < 10; ++j) {
  for (let i = 0; i < entities.length; ++i) {
    entities[i] = world.createSpecific(i + 1, {Position: {x: 1.0}});
  }
}

let start;
start = performance.now();
for (let i = 0; i < entities.length; ++i) {
  entities[i] = world.createSpecific(i + 1, {Position: {x: 1}});
}
console.log(entities.length, performance.now() - start)

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
console.log(entities.length, performance.now() - start)

// console.log(world.diff())
