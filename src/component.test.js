import {expect, test} from 'vitest';

import {Components} from './testing.js';
import Component from './component.js';
import {Diff, MarkClean, MarkDirty, ToJSONWithoutDefaults} from './property.js';

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
  position[MarkDirty]('x');
  position[MarkDirty]('y');
  expect(position[Diff]()).to.deep.equal({x: 1, y: 0});
});

test('nested invalidation', () => {
  class Nested extends Component {
    static properties = {
      a: {type: 'array', element: {type: 'string'}},
      o: {type: 'object', properties: {p: {type: 'string'}}},
      m: {type: 'map', key: {type: 'string'}, value: {type: 'string'}},
    };
  }
  const nested = instance(Nested);
  nested.a.push('blah');
  nested.m.set('foo', 'bar')
  nested.o.p = 'hi';
  expect(nested[Diff]()).to.deep.equal({
    a: {0: 'blah'},
    m: [['foo', 'bar']],
    o: {p: 'hi'},
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

test('sorting', () => {
  class DependencyComponent extends Component {}
  class DependentComponent extends Component {
    static dependencies = ['DependencyComponent'];
  }
  expect(Component.instantiate({DependentComponent, DependencyComponent}).sortedComponentNames).to.deep.equal([
    'DependencyComponent',
    'DependentComponent',
  ]);
  expect(Component.instantiate({DependencyComponent, DependentComponent}).sortedComponentNames).to.deep.equal([
    'DependencyComponent',
    'DependentComponent',
  ]);
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
  const {chunkSize} = FloatComponent.Pool;
  const pool = new FloatComponent.Pool(FloatComponent);
  for (let i = 1; i <= chunkSize * 2; ++i) {
    pool.allocate().f = i;
  }
  const typedArrays = [];
  for (let i = 0; i < 2; ++i) {
    typedArrays[i] = new Float32Array(chunkSize);
    for (let j = 1; j <= chunkSize; ++j) {
      typedArrays[i][j - 1] = i * chunkSize + j;
    }
  }
  expect(pool.chunks.map(({view: {buffer}}) => new Float32Array(buffer))).to.deep.equal(typedArrays);
});
