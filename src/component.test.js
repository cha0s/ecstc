import {expect, test} from 'vitest';

import {Component, createCollection} from './component.js';

const Components = {
  Position: class extends Component {
    static properties = {
      x: {type: 'float32'},
      y: {type: 'float32'},
    };
  },
  Direction: class extends Component {
    static properties = {
      angle: {type: 'float32'},
    };
    static proxy(Proxy) {
      return class extends Proxy {
        foo() { this.angle = Math.PI; }
      };
    }
  },
};

const collection = createCollection(Components);

test('properties', () => {
  const pool = collection.pool.Position;
  expect(pool.allocate().toJSON()).toEqual({x: 0, y: 0});
});

test('proxy', () => {
  const pool = collection.pool.Direction;
  const proxy = pool.allocate();
  proxy.foo();
  expect(proxy.angle).toBeCloseTo(Math.PI);
});
