import {Property} from '../property.js';

class IntegerProperty extends Property {
  get defaultValue() {
    return super.defaultValue ?? 0;
  }
}

class FloatProperty extends Property {
  get defaultValue() {
    return super.defaultValue ?? 0.0;
  }
}

export class float32 extends FloatProperty {}
export class float64 extends FloatProperty {}
export class int8 extends IntegerProperty {}
export class int16 extends IntegerProperty {}
export class int32 extends IntegerProperty {}
export class uint8 extends IntegerProperty {}
export class uint16 extends IntegerProperty {}
export class uint32 extends IntegerProperty {}
export class varint extends IntegerProperty {}
export class varuint extends IntegerProperty {}

export class bool extends Property {
  get defaultValue() {
    return super.defaultValue ?? false;
  }
}
