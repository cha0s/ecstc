import {expect, test} from 'vitest';

import {Diff, Dirty, MarkClean, ToJSON, ToJSONWithoutDefaults} from '../property.js';
import {PropertyRegistry} from '../register.js';

test('json', () => {
  const {o} = new PropertyRegistry.object({
    properties: {
      p: {type: 'uint8'},
    },
  }, 'o').define();
  expect(o[ToJSON]()).to.deep.equal({p: 0});
  expect(o[ToJSONWithoutDefaults]()).to.be.undefined;
  expect(o[ToJSONWithoutDefaults]({p: 2})).to.deep.equal({p: 0});
  o.p = 1;
  expect(o[ToJSONWithoutDefaults]()).to.deep.equal({p: 1});
});

test('set', () => {
  const receiver = new PropertyRegistry.object({
    properties: {
      p: {type: 'uint8'},
    },
  }, 'o').define();
  receiver.o = {p: 3};
  expect(receiver.o.p).to.equal(3);
});

test('reactivity', () => {
  let changeCount = 0;
  let receiver;
  receiver = new PropertyRegistry.object({
    properties: {
      p: {
        onChange: () => { changeCount += 1; },
        type: 'uint8',
      },
    },
  }, 'o').define();
  expect(changeCount).to.equal(0);
  receiver.o = {p: 3};
  expect(changeCount).to.equal(1);
  receiver.o = {p: 3};
  expect(changeCount).to.equal(1);
  receiver.o.p = 4;
  expect(changeCount).to.equal(2);
  receiver.o.p = 4;
  expect(changeCount).to.equal(2);
  receiver.o.p = 5;
  expect(changeCount).to.equal(3);
  changeCount = 0;
  receiver = new PropertyRegistry.object({
    onChange: () => { changeCount += 1; },
    properties: {
      p: {
        type: 'uint8',
      },
    },
  }, 'o').define();
  expect(changeCount).to.equal(0);
  receiver.o = {p: 3};
  expect(changeCount).to.equal(1);
  receiver.o = {p: 3};
  expect(changeCount).to.equal(1);
  receiver.o.p = 4;
  expect(changeCount).to.equal(2);
  receiver.o.p = 4;
  expect(changeCount).to.equal(2);
  receiver.o.p = 5;
  expect(changeCount).to.equal(3);
  changeCount = 0;
  receiver = new PropertyRegistry.object({
    onChange: () => { changeCount += 1; },
    properties: {
      p: {
        onChange: () => { changeCount += 1; },
        type: 'uint8',
      },
    },
  }, 'o').define();
  expect(changeCount).to.equal(0);
  receiver.o = {p: 3};
  expect(changeCount).to.equal(2);
  receiver.o = {p: 3};
  expect(changeCount).to.equal(2);
  receiver.o.p = 4;
  expect(changeCount).to.equal(4);
  receiver.o.p = 4;
  expect(changeCount).to.equal(4);
  receiver.o.p = 5;
  expect(changeCount).to.equal(6);
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
  const receiver = property.define()
  const view = new DataView(new ArrayBuffer(property.width));
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

test('blueprint proxy', () => {
  const object = new new PropertyRegistry.object({
    properties: {
      x: {type: 'uint32'},
    },
    proxy: (Proxy) => class extends Proxy {
      get foo() { return this.x; }
      set foo(x) { this.x = x; }
    },
  }).Instance();
  expect(object.foo).to.equal(0);
  object.x = 34;
  expect(object.foo).to.equal(34);
  object.foo = 12;
  expect(object.x).to.equal(12);
});
