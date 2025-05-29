import {Codecs} from 'crunches';

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

export class float32 extends FloatProperty { codec = new Codecs.float32(); }
export class float64 extends FloatProperty { codec = new Codecs.float64(); }
export class int8 extends IntegerProperty { codec = new Codecs.int8(); }
export class uint8 extends IntegerProperty { codec = new Codecs.uint8(); }
export class int16 extends IntegerProperty { codec = new Codecs.int16(); }
export class uint16 extends IntegerProperty { codec = new Codecs.uint16(); }
export class int32 extends IntegerProperty { codec = new Codecs.int32(); }
export class uint32 extends IntegerProperty { codec = new Codecs.uint32(); }
export class int64 extends IntegerProperty { codec = new Codecs.int64(); }
export class uint64 extends IntegerProperty { codec = new Codecs.uint64(); }
export class varint extends IntegerProperty {}
export class varuint extends IntegerProperty {}

export class bool extends Property {
  get defaultValue() {
    return super.defaultValue ?? false;
  }
  codec = new Codecs.bool();
}
