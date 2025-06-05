import {Dirty, MarkClean} from './property.js';
import {PropertyRegistry} from './register.js';
import {Table} from './wasm.js';

const Initialize = Symbol('Initialize');

const {object: ObjectProperty} = PropertyRegistry;

export default class Pool {

  data = {memory: new WebAssembly.Memory({initial: 0}), width: 0};
  dirty = {memory: new WebAssembly.Memory({initial: 0}), width: 0};
  freeList = [];
  instances = new Table({element: 'externref', initial: 0});
  view = new DataView(new ArrayBuffer(0));

  constructor(Component) {
    const {componentName} = Component;
    const pool = this;
    for (const key in Component.properties) {
      if (Component.reservedProperties.has(key)) {
        throw new SyntaxError(`${componentName} contains reserved property '${key}'`);
      }
    }
    const {codec, dataWidth, dirtyWidth} = ObjectProperty.compute({properties: Component.properties});
    const isFixedSize = dataWidth > 0;
    const bound = {
      Component,
      Dirty,
      codec,
      Initialize,
      pool,
    };
    class ComponentProperty extends ObjectProperty {
      static ObjectProxy = (new Function(
        Object.keys(bound).join(','),
        `
          let scratch = {};
          return class PoolComponent extends Component {
            constructor(index) {
              super();
              this.index = index;
              this.byteOffset = ${dataWidth} * index;
            }
            [Initialize](values, entity) {
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
                isFixedSize
                  ? 'codec.encode(scratch, pool.view, this.byteOffset, true)'
                  : 'this.set(scratch);'
              }
              ${Array(dirtyWidth).fill(0).map((n, i) => `this[Dirty][${i}] = ~0;`).join('\n')}
              this.entity = entity;
              this.onInitialize();
            }
          };
        `
      ))(...Object.values(bound));
    }
    const property = new ComponentProperty({
      properties: Component.properties,
      ...isFixedSize && {
        storage: {
          get(O, {codec}, byteOffset) {
            return codec.decode(
              pool.view,
              {byteOffset: O.byteOffset + byteOffset, isLittleEndian: true},
            );
          },
          set(O, {codec}, value, byteOffset) {
            codec.encode(value, pool.view, O.byteOffset + byteOffset, true);
          },
        },
      }
    }, componentName);
    if (isFixedSize) {
      this.Instance = class extends property.Instance {
        constructor(index) {
          super(index);
          this[Dirty] = new Uint8Array(pool.dirty.memory.buffer, index * dirtyWidth, dirtyWidth);
        }
      };
    }
    else {
      this.Instance = property.Instance;
    }
    this.data.width = dataWidth;
    this.dirty.width = dirtyWidth;
    this.property = property;
  }

  allocate(values = {}, entity) {
    let instance;
    const {data, dirty, instances} = this;
    // free instance? use it
    if (this.freeList.length > 0) {
      instance = this.freeList.pop();
      instances.set(instance.index, instance);
    }
    else {
      const newInstancesLength = 1 + instances.length;
      if (data.memory.buffer.byteLength < newInstancesLength * data.width) {
        data.memory.grow(1);
        this.view = new DataView(data.memory.buffer);
      }
      if (dirty.memory.buffer.byteLength < newInstancesLength * dirty.width) {
        dirty.memory.grow(1);
        // not the best... reset every instance's dirty window b/c WASM allocates a new buffer
        const {width} = dirty;
        for (let i = 0; i < instances.length; ++i) {
          instances.get(i)[Dirty] = new Uint8Array(dirty.memory.buffer, i * width, width);
        }
      }
      instance = new this.Instance(instances.length);
      instances.grow(1, instance);
    }
    // initialize
    instance[Initialize](values, entity);
    return instance;
  }

  markClean() {
    if (this.dirty.width > 0) {
      new Uint8Array(this.dirty.memory.buffer).fill(0);
    }
    else if (this.property.count > 0) {
      for (const instance of this.instances) {
        instance?.[MarkClean]();
      }
    }
  }

  free(instance) {
    instance.onDestroy();
    this.freeList.push(instance);
    this.instances.set(instance.index, null);
  }

}
