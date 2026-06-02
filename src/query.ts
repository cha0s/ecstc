import {
  Index,
} from 'propertea'

import { type WorldEntity } from './entity.ts'
import { type World } from './world.ts'

export const QUERY_DEINDEX_VALUE = 4294967295

export class Query<
  W extends World<any, any, any> = World<any, any, any>,
> {

  entities: (null | WorldEntity<W>)[] = [];
  entityIndexToQueryIndex: number[] = []
  excludes: string[] = []
  extract: (entity: WorldEntity<W>) => number[]
  freeList: number[] = [];
  includes: string[] = []
  query = {
    count: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
    memory: new WebAssembly.Memory({initial: 0}),
    nextGrow: 0,
    view: new Uint32Array(0),
  };
  width: number

  constructor({
    excludes,
    includes,
  }: (
    | { excludes?: string[], includes: string[] }
    | { excludes: string[], includes?: string[] }
  )) {
    this.excludes = excludes ?? []
    this.includes = includes ?? []
    this.width = 1 + this.includes.length // id + inclusions
    this.extract = (new Function('Index', `
      return function(entity) {
        return [
          entity.index,
          ${
            this.includes.map((componentName) => {
              return `entity['${String(componentName)}'][Index],`
            }).join('\n')
          }
        ];
      };
    `))(Index);
  }

  get count() {
    return this.query.count.value;
  }

  deindex(entity: WorldEntity<W>) {
    const entityIndex = entity.index
    const queryIndex = this.entityIndexToQueryIndex[entityIndex];
    if (undefined !== queryIndex && -1 !== queryIndex) {
      this.query.view[this.width * queryIndex] = QUERY_DEINDEX_VALUE;
      this.entities[queryIndex] = null;
      this.freeList.push(queryIndex);
      this.entityIndexToQueryIndex[entityIndex] = -1
    }
  }

  maybeInsert(entity: WorldEntity<W>) {
    const entityIndex = entity.index
    const queryIndex = this.entityIndexToQueryIndex[entityIndex]
    if (queryIndex === undefined || queryIndex === -1) {
      if (0 === this.freeList.length && this.query.nextGrow === this.entities.length) {
        this.query.memory.grow(1);
        this.query.view = new Uint32Array(this.query.memory.buffer);
        this.query.nextGrow = Math.floor(this.query.memory.buffer.byteLength / (4 * this.width));
      }
      let index: number
      if (this.freeList.length > 0) {
        index = this.freeList.pop()!
      }
      else {
        index = this.entities.length
        this.query.count.value += 1;
      }
      this.entities[index] = entity;
      let j = index * this.width;
      for (const extractedIndex of this.extract(entity)) {
        this.query.view[j++] = extractedIndex;
      }
      this.entityIndexToQueryIndex[entityIndex] = index;
    }
  }

  reindex(entity: WorldEntity<W>) {
    // test inclusion criteria: if any are missing, inclusion fails
    let included = true;
    for (let j = 0; j < this.includes.length; ++j) {
      if (!entity.has(this.includes[j])) {
        included = false;
        break;
      }
    }
    // test exclusion criteria: if any are present, inclusion fails
    if (included) {
      for (let j = 0; j < this.excludes.length; ++j) {
        if (entity.has(this.excludes[j])) {
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

  *select() {
    const {length} = this.entities
    for (let i = 0; i < length; ++i) {
      if (this.entities[i]) {
        yield this.entities[i]
      }
    }
  }

  wasmImports() {
    return {
      count: this.query.count,
      data: this.query.memory,
      width: new WebAssembly.Global({mutable: true, value: 'i32'}, this.width),
    };
  }

}
