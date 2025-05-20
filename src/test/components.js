import Component from '../component.js';

export class Position extends Component {
  static properties = {
    x: {type: 'uint8'},
    y: {type: 'uint8'},
  };
}
