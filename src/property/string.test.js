import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';

test('string', () => {
  expect(new PropertyRegistry.string({}, 's').define().s).to.equal('');
  expect(new PropertyRegistry.string({defaultValue: 'hi'}, 's').define().s).to.equal('hi');
});
