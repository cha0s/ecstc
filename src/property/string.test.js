import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';

test('string', () => {
  expect(Object.defineProperties({}, new PropertyRegistry.string({}, 's').definitions()).s).to.equal('');
  expect(Object.defineProperties({}, new PropertyRegistry.string({defaultValue: 'hi'}, 's').definitions()).s).to.equal('hi');
});
