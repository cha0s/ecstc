import {Application, Assets, ParticleContainer, Particle} from 'pixi.js';

import {Component, World, System} from '../../src/index.js';

const TPS = 60;
const TPS_IN_MS = 1000 / TPS;
let texture;

let isDiffChecked = false;
document.querySelector('.diffContainer [type="checkbox"]').addEventListener('change', () => {
  isDiffChecked = !isDiffChecked;
});

let isDirectBufferAccessChecked = true;
document.querySelector('.dba').addEventListener('change', () => {
  isDirectBufferAccessChecked = !isDirectBufferAccessChecked;
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
    elapsed: {type: 'float32'},
    ttl: {type: 'float32'},
  };
}

class Growing extends Component {
  static dependencies = ['PixiParticle'];
}

class PixiParticle extends Component {
  static dependencies = ['Position'];
  particle = null;
  static freeParticles = [];
  onDestroy() {
    this.constructor.freeParticles.push(this.particle);
    const {Pixi: {particles}} = this.entity.world.entities.get(1);
    particles.delete(this.particle);
    this.particle = null;
  }
  onInitialize() {
    const {x, y} = this.entity.Position;
    const {Pixi: {particles}} = this.entity.world.entities.get(1);
    let particle;
    if (this.constructor.freeParticles.length > 0) {
      particle = this.constructor.freeParticles.pop();
    }
    else {
      particle = new Particle({
        anchorX: 0.5,
        anchorY: 0.5,
        texture,
        tint: (
          Math.floor(Math.random() * 255) << 16
          | Math.floor(Math.random() * 255) << 8
          | Math.floor(Math.random() * 255)
        ),
      });
    }
    particles.add(particle);
    particle.alpha = 0.6;
    particle.scaleX = 0;
    particle.scaleY = 0;
    particle.x = x;
    particle.y = y;
    this.particle = particle;
  }
}

class Expire extends System {
  onInitialize() {
    this.expiring = this.query(['Expiring']);
  }
  tick(elapsed) {
    if (isDirectBufferAccessChecked) {
      const {pool} = this.world.Components.Expiring;
      let position = 0;
      for (const {view} of pool.chunks) {
        const array = new Float32Array(view.buffer);
        for (let i = 0, j = 0; i < pool.constructor.chunkSize; ++i, j += 2) {
          const instance = pool.instances[position++];
          if (instance) {
            array[j] += elapsed;
            if (array[j] >= array[j + 1]) {
              this.world.destroy(instance.entity);
            }
          }
        }
      }
      pool.markDirty();
    }
    else {
      for (const entity of this.expiring.select()) {
        entity.Expiring.elapsed += elapsed;
        if (entity.Expiring.elapsed >= entity.Expiring.ttl) {
          this.world.destroy(entity);
        }
      }
    }
  }
}

class RefreshParticles extends System {
  onInitialize() {
    this.expiring = this.query(['Expiring']);
  }
  tick() {
    const {Pixi: {container, particles}} = this.world.entities.get(1);
    container.particleChildren = Array.from(particles);
  }
}

class Grow extends System {
  onInitialize() {
    this.growing = this.query(['Growing']);
  }
  tick(elapsed) {
    let particle;
    for (const entity of this.growing.select()) {
      ({particle} = entity.PixiParticle);
      particle.rotation += elapsed * 0.5 * (2 * Math.PI);
      particle.scaleX += elapsed * 5;
      particle.scaleY += elapsed * 5;
    }
  }
}

class Spawn extends System {
  tick() {
    const {Pixi: {app}} = this.world.entities.get(1);
    const {view: {height, width}} = app;
    const lastTiming = lastEcsTiming + lastRenderTiming;
    let N;
    let t, k;
    const spawnCount = this.world.entities.size - 1;
    if (isAutoTargetingChecked) {
      if (lastTiming >= TPS_IN_MS) {
        return;
      }
      k = (lastTiming / TPS_IN_MS);
      t = 5000;
      slider.value = spawnCount;
      slider.max = slider.value * 2;
    }
    else {
      if (spawnCount >= slider.value) {
        return;
      }
      k = spawnCount / slider.value;
      t = Math.min(slider.value, 10000);
    }
    N = t - Math.pow(t, k);
    for (let i = 0; i < N; ++i) {
      world.create({
        PixiParticle: {},
        Expiring: {ttl: 1 + (i / N)},
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
app.init({autoStart: false, background: '#1099bb', resizeTo: window}).then(() => {
  const container = new ParticleContainer();

  document.querySelector('.play').appendChild(app.canvas);

  const globals = world.create({
    Pixi: {},
  });
  globals.Pixi.app = app;
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
    const o = {
      diff: isDiffChecked ? `${(diffTiming.average).toFixed(2)}~ms (${diff.size})` : '[enable to take diff]',
      ecs: `${(ecsTiming.average).toFixed(2)}~ms`,
      pixi: `${(pixiTiming.average).toFixed(2)}~ms`,
      entities: `${Math.round(entityCount.average).toLocaleString()}~`,
      memory: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`,
      churned: `${world.caret.toLocaleString()}`,
    }
    for (const key in o) {
      document.querySelector(`.${key}`).innerText = o[key];
    }
  }
  renderInfo();
});
