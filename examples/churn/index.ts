import { Application, Assets, ParticleContainer, Particle, Texture, Container } from 'pixi.js';
import { float32 } from 'propertea'

import { World, System, defineComponent, OnDestroy, OnInitialize, Query, type Elapsed, Entity } from '../../src/index.ts';

import expireBuffer from './expire.wat?multi_memory';

const TPS = 60;
const TPS_IN_MS = 1000 / TPS;
const texture: Texture = await Assets.load('../slime.png');

let isDiffChecked = false;
document.querySelector('.diffContainer [type="checkbox"]')!.addEventListener('change', () => {
  isDiffChecked = !isDiffChecked;
});

let strategy = 'proxy';
document.querySelector('.strategy')!.addEventListener('change', (event) => {
  strategy = (event.currentTarget as HTMLSelectElement).value;
});

const slider = document.querySelector<HTMLInputElement>('.target [type="range"]')!;
let isAutoTargetingChecked = true;
document.querySelector('.target [type="checkbox"]')!.addEventListener('change', () => {
  slider.disabled = !slider.disabled;
  isAutoTargetingChecked = !isAutoTargetingChecked;
});

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

let lastEcsTiming = 0;
let lastRenderTiming = 0;
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

const Expiring = defineComponent({
  expiresAt: float32(),
})

const Growing = defineComponent({}, {
  dependencies: ['PixiParticle'],
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
        particle.alpha = 0.8;
        particle.rotation = 0;
        particle.scaleX = 0;
        particle.scaleY = 0;
        particle.x = x;
        particle.y = y;
        this.particle = particle;
      }


    }
  },
})

interface ExpireWasmExports extends WebAssembly.Exports {
  tick: (delta: number, total: number) => void
}

class Expire extends System {

  expiring: Query
  wasm: ExpireWasmExports = null as any

  constructor(world: any) {
    super(world)
    this.expiring = this.query('expiring', { includes: ['Expiring'] });
  }

  wasmImports() {
    return {
      ...super.wasmImports(),
      system: {
        destroy: (index: number) => {
          const proxy = this.world.pools.Expiring.proxies[index];
          proxy && this.world.destroyEntity(proxy.entity);
        },
      },
    };
  }

  // tick using the selected strategy
  // each strategy results in an identical world state transformation
  tick(elapsed: Elapsed) {
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
        for (const entity of this.expiring.entities) {
          if (!entity) continue
          if (elapsed.total >= entity.Expiring.expiresAt) {
            this.world.destroyEntity(entity);
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
        const pool = this.world.pools.Expiring;
        const {length} = pool.proxies;
        let instance;
        const array = new Float32Array(pool.data.memory.buffer);
        for (let i = 0; i < length; ++i) {
          if (elapsed.total >= array[i]) {
            if ((instance = pool.proxies[i])) {
              this.world.destroyEntity(instance.entity);
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
    const { Pixi: { container, particles } } = this.world.entityInstances[0];
    let i = 0;
    for (const particle of particles) {
      container.particleChildren[i++] = particle;
    }
    container.particleChildren.length = particles.size;
  }
}

const TWO_PI = (2 * Math.PI);

class Grow extends System {
  growing: Query
  constructor(world: World) {
    super(world)
    this.growing = this.query('growing', { includes: ['Growing'] });
  }
  tick(elapsed: Elapsed) {
    const delta = elapsed.delta * 5;
    for (const proxy of this.growing.entities) {
      if (!proxy) continue
      const p = proxy.PixiParticle.particle;
      p.rotation += delta * proxy.PixiParticle.velocity * TWO_PI;
      p.scaleX += 0.25 * delta;
      p.scaleY += 0.25 * delta;
    }
  }
}

class Spawn extends System {
  tick(elapsed: Elapsed) {
    const {Pixi: {app}} = this.world.entityInstances[0];
    const {canvas: {height, width}} = app;
    const lastTiming = lastEcsTiming + lastRenderTiming;
    let N;
    let t, k;
    const ceiling = 5000;
    const spawnCount = this.world.entityCount - 1;
    if (isAutoTargetingChecked) {
      if (lastTiming >= TPS_IN_MS) {
        return;
      }
      k = (lastTiming / TPS_IN_MS);
      t = ceiling;
      slider.value = String(spawnCount);
      slider.max = String(Number(slider.value) * 2);
    }
    else {
      if (spawnCount >= Number(slider.value)) {
        return;
      }
      k = spawnCount / Number(slider.value);
      t = Math.min(Number(slider.value), ceiling);
    }
    N = Math.min(ceiling, t - Math.pow(t, k));
    for (let i = 0; i < N; ++i) {
      this.world.createEntity({
        Position: {x: Math.random() * width, y: Math.random() * height},
        PixiParticle: {velocity: Math.random() * 2 - 1},
        Expiring: {expiresAt: elapsed.total + 0.75 + (i / N) * 0.25},
        Growing: {},
      });
    }
  }
}

const world = World.create({
  components: {
    Pixi,
    PixiParticle,
    Expiring,
    Growing,
    Position,
  },
  systems: {
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

document.querySelector('.play')!.appendChild(app.canvas);

const globals = world.createEntity({
  Pixi: {},
});
globals.Pixi.app = app;

const container = new ParticleContainer({
  dynamicProperties: {
    color: true,
    rotation: true,  // Must be true if particles are meant to rotate
    vertex: true,
  }
});
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
  entityCount.sample(world.entityInstances.filter(Boolean).length - 1);
  ecsTiming.sample(lastEcsTiming = performance.now() - now);
}
tick()

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
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
    memory: (performance as any).memory ?
      `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MiB`
      : '[no access]',
  }
  for (const key in o) {
    document.querySelector<HTMLElement>(`.${key}`)!.innerText = o[key as keyof typeof o];
  }
}
renderInfo();
