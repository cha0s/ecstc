import Component from '../component.js';
import Entity from '../entity.js';
import {ComponentRegistry, registerComponent} from '../register.js';

class RawPosition extends Component {
  static properties = {
    x: {type: 'float32'},
    y: {type: 'float32'},
  };
}

registerComponent('Position', RawPosition);

const {Position} = ComponentRegistry
export {Position};

export function wrapComponents(Components) {
  return Components
    .reduce((Components, [componentName]) => {
      return {
        ...Components,
        [componentName]: Component.concretize(componentName),
      };
    }, {});
}

export function fakeEnvironment() {
  const Components = wrapComponents([
    ['A', {a: {type: 'int32', defaultValue: 64}}],
    ['B', {b: {type: 'int32', defaultValue: 32}}],
    ['C', {c: {type: 'int32'}}],
    ['D', {d: {type: 'float64'}, e: {type: 'float64'}}],
    ['E', {e: {type: 'object', properties: {f: {type: 'int32'}, g: {type: 'int32'}}}}],
  ]);
  const {A, B, C, D, E} = Components;
  A.storage = new A.Storage(Components.A);
  B.storage = new C.Storage(Components.B);
  C.storage = new A.Storage(Components.C);
  D.storage = new A.Storage(Components.D);
  E.storage = new A.Storage(Components.E);
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

