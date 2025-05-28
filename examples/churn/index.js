import {Application, Assets, ParticleContainer, Particle} from 'pixi.js';

import {Component, World, System} from '../../src/index.js';

const texture = await Assets.load('../slime.png');
const TPS = 60;
const TPS_IN_MS = 1000 / 60;

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
const entityCount = new SMA();
const ecsTiming = new SMA();
const pixiTiming = new SMA();

class Pixi extends Component {}

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

class PixiParticle extends Component {
  static dependencies = ['Position'];
  particle = null;
  static pool = [];
  onDestroy() {
    const {Pixi: {app}} = this.entity.world.entities.get(1);
    const [container] = app.stage.children;
    this.constructor.pool.push(container.removeParticle(this.particle));
    this.particle = null;
  }
  onInitialize() {
    const {x, y} = this.entity.Position;
    const {Pixi: {app}} = this.entity.world.entities.get(1);
    const [container] = app.stage.children;
    const particle = container.addParticle(
      this.constructor.pool.length > 0
        ? this.constructor.pool.pop()
        : new Particle({
          tint: (
            Math.floor(Math.random() * 255) << 16
            | Math.floor(Math.random() * 255) << 8
            | Math.floor(Math.random() * 255)
          ),
          texture,
          anchorX: 0.5,
          anchorY: 0.5,
        }),
    );
    particle.x = x;
    particle.y = y;
    this.particle = particle;
  }
}

class Expire extends System {
  frequency = 0.05;
  onInitialize() {
    this.expiring = this.query(['Expiring']);
  }
  tick(elapsed) {
    for (const entity of this.expiring.select()) {
      entity.Expiring.elapsed += elapsed;
      if (entity.Expiring.elapsed >= entity.Expiring.ttl) {
        this.world.destroy(entity);
      }
    }
  }
}

class Spawn extends System {
  tick() {
    const {Pixi: {app}} = this.world.entities.get(1);
    const {view: {height, width}} = app;
    if (lastEcsTiming >= TPS_IN_MS) {
      return;
    }
    // scale spawns based on available tick budget
    let N = Math.pow(2000, (1 - (lastEcsTiming / TPS_IN_MS)));
    for (let i = 0; i < N; ++i) {
      world.create({
        PixiParticle: {},
        Expiring: {ttl: 0.5},
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
    Position,
  },
  Systems: {
    Expire,
    Spawn,
  },
});

const app = new Application();
await app.init({autoStart: false, background: '#1099bb', resizeTo: window});

document.querySelector('.play').appendChild(app.canvas);

const globals = world.create({
  Pixi: {},
});
globals.Pixi.app = app;

const container = new ParticleContainer({
  dynamicProperties: {
    opacity: true,
    position: true,
    scale: false,
    rotation: false,
    color: false,
  },
});
app.stage.addChild(container);

let last = performance.now();
function tick() {
  setTimeout(tick, 1000 / TPS);
  const now = performance.now();
  const elapsed = (now - last) / 1000;
  last = now;
  world.tick(elapsed);
  entityCount.sample(world.entities.size - 1);
  lastEcsTiming = performance.now() - now;
  ecsTiming.sample(lastEcsTiming);
}
tick();

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  app.render();
  pixiTiming.sample(performance.now() - now);
}
render();

function renderInfo() {
  setTimeout(renderInfo, 250);
  document.querySelector('.info').innerHTML = [
    `ECS: ${(ecsTiming.average).toFixed(2)}~ms`,
    `PIXI: ${(pixiTiming.average).toFixed(2)}~ms`,
    `Entities: ${Math.round(entityCount.average)}~`,
    `Memory: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`,
  ].join('<br />');
}
renderInfo();
