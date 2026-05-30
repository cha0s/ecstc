
type ComponentCollection = any

// type ComponentExcludes = `!${string}`
// type ComponentIncludes<T extends string> = T extends `!${string}` ? never : T

export class QueryFactor {

  collection: ComponentCollection

  constructor(collection: ComponentCollection) {
    this.collection = collection
  }

  create() {
    return new Query()
  }

}

export class Query {

  $$excludes: string[] = []
  // freeList = [];
  $$includes: string[] = []
  // map = new Map();
  // proxies = [];
  // query = {
  //   count: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
  //   memory: new WebAssembly.Memory({initial: 0}),
  //   nextGrow: 0,
  //   view: new Uint32Array(0),
  //   width: new WebAssembly.Global({mutable: true, value: 'i32'}, 0),
  // };

  // constructor({
  //   excludes,
  //   includes
  // }: {
  //   excludes: ComponentExcludes[],
  //   includes: ComponentIncludes<T>[],
  // }) {
  //   this.excludes = excludes
  //   this.includes = includes
  // }

  excludes(componentNames: string[]) {
    for (const componentName of componentNames) {
      this.$$excludes.push(componentName)
    }
    return this
  }

  includes(componentNames: string[]) {
    for (const componentName of componentNames) {
      this.$$includes.push(componentName)
    }
    return this
  }

}
