import {expect, test} from 'vitest';

import {OnInvalidate} from './property.js';

import {Position} from './test/components.js';

test('storage', () => {
  const positionStorage = new Position.Storage(Position);
  const position = positionStorage.create(1, {x: 2, y: 3});
  expect(position.toJSON()).to.deep.equal({x: 2, y: 3});
});
