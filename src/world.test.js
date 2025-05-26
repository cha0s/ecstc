import {expect, test} from 'vitest';

import World from './world.js';

test('smoke', () => {
  expect(() => new World()).not.toThrowError();
});
