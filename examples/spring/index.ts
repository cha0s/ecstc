import { Application, Assets, ParticleContainer, Particle, Texture, Container } from 'pixi.js';
import { float32 } from 'propertea'

import {
  type Elapsed,
  Entity,
  defineComponent,
  OnDestroy,
  OnInitialize,
  Query,
  System,
  World,
  WorldDirtyBit,
} from '../../src/index.ts';

import integrateBuffer from './integrate.wat?multi_memory';

const TPS = 60;
const texture: Texture = await Assets.load('../slime.png')

let isDiffChecked = false;
document.querySelector('.diffContainer [type="checkbox"]')!.addEventListener('change', () => {
  isDiffChecked = !isDiffChecked;
});

let strategy = 'wasm';
document.querySelector('.strategy')!.addEventListener('change', (event) => {
  strategy = (event.currentTarget as HTMLSelectElement).value;
});

const slider = document.querySelector<HTMLInputElement>('.target [type="range"]')!;

class SMA {
  caret = 0;
  samples = Array(TPS).fill(0);
  get average() {
    return this.samples.reduce((average, sample) => average + sample, 0) / this.samples.length;
  }
  sample(sample: number) {
    this.samples[this.caret] = sample;
    this.caret = (this.caret + 1) % this.samples.length;
  }
}

const entityCount = new SMA();
const diffTiming = new SMA();
const ecsTiming = new SMA();
const pixiTiming = new SMA();

const Pixi = defineComponent({}, {
  decorator: (Component) => {
    return class extends Component {
      app?: Application
      container?: Container
      particles = new Set();
    }
  },
})

const Position = defineComponent({
  x: float32(),
  y: float32(),
})

const Spring = defineComponent({
  angle: float32(),
  damping: float32().default(10),
  mass: float32().default(1),
  point: float32(),
  stiffness: float32().default(500),
  velocity: float32(),
})

const Expiring = defineComponent({
  expiresAt: float32(),
})

const freeParticles: Particle[] = []
const PixiParticle = defineComponent({
  velocity: float32(),
}, {
  dependencies: ['Position'],
  decorator: (Component) => {
    return class extends Component {

      particle: Particle | null = null;
      // reactive callbacks may be used to manage side-effects. here, we manage pixi.js particles
      [OnDestroy]() {
        freeParticles.push(this.particle!);
        const {Pixi: {particles}} = (this.entity as Entity).world.entityInstances[0];
        particles.delete(this.particle);
        this.particle = null;
      }
      [OnInitialize]() {
        const {x, y} = (this.entity as any).Position;
        const {Pixi: {particles}} = (this.entity as Entity).world.entityInstances[0];
        const particle = freeParticles.length > 0
          ? freeParticles.pop()!
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
        particle.alpha = 0.4;
        particle.rotation = 0;
        const s = (width + height) / 8000;
        particle.scaleX = s;
        particle.scaleY = s;
        particle.x = x;
        particle.y = y;
        this.particle = particle;
      }
    }
  },
})

class RefreshParticles extends System {
  tick() {
    const {Pixi: {container, particles}} = this.world.entityInstances[0];
    let i = 0;
    for (const particle of particles) {
      container.particleChildren[i++] = particle;
    }
    container.particleChildren.length = particles.size;
  }
}

const S_DAMPING = 1
const S_MASS = 2
const S_POINT = 3
const S_STIFFNESS = 4
const S_VELOCITY = 5

interface IntegrateWasmExports extends WebAssembly.Exports {
  tick: (delta: number, total: number) => void
}

class Integrate extends System {
  springs: Query
  wasm: IntegrateWasmExports = null as any;
  constructor(world: World) {
    super(world)
    this.springs = this.query('springs', { includes: ['Spring'] });
  }
  tick(elapsed: Elapsed) {
    const {delta} = elapsed;
    switch (strategy) {
      case 'typedArray': {
        const { data, dirty, property: { dirtyByteWidth }} = this.world.pools.Spring;
        const dataArray = new Float32Array(data.memory.buffer);
        const dirtyArray = new Uint8Array(dirty.memory.buffer);
        const { entities, query: { view }, width } = this.springs
        for (let queryIndex = 0; queryIndex < entities.length; ++queryIndex) {
          const entity = entities[queryIndex]
          if (!entity) continue
          const springIndex = view[queryIndex * width + 1]
          const springOffset = springIndex * dirtyByteWidth
          const F_spring = -dataArray[springOffset + S_STIFFNESS] * dataArray[springOffset + S_POINT];
          const F_damp = -dataArray[springOffset + S_DAMPING] * dataArray[springOffset + S_VELOCITY];
          const v = ((F_spring + F_damp) / dataArray[springOffset + S_MASS]) * delta;
          let dirtied = false
          if (Math.abs(v) > 0.001) {
            dataArray[springOffset + S_VELOCITY] += v;
            const j = springOffset + S_VELOCITY
            dirtyArray[j >> 3] |= 1 << (j & 7);
            dirtied = true
          }
          const p = dataArray[springOffset + S_VELOCITY] * delta;
          if (Math.abs(p) > 0.001) {
            dataArray[springOffset + S_POINT] += p;
            const j = springOffset + S_POINT
            dirtyArray[j >> 3] |= 1 << (j & 7);
            dirtied = true
          }
          if (dirtied) {
            world.setComponentDirty(entity.index, 'Spring', WorldDirtyBit.CHANGED)
          }
        }
        break;
      }
      case 'wasm': {
        this.wasm.tick(elapsed.delta, elapsed.total);
        break;
      }
      case 'proxy': {
        for (const entity of this.springs.entities) {
          if (!entity) continue
          const {damping, mass, point, stiffness, velocity} = entity.Spring;
          const F_spring = -stiffness * point;
          const F_damp = -damping * velocity;
          const v = ((F_spring + F_damp) / mass) * delta;
          if (Math.abs(v) > 0.001) {
            entity.Spring.velocity += v;
          }
          const p = entity.Spring.velocity * delta;
          if (Math.abs(p) > 0.001) {
            entity.Spring.point += p;
          }
        }
        break;
      }
    }
  }
}

