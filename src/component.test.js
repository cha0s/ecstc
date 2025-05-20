import {expect, test} from 'vitest';

import {OnInvalidate} from './property.js';

import {Position} from './test/components.js';

test('component', () => {
  const position = new Position();
  let key;
  position[OnInvalidate] = (key_) => { key = key_; }
  position.x = 1;
  expect(key).to.equal('x');
});
