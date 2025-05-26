import World from '../src/world.js';

import {Components} from '../src/testing.js';

const {Position} = Components;

const world = new World({Components: {Position}});
const entities = Array(10000);
const positions = Array(entities.length);
const values = Array(entities.length).fill(0).map(() => Math.random());

function create() {
  for (let i = 0; i < entities.length; ++i) {
    entities[i] = world.createSpecific(i + 1, {Position: {x: 1.0}});
  }
}

function setProperties() {
  for (let i = 0; i < entities.length; ++i) {
    if (i & 1) {
      entities[i].Position.x = values[i];
    }
    else {
      entities[i].Position.y = values[i];
    }
  }
}

function withoutDefaults() {
  for (let i = 0; i < entities.length; ++i) {
    positions[i] = entities[i].toJSONWithoutDefaults();
  }
}

// warm up ICs
for (let j = 0; j < 100; ++j) {
  create();
  setProperties();
  withoutDefaults();
}

let start;
function measure(label) {
  console.log(
    `\x1b[33m${((performance.now() - start) / entities.length * 1000).toFixed(4)}\x1b[0mμs`,
    label,
  );
}
start = performance.now();
create();
measure('create');

start = performance.now();
setProperties();
measure('set properties');

start = performance.now();
withoutDefaults();
measure('without defaults');
