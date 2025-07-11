import {Application, Assets, ParticleContainer, Particle} from 'pixi.js';

import {Component, World, System} from '../../src/index.js';

import integrateBuffer from './integrate.wat?multi_memory';

const TPS = 60;
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

const entityCount = new SMA();
const diffTiming = new SMA();
const ecsTiming = new SMA();
const pixiTiming = new SMA();

class Pixi extends Component {
  static proxy(Proxy) {
    return class extends super.proxy(Proxy) {
      particles = new Set();
    };
  }
}

class Position extends Component {
  static properties = {
    x: {type: 'float32'},
    y: {type: 'float32'},
  };
}

class Spring extends Component {
  static properties = {
    angle: {type: 'float32'},
    damping: {defaultValue: 10, type: 'float32'},
    mass: {defaultValue: 1, type: 'float32'},
    point: {type: 'float32'},
    stiffness: {defaultValue: 500, type: 'float32'},
    velocity: {type: 'float32'},
  };
}

class Expiring extends Component {
  static properties = {
    expiresAt: {type: 'float32'},
  };
}

class PixiParticle extends Component {
  static dependencies = ['Position'];
  static proxy(Proxy) {
    return class extends super.proxy(Proxy) {
      particle = null;
      static freeParticles = [];
      // reactive callbacks may be used to manage side-effects. here, we manage pixi.js particles
      onDestroy() {
        this.constructor.freeParticles.push(this.particle);
        const {Pixi: {particles}} = this.entity.world.instances[0];
        particles.delete(this.particle);
        this.particle = null;
      }
      onInitialize() {
        const {x, y} = this.entity.Position;
        const {Pixi: {particles}} = this.entity.world.instances[0];
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
        const s = (width + height) / 8000;
        particle.scaleX = s;
        particle.scaleY = s;
        particle.x = x;
        particle.y = y;
        this.particle = particle;
      }
    };
  }
}

class RefreshParticles extends System {
  tick() {
    const {Pixi: {container, particles}} = this.world.instances[0];
    let i = 0;
    for (const particle of particles) {
      container.particleChildren[i++] = particle;
    }
    container.particleChildren.length = particles.size;
  }
}

class Integrate extends System {
  onInitialize() {
    this.springs = this.query(['Spring']);
  }
  tick(elapsed) {
    const {delta} = elapsed;
    switch (strategy) {
      case 'typedArray': {
        const {data, dirty, proxies: {length}} = this.world.pool.Spring;
        const dataArray = new Float32Array(data.memory.buffer);
        const dirtyArray = new Uint8Array(dirty.memory.buffer);
        let j = 0;
        for (let i = 0; i < length; ++i) {
          const F_spring = -dataArray[j + 4] * dataArray[j + 3];
          const F_damp = -dataArray[j + 1] * dataArray[j + 5];
          const v = ((F_spring + F_damp) / dataArray[j + 2]) * delta;
          if (Math.abs(v) > 0.001) {
            dataArray[j + 5] += v;
            dirtyArray[i] |= 32;
          }
          const p = dataArray[j + 5] * delta;
          if (Math.abs(p) > 0.001) {
            dataArray[j + 3] += p;
            dirtyArray[i] |= 8;
          }
          j += 6;
        }
        break;
      }
      case 'wasm': {
        this.wasm.tick(elapsed.delta, elapsed.total);
        break;
      }
      case 'proxy': {
        for (const {Spring} of this.springs.select()) {
          const {damping, mass, point, stiffness, velocity} = Spring;
          const F_spring = -stiffness * point;
          const F_damp = -damping * velocity;
          const v = ((F_spring + F_damp) / mass) * delta;
          if (Math.abs(v) > 0.001) {
            Spring.velocity += v;
          }
          const p = Spring.velocity * delta;
          if (Math.abs(p) > 0.001) {
            Spring.point += p;
          }
        }
        break;
      }
    }
  }
}

