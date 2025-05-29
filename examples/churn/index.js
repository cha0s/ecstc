import {Application, Assets, ParticleContainer, Particle} from 'pixi.js';

import {Component, World, System} from '../../src/index.js';

const texture = await Assets.load('../slime.png');
const TPS = 60;
const TPS_IN_MS = 1000 / TPS;

let dba = false;
document.querySelector('.dba').addEventListener('change', () => {
  dba = !dba;
})

class SMA {
  caret = 0;
  samples = Array(10).fill(0);
  get average() {
    return this.samples.reduce((average, sample) => average + sample, 0) / this.samples.length;
  }
  sample(sample) {
    this.samples[this.caret] = sample;
    this.caret = (this.caret + 1) % this.samples.length;
  }
}


let lastTiming = 0;
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

class Growing extends Component {
  static dependencies = ['PixiParticle'];
}

class PixiParticle extends Component {
  static dependencies = ['Position'];
  particle = null;
  static pool = [];
  onDestroy() {
    this.constructor.pool.push(this.particle);
    this.particle = null;
  }
  onInitialize() {
    const {x, y} = this.entity.Position;
    const {Pixi: {app}} = this.entity.world.entities.get(1);
    const [container] = app.stage.children;
    let particle;
    if (this.constructor.pool.length > 0) {
      particle = this.constructor.pool.pop();
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
    container.particleChildren.push(particle);
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
    const children = new Set(container.particleChildren);
    if (dba) {
      const {pool} = this.world.Components.Expiring;
      let position = 0;
      for (const view of pool.chunks) {
        const array = new Float32Array(view.buffer);
        for (let i = 0, j = 0; i < array.length / 2; ++i, j += 2) {
          if (pool.instances[position]) {
            array[j] += elapsed;
            if (array[j] >= array[j + 1]) {
              const {entity} = pool.instances[position];
              children.delete(entity.PixiParticle.particle);
              this.world.destroy(entity);
            }
          }
          position += 1;
        }
      }
    }
    else {
      for (const entity of this.expiring.select()) {
        entity.Expiring.elapsed += elapsed;
        if (entity.Expiring.elapsed >= entity.Expiring.ttl) {
          children.delete(entity.PixiParticle.particle);
          this.world.destroy(entity);
        }
      }
    }
    container.particleChildren = Array.from(children);
  }
}

class Grow extends System {
  onInitialize() {
    this.growing = this.query(['Growing']);
  }
  tick(elapsed) {
    for (const entity of this.growing.select()) {
      entity.PixiParticle.particle.scaleX += elapsed * 2;
      entity.PixiParticle.particle.scaleY += elapsed * 2;
    }
  }
}

class Spawn extends System {
  tick() {
    const {Pixi: {app}} = this.world.entities.get(1);
    const {view: {height, width}} = app;
    if (lastTiming >= TPS_IN_MS) {
      return;
    }
    // scale spawns based on available tick budget
    const ceiling = 5000;
    let N = ceiling - Math.pow(ceiling, Math.min(1, (lastTiming / TPS_IN_MS) * 1));
    for (let i = 0; i < N; ++i) {
      world.create({
        PixiParticle: {},
        Expiring: {ttl: 1},
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
  },
});

const app = new Application();
await app.init({autoStart: false, background: '#1099bb', resizeTo: window});

document.querySelector('.play').appendChild(app.canvas);

const globals = world.create({
  Pixi: {},
});
globals.Pixi.app = app;

const container = new ParticleContainer();
app.stage.addChild(container);

let last = performance.now();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const elapsed = (now - last) / 1000;
  last = now;
  world.tick(elapsed);
  world.markClean();
  entityCount.sample(world.entities.size - 1);
  ecsTiming.sample(performance.now() - now);
  const start = performance.now();
  container.onViewUpdate();
  app.render();
  pixiTiming.sample(performance.now() - start);
  lastTiming = performance.now() - now;
}
tick();

window.hey = (event) => {
  console.log('hey', event)
}

function renderInfo() {
  setTimeout(renderInfo, 250);
  const o = {
    ecs: `${(ecsTiming.average).toFixed(2)}~ms`,
    pixi: `${(pixiTiming.average).toFixed(2)}~ms`,
    entities: `${Math.round(entityCount.average)}~`,
    memory: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`,
    churned: `${world.caret}`,
  }
  for (const key in o) {
    document.querySelector(`.${key}`).innerText = o[key];
  }
}
renderInfo();
