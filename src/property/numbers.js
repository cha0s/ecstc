import {Property, Width} from '../property.js';

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

export class float32 extends FloatProperty { get [Width]() { return 4; } }
export class float64 extends FloatProperty { get [Width]() { return 8; } }
export class int8 extends IntegerProperty { get [Width]() { return 1; } }
export class int16 extends IntegerProperty { get [Width]() { return 2; } }
export class int32 extends IntegerProperty { get [Width]() { return 4; } }
export class uint8 extends IntegerProperty { get [Width]() { return 1; } }
export class uint16 extends IntegerProperty { get [Width]() { return 2; } }
export class uint32 extends IntegerProperty { get [Width]() { return 4; } }
export class varint extends IntegerProperty {}
export class varuint extends IntegerProperty {}

export class bool extends Property {
  get defaultValue() {
    return super.defaultValue ?? false;
  }
  get [Width]() { return 1; }
}
