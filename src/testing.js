import Component from './component.js';
import World from './world.js';

export function wrapComponents(Components) {
  return Object.fromEntries(Components.map(([componentName, properties]) => {
    return [componentName, class extends Component {
      static componentName = componentName;
      static properties = properties;
    }];
  }));
}

export const Components = wrapComponents([
  ['A', {a: {type: 'int32', defaultValue: 64}}],
  ['B', {b: {type: 'int32', defaultValue: 32}}],
  ['C', {c: {type: 'int32'}}],
  ['D', {d: {type: 'float64'}, e: {type: 'float64'}}],
  ['E', {e: {type: 'object', properties: {f: {type: 'int32'}, g: {type: 'int32'}}}}],
  ['Position', {x: {type: 'float32'}, y: {type: 'float32'}}],
]);

export function fakeEnvironment() {
  const world = new World({Components});
  const one = world.create();
  one.addComponent('B');
  const two = world.create();
  two.addComponent('A');
  two.addComponent('B');
  two.addComponent('C');
  const three = world.create();
  three.addComponent('A');
  const {A, B, C, D, E} = Components;
  return {A, B, C, D, E, Components, one, two, three, world};
}

