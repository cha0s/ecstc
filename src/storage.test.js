import {expect, test} from 'vitest';

import {Position} from './test/components.js';

test('storage', () => {
  const positionStorage = new Position.Storage(Position);
  const position = positionStorage.create(1);
  position.set({x: 2, y: 3});
  expect(position.toJSON()).to.deep.equal({x: 2, y: 3});
});
