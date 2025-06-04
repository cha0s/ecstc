export class Table extends WebAssembly.Table {
  *[Symbol.iterator]() {
    let i = 0;
    while (i < this.length) {
      yield this.get(i++);
    }
  }
}
