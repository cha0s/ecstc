import {Pool, ToJSON} from 'propertea';
import {expect, test} from 'vitest';

import {Component} from './component.js';

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

function componentPool(Component) {
  return new Pool({
    type: 'object',
    properties: Component.properties,
    Proxy: (Proxy) => Component.proxy(Proxy),
  });
}

test('properties', () => {
  const pool = componentPool(Components.Position);
  expect(pool.allocate()[ToJSON]()).toEqual({x: 0, y: 0});
});

test('proxy', () => {
  const pool = componentPool(Components.Direction);
  const proxy = pool.allocate();
  proxy.foo();
  expect(proxy.angle).toBeCloseTo(Math.PI);
});
