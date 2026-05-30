import { float32, object, Pool, ToJSON } from 'propertea';
import { expect, test } from 'vitest';

import { Component, createCollection } from './component.js';

const Components = {
  
  Position: class extends Component {
    static properties = object({
      x: float32(),
      y: float32(),
    });
  },
  Direction: class extends Component {
    static properties = object({
      angle: float32(),
    })
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
  expect(componentPool(Components.Position).allocate()[ToJSON]()).toEqual({x: 0, y: 0});
});

// test('proxy', () => {
//   const proxy = componentPool(Components.Direction).allocate();
//   proxy.foo();
//   expect(proxy.angle).toBeCloseTo(Math.PI);
// });

// test('reify', () => {
//   const collection = createCollection({
//     Position: {
//       x: {defaultValue: 1, type: 'float32'},
//       y: {type: 'float32'},
//     },
//   });
//   expect(componentPool(collection.components.Position).allocate()[ToJSON]()).toEqual({x: 1, y: 0});
// });
