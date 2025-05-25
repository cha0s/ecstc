import Component from '../component.js';
import Entity from '../entity.js';
import {ComponentRegistry, registerComponent} from '../register.js';

registerComponent('Position', class Position extends Component {
  static properties = {
    x: {type: 'float32'},
    y: {type: 'float32'},
  };
});

const {Position} = ComponentRegistry
export {Position};

export function registerComponents(Components) {
  return Object.fromEntries(Components.map(([componentName, properties]) => {
    registerComponent(componentName, class extends Component {
      static properties = properties;
    });
    return [componentName, ComponentRegistry[componentName]];
  }));
}

export function fakeEnvironment() {
  const Components = registerComponents([
    ['A', {a: {type: 'int32', defaultValue: 64}}],
    ['B', {b: {type: 'int32', defaultValue: 32}}],
    ['C', {c: {type: 'int32'}}],
    ['D', {d: {type: 'float64'}, e: {type: 'float64'}}],
    ['E', {e: {type: 'object', properties: {f: {type: 'int32'}, g: {type: 'int32'}}}}],
  ]);
  const {A, B, C, D, E} = Components;
  const one = new Entity(1);
  one.addComponent(B);
  const two = new Entity(2);
  two.addComponent(A);
  two.addComponent(B);
  two.addComponent(C);
  const three = new Entity(3);
  three.addComponent(A);
  return {A, B, C, D, E, Components, one, two, three};
}

