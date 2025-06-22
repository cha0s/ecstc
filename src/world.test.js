import {expect, test} from 'vitest';

import {Components, fakeEnvironment} from './testing.js';
import {Component} from './component.js';
import System from './system.js';
import World from './world.js';

test('smoke', () => {
  expect(() => new World()).not.toThrowError();
});

test('clear', () => {
  const {one, three, two, world} = fakeEnvironment();
  let destroyedCount = 0;
  world.addDestroyListener(one, () => { ++destroyedCount; });
  const freeAfterDestroy = world.addDestroyListener(two, () => { ++destroyedCount; });
  world.addDestroyListener(three, () => { ++destroyedCount; })();
  world.clear();
  expect(destroyedCount).to.equal(2);
  expect(() => freeAfterDestroy()).not.toThrowError();
});

test('diff', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static properties = {
        a: {type: 'uint8'},
      };
    },
  };
  const world = new World({Components});
  world.create({A: {a: 32}});
  world.create({A: {a: 64}});
  expect(world.diff()).to.deep.equal(new Map([[1, {A: {a: 32}}], [2, {A: {a: 64}}]]));
});

test('destruction notification', () => {
  const {three, two, world} = fakeEnvironment();
  let destroyed = false;
  world.addDestroyListener(two, () => { destroyed = true; })
  world.destroy(two);
  expect(destroyed).to.be.false;
  world.markClean();
  world.tick();
  expect(world.diff()).to.deep.equal(new Map([[2, false]]));
  expect(destroyed).to.be.true;
  destroyed = false;
  world.addDestroyListener(three, () => { destroyed = true; })
  three.destroy();
  expect(destroyed).to.be.false;
  world.tick();
  expect(destroyed).to.be.true;
});

test('destroy dependency', () => {
  const {two, world} = fakeEnvironment();
  const destroy = world.addDestroyDependency(two);
  let destroyed = false;
  world.addDestroyListener(two, () => { destroyed = true; })
  world.destroy(two);
  expect(destroyed).to.be.false;
  world.tick();
  expect(destroyed).to.be.false;
  destroy();
  expect(destroyed).to.be.false;
  world.tick();
  expect(destroyed).to.be.true;
});

test('dependencies', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static dependencies = ['B'];
    },
    B: class extends Component {
      static componentName = 'B';
      static dependencies = ['C', 'D'];
    },
    C: class extends Component {
      static componentName = 'C';
      static dependencies = ['E'];
    },
    D: class extends Component {
      static componentName = 'D';
    },
    E: class extends Component {
      static componentName = 'E';
    },
    F: class extends Component {
      static componentName = 'F';
      static dependencies = ['D'];
    },
  };
  const world = new World({Components});
  const entity = world.create({A: {}});
  world.create({A: {}});
  expect(entity.has('B')).to.be.true;
  expect(entity.has('C')).to.be.true;
  expect(entity.has('D')).to.be.true;
  expect(entity.has('E')).to.be.true;
});

test('set', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static properties = {
        a: {type: 'uint8'},
      };
    },
  };
  const world = new World({Components});
  world.create({A: {a: 32}});
  world.create({A: {a: 64}});
  const otherWorld = new World({Components});
  otherWorld.create({A: {a: 16}});
  otherWorld.set(world.diff());
  expect(world.toJSON()).to.deep.equal(otherWorld.toJSON());
  otherWorld.set([[2, false]]);
  otherWorld.tick();
  expect(otherWorld.instances.filter(Boolean).length).to.equal(1);
});

test('clear', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static properties = {
        a: {type: 'uint8'},
      };
    },
  };
  const world = new World({Components});
  world.create({A: {a: 32}});
  expect(world.instances.filter(Boolean).length).to.equal(1);
  world.clear();
  expect(world.instances.filter(Boolean).length).to.equal(0);
});

test('queries', () => {
  const Components = {
    A: class extends Component {},
    B: class extends Component {},
  };
  const world = new World({Components});
  world.create({A: {}});
  world.create({A: {}, B: {}});
  expect(world.query(['A']).count).to.equal(2);
  expect(world.query(['B']).count).to.equal(1);
  const entity = world.create({A: {}});
  expect(world.query(['A']).count).to.equal(3);
  world.destroyImmediately(entity);
  expect(world.query(['A']).count).to.equal(2);
});

test('tick', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static properties = {
        a: {type: 'uint8'},
      };
    },
  };
  const Systems = {
    DoThing: class DoThing extends System {
      onInitialize() {
        this.as = this.query(['A']);
      }
      tick() {
        for (const entity of this.as.select()) {
          entity.A.a += 1;
        }
      }
    },
  };
  const world = new World({Components, Systems});
  const first = world.create({A: {a: 0}});
  const second = world.create({A: {a: 5}});
  world.tick();
  expect(first.A.a).to.equal(1);
  expect(second.A.a).to.equal(6);
});

test('wasm', async () => {
  const calls = [];
  class FSystem extends System {
    static wasm = {
      callbacks: [
        (instance) => { calls.push(instance.f); },
      ],
    };
    constructor(world) {
      super(world);
      this.query(['F']);
    }
    tick(elapsed) {
      this.wasm.tick(elapsed.delta, elapsed.total);
    }
  }
  const world = new World({Components: {F: Components.F}, Systems: {FSystem}});
  const {default: buffer} = await import('./world.test.wat?multi_memory=true');
  await world.instantiateWasm({FSystem: buffer});
  const {F} = world.collection.components;
  for (let i = 0; i < 4; ++i) {
    F.pool.allocate();
  }
  world.tick(2.5);
  expect(calls).to.deep.equal([2.5, 4.5]);
  const array = new Float32Array(F.pool.data.memory.buffer);
  for (let i = 0; i < 4; ++i) {
    expect(array[i]).to.equal(2.5 + i);
  }
  await expect(async () => {
    await new World({
      Components: {F: Components.F},
      Systems: {FSystem},
    }).instantiateWasm({FSystem: new ArrayBuffer(0)});
  }).rejects.toThrowError('System(FSystem)');
});
