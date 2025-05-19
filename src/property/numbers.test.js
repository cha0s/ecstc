import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';

test('bool', () => {
  expect(new PropertyRegistry.bool('b', {}).define({}).b).to.equal(false);
  expect(new PropertyRegistry.bool('b', {defaultValue: true}).define({}).b).to.equal(true);
});

test('number', () => {
  [
    'float32',
    'float64',
    'int8',
    'int16',
    'int32',
    'uint8',
    'uint16',
    'uint32',
    'varint',
    'varuint',
  ].forEach((type) => {
    expect(new PropertyRegistry[type]('n', {}).define({}).n).to.equal(0);
    expect(new PropertyRegistry[type]('n', {defaultValue: 2}).define({}).n).to.equal(2);
  })
});
