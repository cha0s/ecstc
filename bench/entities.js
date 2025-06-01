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

const LocalPosition = world.Components.Position;
function directSetProperties() {
  const {pool} = LocalPosition;
  let i = 0;
  for (const {chunk, column, offset} of pool.instances) {
    const {dirty, view} = pool.chunks[chunk];
    const field = column & 1;
    view.setFloat32(offset + field * 4, i, true);
    dirty[column] |= 1 << field;
    i += 1;
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
