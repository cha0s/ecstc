import {expect, test} from 'vitest';

import {Components} from './testing.js';
import {Diff, Dirty, MarkClean, ToJSON} from './property.js';

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
  new Uint8Array(pool.dirty.memory.buffer).fill(0);
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

test('dirty remap', () => {
  const pool = new Position.Pool(Position);
  for (let i = 0; i < 65535; ++i) {
    pool.allocate();
  }
  const originalDirtyWindow = pool.instances.get(0)[Dirty];
  pool.allocate(); // 65536; capacity
  expect(pool.instances.get(0)[Dirty]).to.equal(originalDirtyWindow);
  pool.allocate(); // 65537; new dirty buffer
  expect(pool.instances.get(0)[Dirty]).not.to.equal(originalDirtyWindow);
});
