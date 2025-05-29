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
      static BaseInstance = class extends Component {
        constructor(position) {
          super();
          this.position = position;
          this.chunk = Math.floor(position / chunkSize);
          this.column = position % chunkSize;
          this.offset = width * this.column;
        }
      };
      [Position] = 0;
    }
    const property = new ComponentProperty('', {
      properties: Component.properties,
      ...width > 0 && {
        storage: {
          get(O, codec, offset) {
            return codec.decode(
              chunks[O.chunk],
              {byteOffset: O.offset + offset, isLittleEndian: true},
            );
          },
          set(O, codec, value, offset) {
            codec.encode(
              value,
              chunks[O.chunk],
              O.offset + offset,
              true,
            );
          },
        },
      }
    });
    this.property = property;
    this.width = width;
  }

  allocate() {
    const {chunkSize} = this.constructor;
    let instance;
    const {length} = this.instances;
    if (this.width > 0 && 0 === (length % chunkSize)) {
      this.chunks.push(new DataView(new ArrayBuffer(chunkSize * this.width)));
    }
    if (this.freeList.length > 0) {
      instance = this.freeList.pop();
      this.instances[instance.position] = instance;
    }
    else {
      instance = new this.property.Instance(length);
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
