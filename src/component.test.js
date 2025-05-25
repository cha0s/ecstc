import {expect, test} from 'vitest';

import {Position} from './test/components.js';

test('smoke', () => {
  let key;
  const position = new Position();
  position.initialize((key_) => { key = key_; })
  position.x = 1;
  expect(key).to.equal('x');
});
