import {expect, test} from 'vitest';

import {Diff, Dirty, MarkClean, ToJSON, ToJSONWithoutDefaults} from '../property.js';
import {PropertyRegistry} from '../register.js';

test('json', () => {
  const O = new PropertyRegistry.object({
    properties: {
      p: {type: 'uint8'},
    },
  }, 'o');
  const receiver = O.define()
  expect(receiver.o[ToJSON]()).to.deep.equal({p: 0});
  expect(receiver.o[ToJSONWithoutDefaults]()).to.be.undefined;
  expect(receiver.o[ToJSONWithoutDefaults]({p: 2})).to.deep.equal({p: 0});
  receiver.o.p = 1;
  expect(receiver.o[ToJSONWithoutDefaults]()).to.deep.equal({p: 1});
});

test('set', () => {
  const O = new PropertyRegistry.object({
    properties: {
      p: {type: 'uint8'},
    },
  }, 'o');
  const receiver = O.define()
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
  const O = new PropertyRegistry.object(blueprint, 'o');
  const receiver = O.define()
  for (let k = 0; k < 64; ++k) {
    const i = k >> 3;
    const j = 1 << (k & 7);
    if (k & 1) {
      receiver.o[k].v = 1;
      expect(receiver.o[Dirty][i] & j).to.equal(j);
    }
  }
  expect(receiver.o[Diff]()).to.deep.equal(
    Object.fromEntries(Array(64).fill(0).map((n, i) => [i, {v: i & 1 ? 1 : 0}])),
  );
  receiver.o[MarkClean]();
  expect(receiver.o[Diff]()).to.deep.equal({});
  for (let k = 0; k < 64; ++k) {
    receiver.o[k][Dirty].fill(~0);
  }
  expect(receiver.o[Diff]()).to.deep.equal(
    Object.fromEntries(Array(64).fill(0).map((n, i) => [i, {v: i & 1 ? 1 : 0}])),
  );
});

test('storage', () => {
  const property = new PropertyRegistry.object({
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
      get(O, {codec}, byteOffset) {
        return codec.decode(view, {byteOffset, isLittleEndian: true});
      },
      set(O, {codec}, value, byteOffset) {
        codec.encode(value, view, byteOffset, true);
      },
    },
  }, 'o');
  const view = new DataView(new ArrayBuffer(property.width));
  const receiver = property.define()
  receiver.o.x = 234;
  receiver.o.p.y = 98736498;
  expect(property.codec.decode(view, {byteOffset: 0, isLittleEndian: true})).to.deep.equal(receiver.o[ToJSON]())
  receiver.o.p = {y: 1};
  expect(property.codec.decode(view, {byteOffset: 0, isLittleEndian: true})).to.deep.equal(receiver.o[ToJSON]())
});

test('concrete', () => {
  const property = new PropertyRegistry.object({
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
      get(O, {codec}, byteOffset) {
        return codec.decode(view, {byteOffset});
      },
      set(O, {codec}, value, byteOffset) {
        codec.encode(value, view, byteOffset);
      },
    },
  }, 'o');
  const object = new property.Instance();
  const view = new DataView(new ArrayBuffer(property.width));
  object.x = 234;
  object.p.y = 98736498;
  expect(property.codec.decode(view, {byteOffset: 0})).to.deep.equal(object[ToJSON]())
  object.p = {y: 1};
  expect(property.codec.decode(view, {byteOffset: 0})).to.deep.equal(object[ToJSON]())
});
