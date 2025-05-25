import {Codecs, Schema} from 'crunches';
import {expect, test} from 'vitest';

import registerCodecs from './codecs';
import {ComponentRegistry} from './register.js';
import World from './world.js';

import './test/components.js';

registerCodecs(Codecs);

test('smoke world', () => {
  const schema = new Schema({
    type: 'ecstc-world',
    Components: ComponentRegistry,
    optional: true,
  });
  const world = new World({Components: ComponentRegistry});
  world.create({Position: {x: 1}});
  expect(world.diff()).to.deep.equal(schema.decode(schema.encode(world.diff())));
});

test('smoke component', () => {
  const schema = new Schema({
    type: 'ecstc-component',
    properties: ComponentRegistry.Position.properties,
    optional: true,
  });
  const world = new World({Components: ComponentRegistry});
  const entity = world.create({Position: {x: 1}});
  expect(entity.Position.toJSON()).to.deep.equal(schema.decode(schema.encode(entity.Position)));
});
