import {expect, test} from 'vitest';

import {Diff, Dirty, MarkClean, MarkDirty, ToJSON} from '../property.js';
import {PropertyRegistry} from '../register.js';

test('json', () => {
  const O = new PropertyRegistry.object('o', {
    properties: {
      p: {type: 'uint8'},
    },
  });
  const receiver = O.define({});
  expect(receiver[O.toJSONKey]()).to.deep.equal({p: 0});
  expect(receiver[O.toJSONWithoutDefaultsKey]()).to.be.undefined;
  expect(receiver[O.toJSONWithoutDefaultsKey]({p: 2})).to.deep.equal({p: 0});
  receiver.o.p = 1;
  expect(receiver[O.toJSONWithoutDefaultsKey]()).to.deep.equal({p: 1});
});

test('set', () => {
  const O = new PropertyRegistry.object('o', {
    properties: {
      p: {type: 'uint8'},
    },
  });
  const receiver = O.define({});
  receiver.o = {p: 3};
  expect(receiver.o.p).to.equal(3);
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

test('storage', () => {
  const property = new PropertyRegistry.object('o', {
    properties: {
      x: {type: 'uint32'},
      p: {
        type: 'object',
        properties: {
          y: {type: 'uint32'},
        },
      },
    },
    storage: {
      get(O, codec, offset) {
        return codec.decode(view, {byteOffset: offset});
      },
      set(O, codec, value, offset) {
        codec.encode(value, view, offset);
      },
    },
  });
  const view = new DataView(new ArrayBuffer(property.width));
  const receiver = property.define({});
  receiver.o.x = 234;
  receiver.o.p.y = 98736498;
  expect(property.codec.decode(view, {byteOffset: 0})).to.deep.equal(receiver[property.toJSONKey]())
  receiver.o.p = {y: 1};
  expect(property.codec.decode(view, {byteOffset: 0})).to.deep.equal(receiver[property.toJSONKey]())
});

test('concrete', () => {
  const property = new PropertyRegistry.object('o', {
    properties: {
      x: {type: 'uint32'},
      p: {
        type: 'object',
        properties: {
          y: {type: 'uint32'},
        },
      },
    },
    storage: {
      get(O, codec, offset) {
        return codec.decode(view, {byteOffset: offset});
      },
      set(O, codec, value, offset) {
        codec.encode(value, view, offset);
      },
    },
  });
  const object = new property.Instance();
  const view = new DataView(new ArrayBuffer(property.width));
  object.x = 234;
  object.p.y = 98736498;
  expect(property.codec.decode(view, {byteOffset: 0})).to.deep.equal(object[ToJSON]())
  object.p = {y: 1};
  expect(property.codec.decode(view, {byteOffset: 0})).to.deep.equal(object[ToJSON]())
});
