export class Table extends WebAssembly.Table {
  *[Symbol.iterator]() {
    let i = 0;
    const {length} = this;
    while (i < length) {
      yield this.get(i++);
    }
  }
}
