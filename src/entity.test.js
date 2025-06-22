import {expect, test} from 'vitest';

import Entity from './entity.js';
import {fakeEnvironment} from './testing.js';

test('smoke', () => {
  expect(() => {new Entity()}).not.toThrowError();
});

test('remove component', () => {
  const {two} = fakeEnvironment();
  two.removeComponent('B');
  expect(two.diff()).to.deep.equal({B: false});
});

test('mark clean', () => {
  const {one, world} = fakeEnvironment();
  one.B.b = 4;
  expect(one.diff()).to.deep.equal({B: {b: 4}});
  world.markClean();
  expect(one.diff()).to.deep.equal({});
});

test('set', () => {
  const {three, two} = fakeEnvironment();
  two.set({B: {b: 16}});
  expect(two.diff()).to.deep.equal({B: {b: 16}});
  three.set({B: {b: 16}});
  expect(three.B.b).to.equal(16);
  three.set({B: false});
  expect(three.B).to.be.null;
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

test('destroy components', () => {
  const {two} = fakeEnvironment();
  two.destroyComponents();
  expect(two.A).to.be.null;
  expect(two.B).to.be.null;
  expect(two.C).to.be.null;
})
