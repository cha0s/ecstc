import {expect, test} from 'vitest';

import {Property} from './property.js';
import {PropertyRegistry} from './register.js';

test('smoke', () => {
  expect(() => new Property).not.toThrowError();
});

test('reactivity', () => {
  const changes = [];
  const onChange = (value) => changes.push(value);
  const number = new PropertyRegistry.uint32(
    {
      onChange,
    },
    'v'
  ).define();
  expect(changes.length).to.equal(0);
  number.v = 0;
  expect(changes.length).to.equal(0);
  number.v = 1;
  expect(changes.length).to.equal(1);
  number.v = 0;
  expect(changes.length).to.equal(2);
  number.v = 0;
  expect(changes.length).to.equal(2);
});

test('nested reactivity', () => {
  const changes = [];
  const nestedChanges = [];
  const onChange = (...args) => { changes.push(args); }
  const number = new PropertyRegistry.object(
    {
      onChange,
      properties: {
        v: {
          onChange: (...args) => { nestedChanges.push(args); },
          type: 'uint32',
        },
      },
    },
    'o'
  ).define();
  expect(nestedChanges.length).to.equal(0);
  expect(changes.length).to.equal(0);
  number.o = {v: 0};
  expect(nestedChanges.length).to.equal(0);
  expect(changes.length).to.equal(0);
  number.o = {v: 1};
  expect(nestedChanges.length).to.equal(1);
  expect(changes.length).to.equal(1);
  number.o.v = 1;
  expect(nestedChanges.length).to.equal(1);
  expect(changes.length).to.equal(1);
  number.o.v = 0;
  expect(nestedChanges.length).to.equal(2);
  expect(changes.length).to.equal(2);
  number.o.v = 0;
  expect(nestedChanges.length).to.equal(2);
  expect(changes.length).to.equal(2);
});

test('storage reactivity', () => {
  const changes = [];
  const onChange = (value) => changes.push(value);
  let realNum = 0;
  const number = new PropertyRegistry.uint32(
    {
      onChange,
      storage: {
        get() {
          return realNum;
        },
        set(O, property, value) {
          realNum = value;
        },
      }
    },
    'v'
  ).define();
  expect(changes.length).to.equal(0);
  number.v = 0;
  expect(changes.length).to.equal(0);
  number.v = 1;
  expect(changes.length).to.equal(1);
  number.v = 0;
  expect(changes.length).to.equal(2);
  number.v = 0;
  expect(changes.length).to.equal(2);
});
