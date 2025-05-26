import {expect, test} from 'vitest';

import Entity from './entity.js';
import {fakeEnvironment} from './testing.js';

test('smoke', () => {
  expect(() => new Entity()).not.toThrowError();
});

test('remove component', () => {
  const {two} = fakeEnvironment();
  two.removeComponent('B');
  expect(two.diff()).to.deep.equal({B: false});
});

test('set component', () => {
  const {two} = fakeEnvironment();
  two.B.set({b: 16});
  expect(two.diff()).to.deep.equal({B: {b: 16}});
});

test('toJSON', () => {
  const {two} = fakeEnvironment();
  expect(two.toJSON()).to.deep.equal({A: {a: 64}, B: {b: 32}, C: {c: 0}});
});

test('toJSONWithoutDefaults', () => {
  const {two} = fakeEnvironment();
  expect(two.toJSONWithoutDefaults()).to.deep.equal({});
  two.C.c = 8;
  expect(two.toJSONWithoutDefaults()).to.deep.equal({C: {c: 8}});
  expect(two.toJSONWithoutDefaults({C: {c: 8}})).to.deep.equal({});
});
