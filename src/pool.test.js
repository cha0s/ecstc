import {expect, test} from 'vitest';

import {Components} from './testing.js';

const {Position} = Components;

test('smoke', () => {
  expect(() => new Position.Pool(Position)).not.toThrowError();
});

test('reuse', () => {
  const positionPool = new Position.Pool(Position);
  const position = positionPool.allocate();
  positionPool.free(position);
  expect(position).to.equal(positionPool.allocate());
});
