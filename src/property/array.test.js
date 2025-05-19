import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';
import {Diff, MarkClean} from '../property.js';

test('array', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'object',
      properties: {
        x: {type: 'uint8'},
      },
    },
  });
  const receiver = O.define({});
  receiver.a.setAt(0, {y: 1});
  receiver.a.setAt(1, {x: 3});
  expect(receiver.a.toJSON()).to.deep.equal([{x: 0}, {x: 3}]);
  expect(receiver.a[Diff]()).to.deep.equal({0: {x: 0}, 1: {x: 3}});
});

test('assignment', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'object',
      properties: {
        x: {type: 'uint8'},
      },
    },
  });
  const receiver = O.define({});
  receiver.a = [{x: 7}];
  expect(receiver.a.toJSON()).to.deep.equal([{x: 7}]);
  expect(receiver.a[Diff]()).to.deep.equal({0: {x: 7}});

  receiver.a[MarkClean]();
  receiver.a = {[Symbol.iterator]: function *() { yield {x: 7} } };
  expect(receiver.a.toJSON()).to.deep.equal([{x: 7}]);
  expect(receiver.a[Diff]()).to.deep.equal({0: {x: 7}});
});

test('scalar array', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'uint8',
    },
  });
  const receiver = O.define({});
  receiver.a.setAt(0, 1);
  expect(receiver.a[Diff]()).to.deep.equal({0: 1});

  receiver.a = [2, 3, 4]
  expect(receiver.a[Diff]()).to.deep.equal({0: 2, 1: 3, 2: 4});
  expect(receiver.a.toJSON()).to.deep.equal([2, 3, 4]);
});

test('deletion', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'uint8',
    },
  });
  const receiver = O.define({});
  receiver.a.setAt(0, 1);
  receiver.a[MarkClean]();
  expect(receiver.a.length).to.equal(1);

  receiver.a = {deleted: [0]}
  expect(receiver.a.length).to.equal(0);
  expect(receiver.a[Diff]()).to.deep.equal({deleted: [0]});
  receiver.a[MarkClean]();

  receiver.a = {1: 2, 3: 4}
  expect(receiver.a.length).to.equal(4);
  expect(receiver.a[Diff]()).to.deep.equal({1: 2, 3: 4});
});

test('push', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'uint8',
    },
  });
  const receiver = O.define({});
  receiver.a.push(1);
  expect(receiver.a[Diff]()).to.deep.equal({0: 1});
});

test('nested array', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'array',
      element: {type: 'uint8'},
    },
  });
  const receiver = O.define({});
  receiver.a.push([1, 2]);
  expect(receiver.a[Diff]()).to.deep.equal({0: {0: 1, 1: 2}});
});

test('nested map', () => {
  const O = new PropertyRegistry.array('a', {
    element: {
      type: 'map',
      element: {type: 'uint8'},
    },
  });
  const receiver = O.define({});
  receiver.a.push([[1, 2]]);
  expect(receiver.a[Diff]()).to.deep.equal({0: [[1, 2]]});
});