class Move extends System {
  onInitialize() {
    this.positionedSpringParticles = this.query(['PixiParticle', 'Position', 'Spring']);
  }
  tick() {
    for (const {PixiParticle, Position, Spring} of this.positionedSpringParticles.select()) {
      PixiParticle.particle.x = Position.x + Math.cos(Spring.angle) * Spring.point;
      PixiParticle.particle.y = Position.y + Math.sin(Spring.angle) * Spring.point;
    }
  }
}

class Orient extends System {
  onInitialize() {
    this.positionedSprings = this.query(['Position', 'Spring']);
  }
  tick() {
    const {canvas: {height, width}} = app;
    for (const {Position, Spring} of this.positionedSprings.select()) {
      const xd = Position.x - position.x;
      const yd = Position.y - position.y;
      const angle = Math.atan2(yd, xd);
      const distance = Math.hypot(xd, yd);
      const radius = (width + height) / 30;
      const point = -Math.pow(distance, 1 - (distance / radius));
      if (distance < radius) {
        Spring.angle = angle;
        Spring.point = point;
      }
    }
  }
}

function randomEntity() {
  const {canvas: {height, width}} = app;
  return {
    Position: {
      x: (width / 4) + Math.random() * (width / 2),
      y: (height / 4) + Math.random() * (height / 2),
    },
    PixiParticle: {},
    Spring: {
      angle: 0,
      damping: 10 + Math.random() * 10,
      mass: 1 + Math.random() * 5,
      point: 0,
      stiffness: Math.random() * 500,
      velocity: 0,
    },
  };
}

class Spawn extends System {
  tick() {
    const spawnCount = this.world.instances.filter(Boolean).length - 1;
    let diff = slider.value - spawnCount;
    if (diff < 0) {
      for (let i = 1; i < this.world.instances.length; ++i) {
        if (this.world.instances[i]) {
          this.world.destroyEntity(this.world.instances[i]);
          if (0 === ++diff) {
            break;
          }
        }
      }
    }
    if (diff > 0) {
      for (let i = 0; i < diff; ++i) {
        world.create(randomEntity());
      }
    }
  }
}

const world = new World({
  Components: {
    Pixi,
    PixiParticle,
    Position,
    Expiring,
    Spring,
  },
  Systems: {
    Integrate,
    Move,
    Orient,
    Spawn,
    RefreshParticles,
  },
});

const app = new Application();

await Promise.all([
  world.instantiateWasm({Integrate: integrateBuffer}),
  app.init({autoStart: false, background: '#1099bb', resizeTo: window}),
  Assets.load('../slime.png').then((texture_) => { texture = texture_; }),
]);

const {canvas: {height, width}} = app;
let angle = 0;
const position = {x: width / 2, y: height / 2};

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
  entityCount.sample(world.instances.filter(Boolean).length - 1);
  ecsTiming.sample(performance.now() - now);
  angle += (Math.random() * 0.5) - 0.25;
  const {canvas: {height, width}} = app;
  position.x += Math.cos(angle) * 30;
  position.y += Math.sin(angle) * 30;
  const x = position.x - (width / 4);
  const y = position.y - (height / 4);
  position.x = (width / 4) + ((x + (width / 2)) % (width / 2));
  position.y = (height / 4) + ((y + (height / 2)) % (height / 2));
}
tick();

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  container.onViewUpdate();
  app.render();
  pixiTiming.sample(performance.now() - now);
}
render();

function renderInfo() {
  setTimeout(renderInfo, 250);
  const ecsTimingValue = ecsTiming.average - (isDiffChecked ? diffTiming.average : 0);
  const o = {
    diff: isDiffChecked ? `${(diffTiming.average).toFixed(2)}~ms (${Array.from(diff.values()).filter((O) => !!O.Spring).length})` : '[enable to take diff]',
    ecs: `${(ecsTimingValue).toFixed(2)}~ms`,
    pixi: `${(pixiTiming.average).toFixed(2)}~ms`,
    entities: `${Math.round(entityCount.average).toLocaleString()}~ (${`${((ecsTiming.average / Math.round(entityCount.average)) * 1000).toFixed(4)}μs/op`})`,
    memory: performance.memory ?
      `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`
      : '[no access]',
  }
  for (const key in o) {
    document.querySelector(`.${key}`).innerText = o[key];
  }
}
renderInfo();
