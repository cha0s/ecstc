import {Application, Assets, ParticleContainer, Particle} from 'pixi.js';

import {Component, World, System} from '../../src/index.js';

import expireBuffer from './expire.wat?multi_memory=true';

const TPS = 60;
const TPS_IN_MS = 1000 / TPS;
let texture;

let isDiffChecked = false;
document.querySelector('.diffContainer [type="checkbox"]').addEventListener('change', () => {
  isDiffChecked = !isDiffChecked;
});

let strategy = 'wasm';
document.querySelector('.strategy').addEventListener('change', (event) => {
  strategy = event.target.value;
});

const slider = document.querySelector('.target [type="range"]');
let isAutoTargetingChecked = true;
document.querySelector('.target [type="checkbox"]').addEventListener('change', () => {
  slider.disabled = !slider.disabled;
  isAutoTargetingChecked = !isAutoTargetingChecked;
});

class SMA {
  caret = 0;
  samples = Array(TPS).fill(0);
  get average() {
    return this.samples.reduce((average, sample) => average + sample, 0) / this.samples.length;
  }
  sample(sample) {
    this.samples[this.caret] = sample;
    this.caret = (this.caret + 1) % this.samples.length;
  }
}

let lastEcsTiming = 0;
let lastRenderTiming = 0;
const entityCount = new SMA();
const diffTiming = new SMA();
const ecsTiming = new SMA();
const pixiTiming = new SMA();

class Pixi extends Component {
  particles = new Set();
}

class Position extends Component {
  static properties = {
    x: {type: 'float32'},
    y: {type: 'float32'},
  };
}

class Expiring extends Component {
  static properties = {
    expiresAt: {type: 'float32'},
  };
}

class Growing extends Component {
  static dependencies = ['PixiParticle'];
}

class PixiParticle extends Component {
  static dependencies = ['Position'];
  particle = null;
  static freeParticles = [];
  // reactive callbacks may be used to manage side-effects. here, we manage pixi.js particles
  onDestroy() {
    this.constructor.freeParticles.push(this.particle);
    const {Pixi: {particles}} = this.entity.world.entities.get(1);
    particles.delete(this.particle);
    this.particle = null;
  }
  onInitialize() {
    const {x, y} = this.entity.Position;
    const {Pixi: {particles}} = this.entity.world.entities.get(1);
    const particle = this.constructor.freeParticles.length > 0
      ? this.constructor.freeParticles.pop()
      : new Particle({
        anchorX: 0.5,
        anchorY: 0.5,
        texture,
        tint: (
          Math.floor(Math.random() * 255) << 16
          | Math.floor(Math.random() * 255) << 8
          | Math.floor(Math.random() * 255)
        ),
      });
    particles.add(particle);
    particle.alpha = 0.8;
    particle.rotation = 0;
    particle.scaleX = 0;
    particle.scaleY = 0;
    particle.x = x;
    particle.y = y;
    this.particle = particle;
  }
  static properties = {
    velocity: {type: 'float32'},
  };
}

class Expire extends System {
  static wasm = {
    callbacks: [
      function(instance) { instance && this.world.destroy(instance.entity); },
    ],
  };
  onInitialize() {
    this.expiring = this.query(['Expiring']);
  }
  // tick using the selected strategy
  // each strategy results in an identical world state transformation
  tick(elapsed) {
    switch (strategy) {
      // query + builtin: trade off performance for brevity
      //
      // this is the slowest as all data access is through get/set. admittedly, slowest is relative
      // as this strategy still represents dominant performance compared to other JS ECS frameworks
      //
      // this strategy should be considered the default until a system's performance becomes a
      // concern
      //
      // note: this is the only reactive strategy; it will fire `onChange` events for mutated
      // properties and dirty flag handling is performed automatically
      case 'proxy': {
        for (const entity of this.expiring.select()) {
          if (elapsed.total >= entity.Expiring.expiresAt) {
            this.world.destroy(entity);
          }
        }
        break;
      }
      // query + DataView: faster access through a Dataview with chunk offsets
      //
      // this strategy is faster since we are modifying the DataView directly. it is still
      // slightly hampered by having to index into the buffer out of order
      //
      // this strategy is a good tradeoff between performance and ergonomics. it is a useful
      // strategy for efficient access of component data containing multiple property types
      case 'dataView': {
        const {pool} = this.world.collection.components.Expiring;
        const view = new DataView(pool.data.buffer);
        for (const entity of this.expiring.select()) {
          // remember to use little-endian byte ordering!                  vvvv
          if (elapsed.total >= view.getFloat32(entity.Expiring.byteOffset, true)) {
            this.world.destroy(entity);
          }
        }
        break;
      }
      // TypedArray: even faster access through direct buffer access
      //
      // this strategy is efficient since it operates on the data sequentially in memory.
      // the two tradeoffs are:
      //
      // 1) we now have to index into the instances array to handle any effects outside of this
      // component's data (e.g. destroying the entity)
      //
      // 2) we are locked into a fixed-type TypedArray. in this case this is fine since our
      // component data layout is simply 32-bit floats in sequence
      //
      // this strategy should be used when high performance is desirable from within JS
      case 'typedArray': {
        const {pool} = this.world.collection.components.Expiring;
        const {length} = pool;
        let instance;
        const array = new Float32Array(pool.data.buffer);
        for (let i = 0; i < length; ++i) {
          if (elapsed.total >= array[i]) {
            if ((instance = pool.instances.get(i))) {
              this.world.destroy(instance.entity);
            }
          }
        }
        break;
      }
      // WASM: fastest access by delegating to WASM
      //
      // tradeoffs:
      //
      // 1) WASM adds another layer of complexity and restrictions
      //
      // 2) anything besides direct data transformation needs to call out to JS anyway
      //
      // this strategy should be used when high performance is critical
      case 'wasm': {
        this.wasm.tick(elapsed.delta, elapsed.total);
        break;
      }
    }
  }
}

