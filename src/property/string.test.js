import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';

test('string', () => {
  expect(new PropertyRegistry.string('s', {}).define({}).s).to.equal('');
  expect(new PropertyRegistry.string('s', {defaultValue: 'hi'}).define({}).s).to.equal('hi');
});
