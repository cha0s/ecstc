import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';

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
    const O = new PropertyRegistry[type]('n', {
      defaultValue: 2,
    });
    const receiver = O.define({});
    expect(receiver.n).to.equal(2);
  })
});
