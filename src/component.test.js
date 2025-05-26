import {expect, test} from 'vitest';

import {Components} from './testing.js';
import Component from './component.js';
import {Diff, MarkClean, MarkDirty, ToJSON, ToJSONWithoutDefaults} from './property.js';

const {Position} = Components;

test('smoke', () => {
  expect(() => new Position()).not.toThrowError();
});

test('invalidation', () => {
  const position = new Position();
  position.x = 1;
  expect(position[Diff]()).to.deep.equal({x: 1});
  position[MarkClean]();
  expect(position[Diff]()).to.deep.equal({});
  position[MarkDirty]();
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
  const nested = new Nested();
  nested.a.push('blah');
  nested.m.set('foo', 'bar')
  nested.o.p = 'hi';
  const fullDiff = nested[Diff]();
  expect(fullDiff).to.deep.equal({
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
  nested[MarkDirty]();
  expect(nested[Diff]()).to.deep.equal(fullDiff);
});

test('disallows reserved properties', () => {
  const {reservedProperties} = Component;
  for (const propertyName of reservedProperties) {
    class BadComponent extends Component {
      static properties = {
        [propertyName]: {type: 'bool'},
      };
    }
    expect(() => new BadComponent()).toThrowError(`reserved property '${propertyName}'`);
  }
});

test('dirty spill', () => {
  const properties = {};
  for (let k = 0; k < 64; ++k) {
    properties[k] = {
      type: 'object',
      properties: {v: {type: 'uint8'}}
    };
  }
  class SpillComponent extends Component {
    static properties = properties;
  }
  const spillComponent = new SpillComponent();
  spillComponent[MarkDirty]();
  expect(spillComponent[Diff]()).to.deep.equal(
    Object.fromEntries(Object.keys(properties).map((key) => [key, {v: 0}])),
  );
  spillComponent[MarkClean]();
  expect(spillComponent[Diff]()).to.deep.equal({});
});

test('sorting', () => {
  class DependencyComponent extends Component {}
  class DependentComponent extends Component {
    static dependencies = ['DependencyComponent'];
  }
  expect(Component.sort({DependentComponent, DependencyComponent})).to.deep.equal([
    'DependencyComponent',
    'DependentComponent',
  ]);
  expect(Component.sort({DependencyComponent, DependentComponent})).to.deep.equal([
    'DependencyComponent',
    'DependentComponent',
  ]);
});

test('toJSON', () => {
  class NestedAndScalar extends Component {
    static properties = {
      o: {type: 'object', properties: {p: {type: 'string'}}},
      s: {type: 'string'},
    };
  }
  const component = new NestedAndScalar();
  expect(component[ToJSON]()).to.deep.equal({o: {p: ''}, s: ''});
});

test('toJSONWithoutDefaults', () => {
  class NestedAndScalar extends Component {
    static properties = {
      o: {type: 'object', properties: {p: {type: 'string'}}},
      s: {type: 'string'},
    };
  }
  const component = new NestedAndScalar();
  expect(component[ToJSONWithoutDefaults]()).to.deep.equal({});
  component.s = 'foo';
  expect(component[ToJSONWithoutDefaults]()).to.deep.equal({s: 'foo'});
  expect(component[ToJSONWithoutDefaults]({s: 'foo'})).to.deep.equal({});
});
