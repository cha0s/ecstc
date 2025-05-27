import {expect, test} from 'vitest';

import {PropertyRegistry} from './register.js';

test('blueprint validation', () => {
  const receiver = {};
  let hit = false;
  new PropertyRegistry.float32('n', {onInvalidate: () => { hit = true; }}).define(receiver);
  expect(hit).to.be.false;
  receiver.n = 1;
  expect(hit).to.be.true;
});
