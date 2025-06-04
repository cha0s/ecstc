import {Dirty, MarkClean} from './property.js';
import {PropertyRegistry} from './register.js';
import {Table} from './wasm.js';

const Initialize = Symbol('Initialize');

export default class Pool {

  data = new WebAssembly.Memory({initial: 0});
  dirty = new WebAssembly.Memory({initial: 0});
  freeList = [];
  instances = new Table({element: 'externref', initial: 0});
  length = 0;
  view = new DataView(new ArrayBuffer(0));

  constructor(Component) {
    const {componentName} = Component;
    const pool = this;
    for (const key in Component.properties) {
      if (Component.reservedProperties.has(key)) {
        throw new SyntaxError(`${componentName} contains reserved property '${key}'`);
      }
    }
    const {codec, count, width} = PropertyRegistry.object.compute({
      properties: Component.properties,
    });
    const dirtyWidth = width > 0 ? 1 + (count >> 3) : 0;
    const bound = {
      Component,
      Dirty,
      codec,
      Initialize,
      pool,
    };
    class ComponentProperty extends PropertyRegistry.object {
      static ObjectProxy = (new Function(
        Object.keys(bound).join(','),
        `
          let scratch = {};
          return class PoolComponent extends Component {
            constructor(index) {
              super();
              this.index = index;
              this.byteOffset = ${width} * index;
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
                width > 0
                  ? 'codec.encode(scratch, pool.view, this.byteOffset, true)'
                  : 'this.set(scratch);'
              }
              ${Array(dirtyWidth).fill(0).map((n, i) => `this[Dirty][${i}] = ~0;`).join('\n')}
              this.entity = entity;
              this.onInitialize();
            }
          }
        `
      ))(...Object.values(bound));
    }
    const property = new ComponentProperty({
      properties: Component.properties,
      ...width > 0 && {
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
    this.Component = Component;
    this.property = property;
    this.Instance = width > 0
      ? (
        class extends property.Instance {
          constructor(index) {
            super(index);
            this[Dirty] = new Uint8Array(
              pool.dirty.buffer,
              index * dirtyWidth,
              dirtyWidth,
            );
          }
        }
      )
      : property.Instance;
    this.dirtyWidth = dirtyWidth;
    this.width = width;
  }

  allocate(values = {}, entity) {
    let instance;
    const {data, dirty, dirtyWidth, instances, width} = this;
    // free instance? use it
    if (this.freeList.length > 0) {
      instance = this.freeList.pop();
      instances.set(instance.index, instance);
    }
    else {
      if (data.buffer.byteLength < (1 + instances.length) * width) {
        data.grow(1);
        this.view = new DataView(data.buffer);
      }
      if (dirty.buffer.byteLength < (1 + instances.length) * dirtyWidth) {
        dirty.grow(1);
        for (let i = 0; i < instances.length; ++i) {
          instances.get(i)[Dirty] = new Uint8Array(
            dirty.buffer,
            i * dirtyWidth,
            dirtyWidth,
          );
        }
      }
      instance = new this.Instance(instances.length);
      instances.grow(1, instance);
      this.length += 1;
    }
    // initialize
    instance[Initialize](values, entity);
    return instance;
  }

  markClean() {
    if (this.width > 0) {
      new Uint8Array(this.dirty.buffer).fill(0);
    }
    else if (this.property.count > 0) {
      for (const instance of this.instances) {
        instance?.[MarkClean]();
      }
    }
  }

  markDirty() {
    for (const {dirty} of this.chunks) {
      dirty.fill(~0);
    }
  }

  free(instance) {
    instance.onDestroy();
    this.freeList.push(instance);
    this.instances.set(instance.index, null);
  }

}
