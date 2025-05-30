import {Dirty, MarkClean, Parent} from './property.js';
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
    const {codec, count, width} = PropertyRegistry.object.compute({properties: Component.properties});
    const dirtyWidth = width > 0 ? 1 + (count >> 5) : 0;
    class ComponentProperty extends PropertyRegistry.object {
      static BaseInstance = (new Function(
        'Component, chunkSize, width, Dirty, Parent, chunks, codec',
        `
          let scratch = {};
          return class extends Component {
            constructor(position) {
              super();
              this.position = position;
              this.chunk = Math.floor(position / chunkSize);
              this.column = position % chunkSize;
              this.offset = width * this.column;
            }
            initialize(values, entity) {
              const {properties} = this.constructor.property;
              ${
                Object.keys(Component.properties)
                  .map((key) => `
                    scratch['${key}'] = (values && '${key}' in values)
                      ? values['${key}']
                      : properties['${key}'].defaultValue;
                  `).join('\n')
              }
              ${
                width > 0
                  ? 'codec.encode(scratch, chunks[this.chunk].view, this.offset, true)'
                  : 'this.set(scratch);'
              }
              ${Array(dirtyWidth).fill(0).map((n, i) => `this[Dirty][${i}] = ~0;`).join('\n')}
              this[Parent] = entity;
              this.onInitialize();
            }
          }
        `
      ))(Component, chunkSize, width, Dirty, Parent, chunks, codec);
      [Position] = 0;
    }
    const property = new ComponentProperty(Component.componentName, {
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
    this.property = property;
    this.dirtyWidth = dirtyWidth;
    this.width = width;
  }

  allocate(values = {}, entity) {
    const {chunkSize} = this.constructor;
    let instance;
    const {length} = this.instances;
    const {chunks, dirtyWidth} = this;
    if (this.width > 0 && 0 === (length % chunkSize)) {
      chunks.push({
        dirty: new Uint32Array(chunkSize * dirtyWidth).fill(~0),
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
    instance.initialize(values, entity);
    return instance;
  }

  markClean() {
    if (this.width > 0) {
      for (const {dirty} of this.chunks) {
        dirty.fill(0);
      }
    }
    else if (this.property.count > 0) {
      for (const instance of this.instances) {
        instance?.[MarkClean]();
      }
    }
  }

  free(instance) {
    instance.destroy();
    this.freeList.push(instance);
    this.instances[instance.position] = null;
  }

}
