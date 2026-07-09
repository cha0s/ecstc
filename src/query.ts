import {
  Index,
  Memory,
  type Propertea,
  type TrackedMemory,
} from 'propertea'

import { type ComponentConfiguration } from './component.ts'
import { type Entity, type EntityFromComponents } from './entity.ts'

export const QUERY_DEINDEX_VALUE = 4294967295

export class Query<
  Includes extends Record<string, ComponentConfiguration<any, any, any>> = Record<string, ComponentConfiguration<Record<string, Propertea<unknown>>, any, any>>,
  UseWasm extends boolean = any,
> {

  entities: (null | EntityFromComponents<Includes>)[] = []
  entityIndexToQueryIndex: number[] = []
  excludes: string[] = []
  extract: (entity: EntityFromComponents<Includes>) => number[]
  freeList: number[] = []
  includes: string[] = []
  onDeindex: ((entity: EntityFromComponents<Includes>) => void) | undefined
  onInsert: ((entity: EntityFromComponents<Includes>) => void) | undefined
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
      onDeindex?: (entity: EntityFromComponents<Includes>) => void,
      onInsert?: (entity: EntityFromComponents<Includes>) => void,
      excludes?: Record<string, ComponentConfiguration<any, any, any>>,
      includes: Includes,
      useWasm?: UseWasm
    }
    | {
      onDeindex?: (entity: EntityFromComponents<Includes>) => void,
      onInsert?: (entity: EntityFromComponents<Includes>) => void,
      excludes: Record<string, ComponentConfiguration<any, any, any>>,
      includes?: Includes,
      useWasm?: UseWasm
    }
  )) {
    this.onDeindex = onDeindex
    this.onInsert = onInsert
    this.excludes = Object.keys(excludes ?? {})
    this.includes = Object.keys(includes ?? {})
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
        ]
      }
    `))(Index)
    this.query = {
      memory: useWasm ? new WebAssembly.Memory({ initial: 0 }) : new Memory() as any,
      nextGrow: 0,
    }
    this.useWasm = useWasm
  }

  get count() {
    return this.queryCount.value
  }

  deindex(entity: EntityFromComponents<Includes>) {
    const entityIndex = entity.index
    const queryIndex = this.entityIndexToQueryIndex[entityIndex]
    if (undefined !== queryIndex && -1 !== queryIndex) {
      this.view[this.width * queryIndex] = QUERY_DEINDEX_VALUE
      this.entities[queryIndex] = null
      this.freeList.push(queryIndex)
      this.entityIndexToQueryIndex[entityIndex] = -1
      this.onDeindex?.(entity)
    }
  }

  maybeInsert(entity: EntityFromComponents<Includes>) {
    const entityIndex = entity.index
    const queryIndex = this.entityIndexToQueryIndex[entityIndex]
    if (queryIndex === undefined || queryIndex === -1) {
      if (0 === this.freeList.length && this.query.nextGrow === this.entities.length) {
        this.query.memory.grow(1)
        this.view = new Uint32Array(this.query.memory.buffer)
        this.query.nextGrow = Math.floor(this.query.memory.buffer.byteLength / (4 * this.width))
      }
      let index: number
      if (this.freeList.length > 0) {
        index = this.freeList.pop()!
      }
      else {
        index = this.entities.length
        this.queryCount.value += 1
      }
      this.entities[index] = entity
      let j = index * this.width
      for (const extractedIndex of this.extract(entity)) {
        this.view[j++] = extractedIndex
      }
      this.entityIndexToQueryIndex[entityIndex] = index
      this.onInsert?.(entity)
    }
  }

  reindex(entity: Entity) {
    // test inclusion criteria: if any are missing, inclusion fails
    let included = true
    for (let j = 0; j < this.includes.length; ++j) {
      if (!entity.has(this.includes[j])) {
        included = false
        break
      }
    }
    // test exclusion criteria: if any are present, inclusion fails
    if (included) {
      for (let j = 0; j < this.excludes.length; ++j) {
        if (entity.has(this.excludes[j])) {
          included = false
          break
        }
      }
    }
    if (included) {
      this.maybeInsert(entity as any)
    }
    else {
      this.deindex(entity as any)
    }
  }

  *select() {
    const {length} = this.entities
    for (let i = 0; i < length; ++i) {
      if (this.entities[i]) {
        yield this.entities[i]!
      }
    }
  }

  wasmImports() {
    return {
      count: this.queryCount,
      data: this.query.memory,
      width: new WebAssembly.Global({mutable: true, value: 'i32'}, this.width),
    }
  }

}
