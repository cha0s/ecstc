import {expect, test} from 'vitest';

import {Components} from './test/components.js';
import Component from './component.js';
import {Diff} from './property.js';

const {Position} = Components;

test('smoke', () => {
  expect(() => new Position()).not.toThrowError();
});

test('invalidation', () => {
  let key;
  const position = new Position();
  position.initialize((key_) => { key = key_; })
  position.x = 1;
  expect(key).to.equal('x');
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

test('nested diff', () => {
  class Nested extends Component {
    static properties = {
      o: {type: 'object', properties: {p: {type: 'string'}}},
    };
  }
  const nested = new Nested();
  nested.o.p = 'hi';
  expect(nested.diff()).to.deep.equal({o: {p: 'hi'}})
});