class Move extends System {
  positionedSpringParticles: Query
  constructor(world: World) {
    super(world)
    this.positionedSpringParticles = this.query('positionedSpringParticles', { includes: ['PixiParticle', 'Position', 'Spring'] });
  }
  tick() {
    for (const entity of this.positionedSpringParticles.entities) {
      if (!entity) continue
      const { PixiParticle: { particle }, Spring: { angle, point }, Position } = entity
      particle.x = Position.x + Math.cos(angle) * point
      particle.y = Position.y + Math.sin(angle) * point
    }
  }
}

class Orient extends System {
  positionedSprings: Query
  constructor(world: World) {
    super(world)
    this.positionedSprings = this.query('positionedSprings', { includes: ['Position', 'Spring'] });
  }
  tick() {
    const {canvas: {height, width}} = app;
    const radius = (width + height) / 60;
    const radiusSq = radius * radius;
    for (const entity of this.positionedSprings.entities) {
      if (!entity) continue
      const xd = entity.Position.x - position.x;
      const yd = entity.Position.y - position.y;
      const distSq = xd * xd + yd * yd;
      if (distSq < radiusSq) {
        const angle = Math.atan2(yd, xd);
        const distance = Math.hypot(xd, yd);
        const point = -Math.pow(distance, 1 - (distance / radius));
        entity.Spring.angle = angle;
        entity.Spring.point = point;
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
      damping: 5 + Math.random() * 10,
      mass: 1 + Math.random() * 5,
      point: 0,
      stiffness: Math.random() * 2000,
      velocity: 0,
    },
  };
}

class Spawn extends System {
  tick() {
    const spawnCount = this.world.entityCount - 1;
    let diff = Number(slider.value) - spawnCount;
    if (diff < 0) {
      for (let i = 1; i < this.world.entityInstances.length; ++i) {
        if (this.world.entityInstances[i]) {
          this.world.destroyEntity(this.world.entityInstances[i]);
          if (0 === ++diff) {
            break;
          }
        }
      }
    }
    if (diff > 0) {
      for (let i = 0; i < diff; ++i) {
        world.createEntity(randomEntity());
      }
    }
  }
}

const world = new World({
  components: {
    Pixi,
    PixiParticle,
    Position,
    Expiring,
    Spring,
  },
  systems: {
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
]);

const {canvas: {height, width}} = app;
let angle = 0;
const position = {x: width / 2, y: height / 2};

document.querySelector('.play')!.appendChild(app.canvas);

const globals = world.createEntity({
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
  entityCount.sample(world.entityCount - 1);
  ecsTiming.sample(performance.now() - now);
  angle += (Math.random() * 0.5) - 0.25;
  const {canvas: {height, width}} = app;
  position.x += Math.cos(angle) * 15;
  position.y += Math.sin(angle) * 15;
  const x = position.x - (width / 4);
  const y = position.y - (height / 4);
  position.x = (width / 4) + ((x + (width / 2)) % (width / 2));
  position.y = (height / 4) + ((y + (height / 2)) % (height / 2));
}
tick();

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  container.update();
  app.render();
  pixiTiming.sample(performance.now() - now);
}
render();

function renderInfo() {
  setTimeout(renderInfo, 250);
  const ecsTimingValue = ecsTiming.average - (isDiffChecked ? diffTiming.average : 0);
  const o = {
    diff: isDiffChecked ? `${(diffTiming.average).toFixed(2)}~ms (${diff.size})` : '[enable to take diff]',
    ecs: `${(ecsTimingValue).toFixed(2)}~ms`,
    pixi: `${(pixiTiming.average).toFixed(2)}~ms`,
    entities: `${Math.round(entityCount.average).toLocaleString()} (${`${((ecsTiming.average / Math.round(entityCount.average)) * 1000).toFixed(4)}μs/op`})`,
    memory: (performance as any).memory ?
      `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`
      : '[no access]',
  }
  for (const key in o) {
    document.querySelector<HTMLElement>(`.${key}`)!.innerText = o[key as keyof typeof o];
  }
}
renderInfo();
