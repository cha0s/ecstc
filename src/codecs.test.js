import {Codecs, Schema} from 'crunches';
import {expect, test} from 'vitest';

import registerCodecs from './codecs';
import {ToJSON} from './property.js';
import World from './world.js';

import {Components} from './testing.js';

const {Position} = Components;

registerCodecs(Codecs);

test('world', () => {
  const schema = new Schema({
    type: 'ecstc-world',
    Components,
    optional: true,
  });
  const world = new World({Components});
  world.create({Position: {x: 1}});
  expect(world.diff()).to.deep.equal(schema.decode(schema.encode(world.diff())));
});

test('component', () => {
  const schema = new Schema({
    type: 'ecstc-component',
    properties: Position.properties,
    optional: true,
  });
  const world = new World({Components});
  const entity = world.create({Position: {x: 1}});
  expect(entity.Position[ToJSON]()).to.deep.equal(schema.decode(schema.encode(entity.Position)));
});
