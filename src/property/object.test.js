import {expect, test} from 'vitest';

import {Diff, Dirty, MarkClean, MarkDirty} from '../property.js';
import {PropertyRegistry} from '../register.js';

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
            previous: true,
            type: 'uint8',
          },
        },
      },
    },
  });
  // defaults
  const receiver = O.define({});
  expect(receiver.o.p.x).to.equal(2);
  // object set
  receiver.o.p = {x: 1, y: 2};
  expect(receiver.o[Diff]()).to.deep.equal({p: {x: 1, y: 2}})
  // changes
  receiver.o[MarkClean]();
  receiver.o.p.x = 4;
  receiver.o.p.y = 5;
  expect(receiver.o[Diff]()).to.deep.equal({p: {x: 4, y: 5}})
  // previous
  expect(receiver.o.p[O.properties.p.properties.y.Storage].previous).to.equal(2);
  // toJSON
  expect(receiver.o.toJSON()).to.deep.equal({p: {x: 4, y: 5}});
  // idempotent diff
  receiver.o[MarkClean]();
  receiver.o.p.x = 5;
  const diff = receiver.o[Diff]();
  receiver.o.p.x = 6;
  receiver.o[MarkClean]();
  receiver.o = diff;
  expect(receiver.o[Diff]()).to.deep.equal(diff);
  // lazy diff
  receiver.o[MarkClean]();
  receiver.o.p.x = 5;
  expect(receiver.o[Diff]()).to.deep.equal({});
});

test('dirty spill', () => {
  const blueprint = {
    properties: {},
  };
  for (let k = 0; k < 64; ++k) {
    blueprint.properties[k] = {
      type: 'object',
      properties: {v: {type: 'uint8'}}
    };
  }
  const O = new PropertyRegistry.object('o', blueprint);
  const receiver = O.define({});
  for (let k = 0; k < 64; ++k) {
    const i = k >> 5;
    const j = 1 << (k & 31);
    if (k & 1) {
      receiver.o[k].v = 1;
      expect(receiver.o[Dirty][i] & j).to.equal(j);
    }
  }
  expect(receiver.o[Diff]()).to.deep.equal(
    Object.fromEntries(Array(32).fill(0).map((n, i) => [(i * 2) + 1, {v: 1}])),
  );
  receiver.o[MarkClean]();
  expect(receiver.o[Diff]()).to.deep.equal({});
  receiver.o[MarkDirty]();
  expect(receiver.o[Diff]()).to.deep.equal(
    Object.fromEntries(Array(64).fill(0).map((n, i) => [i, {v: i & 1 ? 1 : 0}])),
  );
});
