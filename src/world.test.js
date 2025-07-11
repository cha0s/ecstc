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
    E: class extends Component {
      static componentName = 'E';
      static properties = {};
    },
  };
  const world = new World({Components});
  world.create({A: {a: 32}});
  world.create({E: {}});
  expect(world.diff()).to.deep.equal(new Map([[1, {A: {a: 32}}], [2, {E: {}}]]));
});

test('dirty', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static dependencies = ['B'];
      static properties = {
        a: {type: 'uint8'},
      };
    },
    B: class extends Component {
      static componentName = 'B';
      static properties = {
        b: {
          type: 'object',
          properties: {
            c: {type: 'uint8'},
          },
        },
      };
    },
  };
  const world = new World({Components});
  world.create({A: {a: 32}});
  world.create({A: {a: 32}, B: {b: {c: 64}}});
});

test('destruction notification', () => {
  const {three, two, world} = fakeEnvironment();
  let destroyed = false;
  world.addDestroyListener(two, () => { destroyed = true; })
  world.destroyEntity(two);
  expect(destroyed).to.be.false;
  world.markClean();
  world.tick();
  expect(world.diff()).to.deep.equal(new Map([[2, false]]));
  expect(destroyed).to.be.true;
  destroyed = false;
  world.addDestroyListener(three, () => { destroyed = true; })
  world.destroyEntity(three);
  expect(destroyed).to.be.false;
  world.tick();
  expect(destroyed).to.be.true;
});

test('destroy dependency', () => {
  const {two, world} = fakeEnvironment();
  const destroy = world.addDestroyDependency(two);
  let destroyed = false;
  world.addDestroyListener(two, () => { destroyed = true; })
  world.destroyEntity(two);
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
    A: class extends Component {
      static componentName = 'A';
    },
    B: class extends Component {
      static componentName = 'B';
    },
  };
  const world = new World({Components});
  world.create({A: {}});
  world.create({A: {}, B: {}});
  expect(world.query(['A']).count).to.equal(2);
  expect(world.query(['B']).count).to.equal(1);
  const entity = world.create({A: {}});
  expect(world.query(['A']).count).to.equal(3);
  world.destroyEntityImmediately(entity);
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

test('reindex', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static properties = {
        a: {type: 'uint8'},
      };
    },
    B: class extends Component {
      static componentName = 'B';
      static properties = {
        b: {type: 'uint8'},
      };
    },
  };
  let selected = 0;
  const Systems = {
    DoThing: class DoThing extends System {
      onInitialize() {
        this.both = this.query(['A', 'B']);
      }
      tick() {
        Array.from(this.both.select()).forEach(() => {
          selected += 1;
        });
      }
    },
  };
  const world = new World({Components, Systems});
  const entity = world.create({A: {a: 0}});
  world.tick();
  expect(selected).toEqual(0);
  entity.addComponent('B')
  world.tick();
  expect(selected).toEqual(1);
  entity.removeComponent('A')
  world.tick();
  expect(selected).toEqual(1);
});

test('wasm', async () => {
  const calls = [];
  class FSystem extends System {
    static wasm = {
      imports() {
        return {
          callback: (index) => { calls.push(pool.proxies[index].f); },
        };
      }
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
  const {default: buffer} = await import('./world.test.wat?multi_memory');
  await world.instantiateWasm({FSystem: buffer});
  const pool = world.pool.F;
  for (let i = 0; i < 4; ++i) {
    world.create({F: {}});
  }
  world.markClean();
  world.tick(2.5);
  expect(calls).to.deep.equal([2.5, 4.5]);
  const array = new Float32Array(pool.data.memory.buffer);
  expect(world.diff()).toEqual(new Map([
    [1, {F: {f: 2.5}}],
    [2, {F: {f: 3.5}}],
    [3, {F: {f: 4.5}}],
    [4, {F: {f: 5.5}}],
  ]));
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

test('empty component diff', () => {
  const Components = {
    A: class extends Component {
      static componentName = 'A';
      static properties = {};
    },
  };
  const world = new World({Components});
  const entity = world.create({A: {}});
  expect(world.diff()).to.deep.equal(new Map([[1, {A: {}}]]));
  world.markClean();
  expect(world.diff()).to.deep.equal(new Map());
  entity.removeComponent('A');
  expect(world.diff()).to.deep.equal(new Map([[1, {A: false}]]));
  world.markClean();
});
