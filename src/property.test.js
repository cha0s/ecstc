import {expect, test} from 'vitest';

import {PropertyRegistry} from './register.js';

test('nested object', () => {

  const O = new PropertyRegistry.object('o', {
    onChange: console.log,
    properties: {
      p: {
        type: 'object',
        properties: {
          x: {
            defaultValue: 2,
            type: 'uint8',
          },
        },
      }
    },
  });

  const receiver = {};
  O.define(receiver);

  expect(receiver.o.p.x).to.equal(2);
  receiver.o.p.x = 3;

})
