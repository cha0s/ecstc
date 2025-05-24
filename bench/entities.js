import {Position} from '../src/test/components.js';
import {ComponentRegistry, registerComponent} from '../src/register.js';
import World from '../src/world.js';

registerComponent('Position', Position);
const world = new World({Components: ComponentRegistry});
const entities = Array(5000);
let start;
start = performance.now();
for (let i = 0; i < entities.length; ++i) {
  entities[i] = world.create({Position: {x: 1}});
}
console.log(entities.length, performance.now() - start)

start = performance.now();
for (let i = 0; i < entities.length; ++i) {
  if (i % 2) {
    entities[i].Position.x = Math.random();
  }
  else {
    entities[i].Position.y = Math.random();
  }
}
console.log(entities.length, performance.now() - start)
