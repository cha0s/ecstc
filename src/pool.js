import {Dirty, OnInvalidate} from './property.js';
import {PropertyRegistry} from './register.js';

const Position = Symbol();

export default class Pool {

  chunks = [];
  static chunkSize = 2048;
  freeList = [];
  instances = [];

  constructor(Component) {
    for (const key in Component.properties) {
      if (Component.reservedProperties.has(key)) {
        throw new SyntaxError(`${Component.componentName} contains reserved property '${key}'`);
      }
    }
    const {chunks} = this;
    const {chunkSize} = this.constructor;
    const width = PropertyRegistry.object.width({properties: Component.properties});
    class ComponentProperty extends PropertyRegistry.object {
      static BaseInstance = (new Function(
        'Component, chunkSize, OnInvalidate, width',
        `
          return class extends Component {
            constructor(position) {
              super();
              this.position = position;
              this.chunk = Math.floor(position / chunkSize);
              this.column = position % chunkSize;
              this.offset = width * this.column;
              const {properties} = this.constructor.property;
              ${
                Object.keys(Component.properties)
                  .map((key, i) => `
                    const {[properties['${key}'].onInvalidateKey]: onInvalidatePrevious${i}} = this;
                    this[properties['${key}'].onInvalidateKey] = (key) => {
                      onInvalidatePrevious${i}(key);
                      this[OnInvalidate](key);
                    };
                  `).join('\n')
              }

            }
            initialize(onInvalidate, values) {
              const {properties} = this.constructor.property;
              ${
                Object.keys(Component.properties)
                  .map((key) => `
                    this[OnInvalidate] = onInvalidate;
                    this['${key}'] = values && '${key}' in values ? values['${key}'] : properties['${key}'].defaultValue;
                  `).join('\n')
              }
              this.onInitialize();
            }
          }
        `
      ))(Component, chunkSize, OnInvalidate, width);
      [Position] = 0;
    }
    const property = new ComponentProperty('', {
      properties: Component.properties,
      ...width > 0 && {
        storage: {
          get(O, codec, offset) {
            return codec.decode(
              chunks[O.chunk].view,
              {byteOffset: O.offset + offset, isLittleEndian: true},
            );
          },
          set(O, codec, value, offset) {
            codec.encode(
              value,
              chunks[O.chunk].view,
              O.offset + offset,
              true,
            );
          },
        },
      }
    });
    this.dirtyWidth = width > 0 ? 1 + (property.count >> 5) : 0;
    this.property = property;
    this.width = width;
  }

  allocate() {
    const {chunkSize} = this.constructor;
    let instance;
    const {length} = this.instances;
    const {chunks, dirtyWidth} = this;
    if (this.width > 0 && 0 === (length % chunkSize)) {
      chunks.push({
        dirty: new Uint32Array(chunkSize * dirtyWidth),
        view: new DataView(new ArrayBuffer(chunkSize * this.width)),
      });
    }
    if (this.freeList.length > 0) {
      instance = this.freeList.pop();
      this.instances[instance.position] = instance;
    }
    else {
      instance = new this.property.Instance(length);
      if (this.width > 0) {
        Object.defineProperty(instance, Dirty, {
          get() { return new Uint32Array(chunks[instance.chunk].dirty.buffer, instance.column * 4, dirtyWidth); },
        });
      }
      this.instances.push(instance);
    }
    return instance;
  }

  free(instance) {
    instance.destroy();
    this.freeList.push(instance);
    this.instances[instance.position] = null;
  }

}
