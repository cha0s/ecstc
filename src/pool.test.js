import {expect, test} from 'vitest';

import {Components} from './testing.js';
import {ToJSON} from './property.js';

const {Position} = Components;

test('smoke', () => {
  const positionPool = new Position.Pool(Position);
  const position = positionPool.allocate(1);
  position.set({x: 2, y: 3});
  expect(position[ToJSON]()).to.deep.equal({x: 2, y: 3});
});
