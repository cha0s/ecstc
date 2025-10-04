import { Index } from 'propertea';

export default class Query {

  criteria = {with: [], without: []};
  query = {
    count: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    view: new Uint32Array(0),
    width: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
  };
  freeList = [];
  map = new Map();
  proxies = [];

  constructor(componentNames) {
    let count = 0;
    for (let i = 0; i < componentNames.length; ++i) {
      const componentName = componentNames[i];
      switch (componentName.charCodeAt(0)) {
        case '!'.charCodeAt(0):
          this.criteria.without.push(componentName.slice(1));
          break;
        default:
          this.criteria.with.push(componentName);
          count += 1;
          break;
      }
    }
    this.query.width.value = 1 + count;
    this.extract = (new Function('Index', `
      return function(entity) {
        return [
          entity.index,
          ${
            this.criteria.with.map((componentName) => {
              return `entity['${componentName}'][Index],`
            }).join('\n')
          }
        ];
      };
    `))(Index);
  }

  get count() {
    return this.query.count.value;
  }

  deindex(entity) {
    if (this.map.has(entity.id)) {
      const index = this.map.get(entity.id);
      this.query.view[this.query.width.value * index] = 4294967295;
      this.proxies[index] = null;
      this.freeList.push(index);
      this.query.count.value -= 1;
      this.map.delete(entity.id);
    }
  }

  imports() {
    return {
      count: this.query.count,
      data: this.query.memory,
      width: this.query.width,
    };
  }

  maybeInsert(entity) {
    if (!this.map.has(entity.id)) {
      if (0 === this.freeList.length && this.query.nextGrow === this.proxies.length) {
        this.query.memory.grow(1);
        this.query.view = new Uint32Array(this.query.memory.buffer);
        this.query.nextGrow = Math.floor(this.query.memory.buffer.byteLength / (4 * this.query.width));
      }
      const index = this.freeList.length > 0 ? this.freeList.pop() : this.proxies.length;
      this.proxies[index] = entity;
      this.query.count.value += 1;
      let j = index * this.query.width.value;
      for (const index of this.extract(entity)) {
        this.query.view[j++] = index;
      }
      this.map.set(entity.id, index);
    }
  }

  reindex(entity) {
    // no criteria: add
    if (0 === this.criteria.with.length && 0 === this.criteria.without.length) {
      this.maybeInsert(entity);
      return;
    }
    // test "with" criteria: if any are missing, inclusion fails
    let included = true;
    for (let j = 0; j < this.criteria.with.length; ++j) {
      if (!entity.has(this.criteria.with[j])) {
        included = false;
        break;
      }
    }
    // test "without" criteria: if any are present, inclusion fails
    if (included) {
      for (let j = 0; j < this.criteria.without.length; ++j) {
        if (entity.has(this.criteria.without[j])) {
          included = false;
          break;
        }
      }
    }
    if (included) {
      this.maybeInsert(entity);
    }
    else {
      this.deindex(entity);
    }
  }

  select() {
    const it = this.proxies.values();
    return (function *() {
      let result = it.next();
      while (!result.done) {
        if (null !== result.value) {
          yield result.value;
        }
        result = it.next();
      }
    })();
  }

}
