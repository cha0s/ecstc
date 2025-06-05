import {expect, test} from 'vitest';

import {Components} from './testing.js';
import Component from './component.js';
import {Diff, Dirty, MarkClean, ToJSONWithoutDefaults} from './property.js';

const {Position} = Components;

function instance(Component) {
  return new Component.Pool(Component).allocate();
}

test('smoke', () => {
  expect(() => instance(Position)).not.toThrowError();
});

test('invalidation', () => {
  const position = instance(Position);
  position.x = 1;
  expect(position[Diff]()).to.deep.equal({x: 1, y: 0});
  position[MarkClean]();
  expect(position[Diff]()).to.deep.equal({});
  position[Dirty].fill(~0);
  expect(position[Diff]()).to.deep.equal({x: 1, y: 0});
});

test('nested invalidation', () => {
  class Nested extends Component {
    static properties = {
      a: {type: 'array', element: {type: 'string'}},
      o: {type: 'object', properties: {p: {type: 'string'}}},
      m: {type: 'map', key: {type: 'string'}, value: {type: 'string'}},
      s: {type: 'float32'},
    };
  }
  const nested = instance(Nested);
  nested.a.push('blah');
  nested.m.set('foo', 'bar')
  nested.o.p = 'hi';
  nested.s = 123.456;
  expect(nested[Diff]()).to.deep.equal({
    a: {0: 'blah'},
    m: [['foo', 'bar']],
    o: {p: 'hi'},
    s: 123.456,
  });
  expect(nested.a[Diff]()).to.deep.equal({0: 'blah'});
  expect(nested.m[Diff]()).to.deep.equal([['foo', 'bar']]);
  expect(nested.o[Diff]()).to.deep.equal({p: 'hi'});
  nested[MarkClean]();
  expect(nested[Diff]()).to.deep.equal({});
  expect(nested.a[Diff]()).to.deep.equal({});
  expect(nested.m[Diff]()).to.deep.equal([]);
  expect(nested.o[Diff]()).to.deep.equal({});
});

test('disallows reserved properties', () => {
  const {reservedProperties} = Component;
  for (const propertyName of reservedProperties) {
    class BadComponent extends Component {
      static properties = {
        [propertyName]: {type: 'bool'},
      };
    }
    expect(() => instance(BadComponent)).toThrowError(`reserved property '${propertyName}'`);
  }
});

test('collection', () => {
  class DependencyComponent extends Component {}
  class DependentComponent extends Component {
    static dependencies = ['DependencyComponent'];
  }
  let collection = Component.createCollection({DependentComponent, DependencyComponent});
  expect(collection.resolve({DependentComponent: {}})).to.deep.equal(new Set([
    'DependencyComponent',
    'DependentComponent',
  ]));
  expect(Object.keys(collection.components).sort()).to.deep.equal([
    'DependencyComponent',
    'DependentComponent',
  ]);
  collection = Component.createCollection({DependencyComponent, DependentComponent});
  expect(collection.resolve({DependentComponent: {}})).to.deep.equal(new Set([
    'DependencyComponent',
    'DependentComponent',
  ]));
  expect(Object.keys(collection.components).sort()).to.deep.equal([
    'DependencyComponent',
    'DependentComponent',
  ]);
  expect(collection.resolve({DependentComponent: {}, NonExistent: {}})).to.deep.equal(new Set([
    'DependencyComponent',
    'DependentComponent',
  ]));
});

test('toJSONWithoutDefaults', () => {
  class NestedAndScalar extends Component {
    static properties = {
      o: {type: 'object', properties: {p: {type: 'string'}}},
      s: {type: 'string'},
    };
  }
  const component = instance(NestedAndScalar);
  expect(component[ToJSONWithoutDefaults]()).to.be.undefined;
  component.s = 'foo';
  expect(component[ToJSONWithoutDefaults]()).to.deep.equal({s: 'foo'});
  expect(component[ToJSONWithoutDefaults]({s: 'foo'})).to.be.undefined;
});

test('chunk storage', () => {
  class FloatComponent extends Component {
    static properties = {
      f: {type: 'float32'},
    };
  }
  const pool = new FloatComponent.Pool(FloatComponent);
  const chunkSize = 65536 / pool.width;
  for (let i = 1; i <= chunkSize * 2; ++i) {
    pool.allocate().f = i;
  }
  const typedArray = new Float32Array(chunkSize * 2);
  for (let i = 0; i < 2; ++i) {
    for (let j = 1; j <= chunkSize; ++j) {
      typedArray[chunkSize * i + j - 1] = i * chunkSize + j;
    }
  }
  expect(new Float32Array(pool.data.buffer)).to.deep.equal(typedArray);
});
