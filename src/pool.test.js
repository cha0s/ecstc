import {expect, test} from 'vitest';

import {Components} from './test/components.js';

const {Position} = Components;

test('smoke', () => {
  const positionPool = new Position.Pool(Position);
  const position = positionPool.allocate(1);
  position.set({x: 2, y: 3});
  expect(position.toJSON()).to.deep.equal({x: 2, y: 3});
});
