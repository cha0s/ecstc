import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';
import {Diff, MarkClean, MarkDirty, ToJSON} from '../property.js';

test('map', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'object',
      properties: {
        x: {type: 'uint8'},
      },
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m.set(0, {y: 1});
  receiver.m.set(1, {x: 3});
  expect(receiver.m[ToJSON]()).to.deep.equal([[0, {x: 0}], [1, {x: 3}]]);
  expect(receiver.m[Diff]()).to.deep.equal([[0, {x: 0}], [1, {x: 3}]]);

  receiver.m[MarkClean]();
  receiver.m = [[0, {x: 7}]];
  expect(receiver.m[ToJSON]()).to.deep.equal([[0, {x: 7}], [1, {x: 3}]]);
  expect(receiver.m[Diff]()).to.deep.equal([[0, {x: 7}]]);
});

test('nested invalidation', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'object',
      properties: {
        x: {type: 'uint8'},
      },
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m.set(0, {x: 2});
  receiver.m[MarkClean]();
  receiver.m.get(0).x = 4;
  expect(receiver.m[Diff]()).to.deep.equal([[0, {x: 4}]]);
});

test('scalar map', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'uint8',
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m.set(0, 1);
  expect(receiver.m[Diff]()).to.deep.equal([[0, 1]]);

  receiver.m = [[0, 2], [1, 3], [2, 4]];
  expect(receiver.m[Diff]()).to.deep.equal([[0, 2], [1, 3], [2, 4]]);
});

test('deletion', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'uint8',
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m.set(0, 1);
  receiver.m.set(1, 2);
  receiver.m[MarkClean]();
  receiver.m.delete(0);
  expect(receiver.m[Diff]()).to.deep.equal([[0]]);
  receiver.m[MarkClean]();
  receiver.m = [[2]];
  expect(receiver.m[Diff]()).to.deep.equal([[2]]);
});

test('toJSON', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'uint8',
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m = new Map([[1, 2], [3, 4], [5, 6]]);
  expect(receiver.m[ToJSON]()).to.deep.equal([[1, 2], [3, 4], [5, 6]]);
});

test('dirty nesting', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'object',
      properties: {
        x: {type: 'uint8'},
      },
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m = new Map([[0, {x: 1}]]);
  expect(receiver.m[Diff]()).to.deep.equal([[0, {x: 1}]]);
  receiver.m[MarkClean]();
  expect(receiver.m[Diff]()).to.deep.equal([]);
});

test('dirty scalar', () => {
  const M = new PropertyRegistry.map({
    key: {type: 'uint8'},
    value: {
      type: 'uint8',
    },
  }, 'm');
  const receiver = Object.defineProperties({}, M.definitions());
  receiver.m = new Map([[1, 2], [3, 4], [5, 6]]);
  receiver.m[MarkClean]();
  expect(receiver.m[Diff]()).to.deep.equal([]);
  receiver.m[MarkDirty](1);
  receiver.m[MarkDirty](3);
  receiver.m[MarkDirty](5);
  expect(receiver.m[Diff]()).to.deep.equal([[1, 2], [3, 4], [5, 6]]);
});
