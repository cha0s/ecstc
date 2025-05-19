import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';
import {Diff, MarkClean} from './object.js';

test('object', () => {

  const O = new PropertyRegistry.object('o', {
    properties: {
      p: {
        type: 'object',
        properties: {
          x: {
            defaultValue: 2,
            type: 'uint8',
          },
          y: {
            defaultValue: 3,
            type: 'uint8',
          },
        },
      },
    },
  });

  const receiver = O.define({});
  expect(receiver.o.p.x).to.equal(2);

  receiver.o.p.x = 3;
  expect(receiver.o[Diff]()).to.deep.equal({p: {x: 3}})

  receiver.o[MarkClean]();
  receiver.o.p.y = 4;
  expect(receiver.o[Diff]()).to.deep.equal({p: {y: 4}})

  receiver.o.p = {x: 1, y: 2};
  expect(receiver.o[Diff]()).to.deep.equal({p: {x: 1, y: 2}})

  receiver.o[MarkClean]();
  receiver.o.p.y = 5;
  expect(receiver.o[Diff]()).to.deep.equal({p: {y: 5}})
  expect(receiver.o.p[O.properties.p.properties.y.Storage].previous).to.equal(2);
});
