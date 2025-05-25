import {expect, test} from 'vitest';

import {Components} from './test/components.js';

const {Position} = Components;

test('smoke', () => {
  let key;
  const position = new Position();
  position.initialize((key_) => { key = key_; })
  position.x = 1;
  expect(key).to.equal('x');
});