class RefreshParticles extends System {
  tick() {
    const {Pixi: {container, particles}} = this.world.entities.get(1);
    let i = 0;
    for (const particle of particles) {
      container.particleChildren[i++] = particle;
    }
    container.particleChildren.length = particles.size;
  }
}

const TWO_PI = (2 * Math.PI);

class Grow extends System {
  onInitialize() {
    this.growing = this.query(['Growing']);
  }
  tick(elapsed) {
    for (const entity of this.growing.select()) {
      entity.PixiParticle.particle.rotation += elapsed.delta * 5 * entity.PixiParticle.velocity * TWO_PI;
      entity.PixiParticle.particle.scaleX += elapsed.delta * 5;
      entity.PixiParticle.particle.scaleY += elapsed.delta * 5;
    }
  }
}

class Spawn extends System {
  tick(elapsed) {
    const {Pixi: {app}} = this.world.entities.get(1);
    const {canvas: {height, width}} = app;
    const lastTiming = lastEcsTiming + lastRenderTiming;
    let N;
    let t, k;
    const ceiling = 2500;
    const spawnCount = this.world.entities.size - 1;
    if (isAutoTargetingChecked) {
      if (lastTiming >= TPS_IN_MS) {
        return;
      }
      k = (lastTiming / TPS_IN_MS);
      t = ceiling;
      slider.value = spawnCount;
      slider.max = slider.value * 2;
    }
    else {
      if (spawnCount >= slider.value) {
        return;
      }
      k = spawnCount / slider.value;
      t = Math.min(slider.value, ceiling);
    }
    N = Math.min(ceiling, t - Math.pow(t, k));
    for (let i = 0; i < N; ++i) {
      world.create({
        PixiParticle: {velocity: Math.random() * 2 - 1},
        Expiring: {expiresAt: elapsed.total + 0.75 + (i / N) * 0.25},
        Growing: {},
        Position: {x: Math.random() * width, y: Math.random() * height},
      });
    }
  }
}

const world = new World({
  Components: {
    Pixi,
    PixiParticle,
    Expiring,
    Growing,
    Position,
  },
  Systems: {
    Expire,
    Grow,
    Spawn,
    RefreshParticles,
  },
});

const app = new Application();

await Promise.all([
  world.instantiateWasm({Expire: expireBuffer}),
  app.init({autoStart: false, background: '#1099bb', resizeTo: window}),
]);

document.querySelector('.play').appendChild(app.canvas);

const globals = world.create({
  Pixi: {},
});
globals.Pixi.app = app;

const container = new ParticleContainer();
globals.Pixi.container = container;
app.stage.addChild(container);

let last = performance.now();
let diff = new Map();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const elapsed = (now - last) / 1000;
  last = now;
  world.tick(elapsed);
  if (isDiffChecked) {
    const diffStart = performance.now();
    diff = world.diff();
    diffTiming.sample(performance.now() - diffStart);
  }
  world.markClean();
  entityCount.sample(world.entities.size - 1);
  ecsTiming.sample(lastEcsTiming = performance.now() - now);
}
Assets.load('../slime.png').then((texture_) => {
  texture = texture_;
  tick();
});

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  container.onViewUpdate();
  app.render();
  pixiTiming.sample(lastRenderTiming = performance.now() - now);
}
render();

function renderInfo() {
  setTimeout(renderInfo, 250);
  const ecsTimingValue = ecsTiming.average - (isDiffChecked ? diffTiming.average : 0);
  const o = {
    diff: isDiffChecked ? `${(diffTiming.average).toFixed(2)}~ms (${diff.size})` : '[enable to take diff]',
    ecs: `${(ecsTimingValue).toFixed(2)}~ms`,
    pixi: `${(pixiTiming.average).toFixed(2)}~ms`,
    churn: `${Math.round(entityCount.average).toLocaleString()}/s~ (${`${((ecsTiming.average / Math.round(entityCount.average)) * 1000).toFixed(4)}μs/op`})`,
    memory: performance.memory ?
      `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`
      : '[no access]',
  }
  for (const key in o) {
    document.querySelector(`.${key}`).innerText = o[key];
  }
}
renderInfo();
