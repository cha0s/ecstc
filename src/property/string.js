import {Property} from '../property.js';

export class string extends Property {
  get defaultValue() {
    return super.defaultValue ?? '';
  }
}

