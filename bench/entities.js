import World from '../src/world.js';

import {Components} from '../src/testing.js';

const {Position} = Components;

const world = new World({Components: {Position}});
const N = 50000;
const entities = Array(N);
const positions = Array(entities.length);

function create() {
  for (let i = 0; i < entities.length; ++i) {
    entities[i] = world.createSpecific(i + 1, {Position: {x: 1.0}});
  }
}

function setProperties() {
  for (let i = 0; i < entities.length; ++i) {
    if (0 === (i & 1)) {
      entities[i].Position.x = i;
    }
    else {
      entities[i].Position.y = i;
    }
  }
}

const LocalPosition = world.Components.Position;
function directSetProperties() {
  for (const {dirty, view} of LocalPosition.pool.chunks) {
    const array = new Float32Array(view.buffer);
    for (let i = 0, j = 0; i < array.length; ++i, j += 2) {
      if (0 === (i & 1)) {
        array[j] = i;
      }
      else {
        array[j + 1] = i;
      }
    }
    dirty.fill(~0);
  }
}

function withoutDefaults() {
  for (let i = 0; i < entities.length; ++i) {
    positions[i] = entities[i].toJSONWithoutDefaults();
  }
}

// warm up ICs
for (let j = 0; j < 100000 / N; ++j) {
  create();
  setProperties();
  directSetProperties();
  withoutDefaults();
}

await new Promise((resolve) => setTimeout(resolve, 1000));

let start;
function measure(label) {
  const ms = performance.now() - start;
  console.log(
    `\x1b[33m${ms}ms (${(ms / entities.length * 1000).toFixed(4)}\x1b[0mμs/op)`,
    label,
  );
}

console.log(N, 'entities');

start = performance.now();
create();
measure('create');

start = performance.now();
setProperties();
measure('set properties');

start = performance.now();
directSetProperties();
measure('direct set properties');

start = performance.now();
withoutDefaults();
measure('without defaults');
