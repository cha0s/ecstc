import {expect, test} from 'vitest';

import {Components} from './testing.js';
import {Diff, MarkClean, ToJSON} from './property.js';

const {Position} = Components;

test('smoke', () => {
  expect(() => new Position.Pool(Position)).not.toThrowError();
});

test('reuse', () => {
  const positionPool = new Position.Pool(Position);
  const position = positionPool.allocate();
  positionPool.free(position);
  expect(position).to.equal(positionPool.allocate());
});

test('chunk invalidation', () => {
  const pool = new Position.Pool(Position);
  const component = pool.allocate();
  component.x = 123;
  expect(component[Diff]()).to.deep.equal({x: 123, y: 0});
  pool.chunks[0].dirty.fill(0);
  expect(component[Diff]()).to.deep.equal({});
});

test('reset invalidation', () => {
  const pool = new Position.Pool(Position);
  let component = pool.allocate();
  expect(component[Diff]()).to.deep.equal({x: 0, y: 0});
  component.x = 123;
  component[MarkClean]();
  pool.free(component);
  component = pool.allocate({x: 0, y: 0});
  expect(component[Diff]()).to.deep.equal({x: 0, y: 0});
  expect(component[ToJSON]()).to.deep.equal({x: 0, y: 0});
});
