import {Codecs, Schema} from 'crunches';
import {expect, test} from 'vitest';

import registerCodecs from './codecs';
import World from './world.js';

import {Components} from './testing.js';

const {Codec} = Components;

registerCodecs(Codecs);

test('world', () => {
  const schema = new Schema({
    type: 'ecstc-world',
    Components,
    optional: true,
  });
  const world = new World({Components});
  world.create({Position: {x: 1}});
  world.destroyEntityImmediately(world.create({Position: {x: 1}}))
  world.create({Position: {x: 1}}).removeComponent('Position');
  expect(world.diff()).to.deep.equal(schema.decode(schema.encode(world.diff())));
});

test('component', () => {
  const schema = new Schema({
    type: 'ecstc-component',
    properties: Codec.properties,
    optional: true,
  });
  const world = new World({Components});
  const entity = world.create({
    Codec: {
      a: [1, 2, 3],
      m: [[1, 2], [3, 4]],
    },
  });
  expect(schema.decode(schema.encode(entity.Codec))).to.deep.equal({
    a: new Uint8Array([1, 2, 3]),
    m: new Map([[1, 2], [3, 4]]),
    o: {p: 0},
  });
});

test('coerced map', () => {
  const schema = new Schema({
    type: 'ecstc-coerced-map',
    key: {type: 'uint8'},
    value: {
      type: 'object',
      properties: {
        maybeValue: {type: 'uint8', optional: true},
      },
    },
  });
  expect(schema.decode(schema.encode([[1, 2], [3, undefined]]))).to.deep.equal(
    new Map([[1, 2], [3, undefined]]),
  );
  expect(schema.decode(schema.encode({1: 2, 3: undefined}))).to.deep.equal(
    new Map([[1, 2], [3, undefined]]),
  );
});

test('sparse array', () => {
  const schema = new Schema({
    type: 'ecstc-sparse-array',
    element: {type: 'uint8'},
  });
  expect(schema.decode(schema.encode([1, 2, 3]))).to.deep.equal(new Uint8Array([1, 2, 3]));
  expect(schema.decode(schema.encode({0: 1, 2: 3}))).to.deep.equal({0: 1, 2: 3});
});
