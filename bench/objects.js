import {PropertyRegistry} from '../src/register.js';

const properties = {
  i: {type: 'uint8'},
};

const N = 5000;
let start;
start = performance.now();
class Thing {
  constructor() {
    for (let i = 0; i < N; ++i) {
      new PropertyRegistry.object(i, {properties}).define(this);
    }
  }
}
const thing = new Thing();
// const receiver = {};
// for (let i = 0; i < N; ++i) {
//   new PropertyRegistry.object(i, {properties}).define(receiver);
// }
console.log(N, performance.now() - start)
