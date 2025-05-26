import {expect, test} from 'vitest';

import {Components} from './testing.js';

const {Position} = Components;

test('smoke', () => {
  expect(() => new Position.Pool(Position)).not.toThrowError();
});

test('reuse', () => {
  const positionPool = new Position.Pool(Position);
  const position = positionPool.allocate(1);
  positionPool.free(1);
  expect(position).to.equal(positionPool.allocate(1));
});
