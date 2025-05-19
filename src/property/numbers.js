import Property from '../property.js';

class NumberProperty extends Property {
  get defaultValue() {
    return super.defaultValue ?? 0;
  }
}

export class float32 extends NumberProperty {}
export class float64 extends NumberProperty {}
export class int8 extends NumberProperty {}
export class int16 extends NumberProperty {}
export class int32 extends NumberProperty {}
export class uint8 extends NumberProperty {}
export class uint16 extends NumberProperty {}
export class uint32 extends NumberProperty {}
export class varint extends NumberProperty {}
export class varuint extends NumberProperty {}
