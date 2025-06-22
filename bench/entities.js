import World from '../src/world.js';

import {Components} from '../src/testing.js';

const {Position, PositionWithString} = Components;

const world = new World({Components: {Position, PositionWithString}});
const N = 100000;
const entities = Array(N);
const positions = Array(entities.length);

function create() {
  for (let i = 0; i < entities.length; ++i) {
    entities[i] = world.createSpecific(i + 1, {Position: {x: 1.0}});
  }
}

function createWithString() {
  for (let i = 0; i < entities.length; ++i) {
    entities[i] = world.createSpecific(i + 1, {PositionWithString: {x: 1.0}});
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

function directSetProperties() {
  const {pool} = world.collection.components.Position;
  let position = 0;
  const {data, dirty} = pool;
  const dirtyArray = new Uint8Array(dirty.memory.buffer);
  const array = new Float32Array(data.memory.buffer);
  for (let i = 0, j = 0; i < entities.length; ++i, j += 2) {
    array[j + (i & 1)] = position++;
    dirtyArray[j >> 3] |= 1 << (j & 7);
  }
}

function setWithStringProperties() {
  for (let i = 0; i < entities.length; ++i) {
    if (0 === (i & 1)) {
      entities[i].PositionWithString.x = i;
    }
    else {
      entities[i].PositionWithString.y = i;
    }
  }
}

function withoutDefaults() {
  for (let i = 0; i < entities.length; ++i) {
    positions[i] = entities[i].toJSONWithoutDefaults();
  }
}

function diff() {
  return world.diff();
}

function markClean() {
  for (let i = 0; i < entities.length; ++i) {
    entities[i].Position.x = 1.0;
    entities[i].Position.y = 0;
  }
  world.markClean();
}

function markCleanWithString() {
  for (let i = 0; i < entities.length; ++i) {
    entities[i].PositionWithString.x = 1.0;
    entities[i].PositionWithString.y = 0;
  }
  world.markClean();
}

let start;
function measure(label) {
  const ms = performance.now() - start;
  console.log(
    `\x1b[33m${ms.toFixed(2).padStart(7, ' ')}\x1b[0mms`,
    `(\x1b[33m${(ms / entities.length * 1000).toFixed(4)}\x1b[0mμs/op)`,
    `(\x1b[33m${Math.floor(N * (16.6 / ms)).toLocaleString().padStart(10, ' ')}\x1b[0m/tick)`,
    'to',
    label,
  );
}

const localeN = N.toLocaleString();
console.log(localeN, 'entities (buffer)');
console.log('='.repeat(localeN.length + 1 + 'entities (buffer)'.length));

start = performance.now();
create();
measure('create');

start = performance.now();
setProperties();
measure('set properties');

start = performance.now();
directSetProperties();
measure('set properties with direct buffer access');

start = performance.now();
withoutDefaults();
measure('create JSON without defaults');

markClean();
directSetProperties();
start = performance.now();
measure(`diff ${diff().size.toLocaleString()} changes`);

markClean();
directSetProperties();
start = performance.now();
world.markClean();
measure('mark clean');

start = performance.now();
diff()
measure('diff no changes');

markClean();
start = performance.now();
directSetProperties();
diff();
markClean();
measure('tick');

console.log(localeN, 'entities (vm)');
console.log('='.repeat(localeN.length + 1 + 'entities (vm)'.length));

world.clear();
start = performance.now();
createWithString();
measure('create');

start = performance.now();
setWithStringProperties();
measure('set properties');

start = performance.now();
withoutDefaults();
measure('create JSON without defaults');

markCleanWithString()
setWithStringProperties();
start = performance.now();
measure(`diff ${diff().size.toLocaleString()} changes`);

markCleanWithString()
setWithStringProperties();
start = performance.now();
world.markClean();
measure('mark clean');

start = performance.now();
diff()
measure('diff no changes');

markCleanWithString()
start = performance.now();
setWithStringProperties();
diff();
markCleanWithString()
measure('tick');
