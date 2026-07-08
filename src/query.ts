import {
  Index,
  Memory,
  type TrackedMemory,
} from 'propertea'

import { type WorldEntity } from './entity.ts'
import { type World } from './world.ts'

export const QUERY_DEINDEX_VALUE = 4294967295

export class Query<
  UseWasm extends boolean = any,
  W extends World<any, any, any, UseWasm> = World<any, any, any, UseWasm>,
> {

  entities: (null | WorldEntity<W>)[] = [];
  entityIndexToQueryIndex: number[] = []
  excludes: string[] = []
  extract: (entity: WorldEntity<W>) => number[]
  freeList: number[] = [];
  includes: string[] = []
  onDeindex: ((entity: WorldEntity<W>) => void) | undefined
  onInsert: ((entity: WorldEntity<W>) => void) | undefined
  query: TrackedMemory<UseWasm>
  queryCount = new WebAssembly.Global({ mutable: true, value: 'i32' }, 0)
  useWasm: UseWasm
  view = new Uint32Array(0)
  width: number

  constructor({
    excludes,
    includes,
    onDeindex,
    onInsert,
    useWasm = false as UseWasm,
  }: (
    | {
      onDeindex?: (entity: WorldEntity<W>) => void,
      onInsert?: (entity: WorldEntity<W>) => void,
      excludes?: string[],
      includes: string[],
      useWasm?: UseWasm
    }
    | {
      onDeindex?: (entity: WorldEntity<W>) => void,
      onInsert?: (entity: WorldEntity<W>) => void,
      excludes: string[],
      includes?: string[],
      useWasm?: UseWasm
    }
  )) {
    this.onDeindex = onDeindex
    this.onInsert = onInsert
    this.excludes = excludes ?? []
    this.includes = includes ?? []
    this.width = 1 + this.includes.length // id + inclusions
    this.extract = (new Function('Index', `
      return function(entity) {
        return [
          entity.index,
          ${
            this.includes.map((componentName) => {
              return `entity[${JSON.stringify(componentName)}][Index],`
            }).join('\n')
          }
        ];
      };
    `))(Index);
    this.query = {
      memory: useWasm ? new WebAssembly.Memory({ initial: 0 }) : new Memory() as any,
      nextGrow: 0,
    }
    this.useWasm = useWasm
  }

  get count() {
    return this.queryCount.value;
  }

  deindex(entity: WorldEntity<W>) {
    const entityIndex = entity.index
    const queryIndex = this.entityIndexToQueryIndex[entityIndex];
    if (undefined !== queryIndex && -1 !== queryIndex) {
      this.view[this.width * queryIndex] = QUERY_DEINDEX_VALUE;
      this.entities[queryIndex] = null;
      this.freeList.push(queryIndex);
      this.entityIndexToQueryIndex[entityIndex] = -1
      this.onDeindex?.(entity)
    }
  }

  maybeInsert(entity: WorldEntity<W>) {
    const entityIndex = entity.index
    const queryIndex = this.entityIndexToQueryIndex[entityIndex]
    if (queryIndex === undefined || queryIndex === -1) {
      if (0 === this.freeList.length && this.query.nextGrow === this.entities.length) {
        this.query.memory.grow(1);
        this.view = new Uint32Array(this.query.memory.buffer);
        this.query.nextGrow = Math.floor(this.query.memory.buffer.byteLength / (4 * this.width));
      }
      let index: number
      if (this.freeList.length > 0) {
        index = this.freeList.pop()!
      }
      else {
        index = this.entities.length
        this.queryCount.value += 1;
      }
      this.entities[index] = entity;
      let j = index * this.width;
      for (const extractedIndex of this.extract(entity)) {
        this.view[j++] = extractedIndex;
      }
      this.entityIndexToQueryIndex[entityIndex] = index;
      this.onInsert?.(entity)
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
      count: this.queryCount,
      data: this.query.memory,
      width: new WebAssembly.Global({mutable: true, value: 'i32'}, this.width),
    };
  }

}
