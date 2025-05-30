import {expect, test} from 'vitest';

import {PropertyRegistry} from '../register.js';

test('bool', () => {
  expect(Object.defineProperties({}, new PropertyRegistry.bool({}, 'b').definitions()).b).to.equal(false);
  expect(Object.defineProperties({}, new PropertyRegistry.bool({defaultValue: true}, 'b').definitions()).b).to.equal(true);
});

test('number', () => {
  [
    'float32',
    'float64',
    'int8',
    'int16',
    'int32',
    'uint8',
    'uint16',
    'uint32',
    'varint',
    'varuint',
  ].forEach((type) => {
    expect(Object.defineProperties({}, new PropertyRegistry[type]({}, 'n').definitions()).n).to.equal(0);
    expect(Object.defineProperties({}, new PropertyRegistry[type]({defaultValue: 2}, 'n').definitions()).n).to.equal(2);
  })
});

function typeToElementClass(type) {
  switch (type) {
    case 'int8': return Int8Array;
    case 'uint8': return Uint8Array;
    case 'int16': return Int16Array;
    case 'uint16': return Uint16Array;
    case 'int32': return Int32Array;
    case 'uint32': return Uint32Array;
    case 'float32': return Float32Array;
    case 'float64': return Float64Array;
    case 'int64': return BigInt64Array;
    case 'uint64': return BigUint64Array;
  }
  return undefined;
}

test('codec', () => {
  [
    'float32',
    'float64',
    'int8',
    'uint8',
    'int16',
    'uint16',
    'int32',
    'uint32',
  ].forEach((type) => {
    const ElementClass = typeToElementClass(type);
    const property = new PropertyRegistry[type]({
      storage: {
        get(O, codec) {
          return codec.decode(view, {byteOffset: 0, isLittleEndian: true});
        },
        set(O, codec, value) {
          codec.encode(value, view, 0, true);
        }
      },
    }, 'n');
    const property2 = new PropertyRegistry[type]({
      storage: {
        get(O, codec) {
          return codec.decode(view, {byteOffset: property.width, isLittleEndian: true});
        },
        set(O, codec, value) {
          codec.encode(value, view, property.width, true);
        }
      },
    }, 'n2');
    const view = new DataView(new ArrayBuffer(property.codec.size() * 2));
    const receiver = {};
    Object.defineProperties(receiver, property.definitions());
    Object.defineProperties(receiver, property2.definitions());
    receiver.n = 42;
    receiver.n2 = 421;
    expect(receiver.n).to.equal(property.codec.decode(view, {byteOffset: 0, isLittleEndian: true}));
    expect(receiver.n2).to.equal(property.codec.decode(view, {byteOffset: property.width, isLittleEndian: true}));
    const typedArray = new ElementClass(view.buffer);
    expect(typedArray[0]).to.equal(receiver.n);
    expect(typedArray[1]).to.equal(receiver.n2);
  })

});

test('64-bit codec', () => {
  [
    'int64',
    'uint64',
  ].forEach((type) => {
    const ElementClass = typeToElementClass(type);
    const property = new PropertyRegistry[type]({
      storage: {
        get(O, codec) {
          return codec.decode(view, {byteOffset: 0, isLittleEndian: true});
        },
        set(O, codec, value) {
          codec.encode(value, view, 0, true);
        }
      },
    }, 'n');
    const property2 = new PropertyRegistry[type]({
      storage: {
        get(O, codec) {
          return codec.decode(view, {byteOffset: property.width, isLittleEndian: true});
        },
        set(O, codec, value) {
          codec.encode(value, view, property.width, true);
        }
      },
    }, 'n2');
    const view = new DataView(new ArrayBuffer(property.codec.size() * 2));
    const receiver = {};
    Object.defineProperties(receiver, property.definitions());
    Object.defineProperties(receiver, property2.definitions());
    receiver.n = 42n;
    receiver.n2 = 421n;
    expect(receiver.n).to.equal(property.codec.decode(view, {byteOffset: 0, isLittleEndian: true}));
    expect(receiver.n2).to.equal(property.codec.decode(view, {byteOffset: property.width, isLittleEndian: true}));
    const typedArray = new ElementClass(view.buffer);
    expect(typedArray[0]).to.equal(receiver.n);
    expect(typedArray[1]).to.equal(receiver.n2);
  })

});
