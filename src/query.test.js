import {expect, test} from 'vitest';

import Query from './query.js';
import {fakeEnvironment} from './test/components.js';

const {one, two, three} = fakeEnvironment();

function expectQuery(parameters, expected) {
  const query = new Query(parameters);
  query.reindex(one);
  query.reindex(two);
  query.reindex(three);
  expect(Array.from(query.select()).map(({id}) => id)).to.deep.equal(expected);
}

test('query all', () => {
  expectQuery([], [1, 2, 3]);
});

test('query some', () => {
  expectQuery(['A'], [2, 3]);
  expectQuery(['A', 'B'], [2]);
});

test('query excluding', () => {
  expectQuery(['!A'], [1]);
  expectQuery(['A', '!B'], [3]);
});

test('deindex', () => {
  const query = new Query(['A']);
  query.reindex(one);
  query.reindex(two);
  query.reindex(three);
  expect(query.count).to.equal(2);
  query.deindex(two);
  expect(query.count).to.equal(1);
});

test('reindex', () => {
  const query = new Query(['B']);
  query.reindex(one);
  query.reindex(two);
  expect(query.count).to.equal(2);
  two.removeComponent('B');
  query.reindex(two);
  expect(query.count).to.equal(1);
});

test('select', () => {
  const query = new Query(['A']);
  query.reindex(one);
  query.reindex(two);
  query.reindex(three);
  const it = query.select();
  let result;
  result = it.next();
  expect(result.done).to.be.false;
  expect(result.value.id).to.equal(2);
  result = it.next();
  expect(result.done).to.be.false;
  expect(result.value.id).to.equal(3);
  result = it.next();
  expect(result.done).to.be.true
});
