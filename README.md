![CI](https://github.com/cha0s/ecstc/actions/workflows/ci.yml/badge.svg)

# ecstc

ecstc (pronounced like "ecstasy") is a pure JS Entity Component System.

## :fire: Features

- WebAssembly compatibility
- Compute and apply state diffs
- World and System queries
- System priority scheduling with custom tick intervals
- Entity destruction dependency and reactivity
- Component proxy sugar, dependency tree
- Binary serialization

## Examples

ecstc works on `World`s. `World`s are composed from `Component`s and `System`s:

```js
import {Component, System, World} from 'ecstc';
```
### Define components
```js
const Components = {
```

#### Properties object

```js
  Position2D: {
    x: {type: 'float32'},
    y: {type: 'float32'},
  },
```

#### Subclass

You may subclass `Component` for even more control:

```js
  Velocity2D: class extends Component {
```
##### Proxy shape

We'll subclass the proxy to add a method.

```js
    static proxy(Proxy) {
      return class extends super.proxy(Proxy) {
        applyDamping() {
          this.x *= 0.5;
          this.y *= 0.5;
        }
      };
    }

```
We'll also define the properties like above, this time as a static class member:
```js
    static properties = {
      x: {type: 'float32'},
      y: {type: 'float32'},
    };
  },
}
```
### Define systems
```js
const Systems = {
  Move: class extends System {
    constructor(world) {
      super(world);
```

#### Queries

This query selects all entities with both `Position2D` and `Velocity2D` components:
```js
      this.movements = this.query(['Position2D', 'Velocity2D']);
    }
```
#### Tick handler

We select entities matching the query, do some basic physics integration on their positions, and then invoke the `applyDamping` method that we defined on velocities above.

```js
    tick({delta}) {
      for (const {Position2D, Velocity2D} of this.movements.select()) {
        Position2D.x += Velocity2D.x * delta;
        Position2D.y += Velocity2D.y * delta;
        Velocity2D.applyDamping();
      }
    }
  },
};
```
### Create a world and entity
```js
const world = new World({Components, Systems});
const entity = world.create({
  Position2D: {x: 10, y: 10},
});
```
### Tick the world

Ticking this world won't update the position of the entity since it doesn't have a velocity:

```js
world.tick(1);
assert(entity.Position2D.x === 10);
assert(entity.Position2D.y === 10);
```

### Add a component

We'll add a velocity and then tick the world thrice, which will integrate positions and apply velocity damping each time.

```js
entity.AddComponent('Velocity2D', {x: 5, y: -2});
world.tick(1);
assert(entity.Position2D.x === 15);    //   10 + 5
assert(entity.Position2D.y === 8);     //   10 - 2
world.tick(1);
assert(entity.Position2D.x === 17.5);  //   15 + 2.5
assert(entity.Position2D.y === 7);     //    8 - 1
world.tick(1);
assert(entity.Position2D.x === 18.75); // 17.5 + 1.25
assert(entity.Position2D.y === 6.5);   //    7 - 0.5
```
### Remove a component

Now the entity will no longer be selected in the system query, so its position again won't change:
```js
entity.removeComponent('Velocity2D');
world.tick(1);
assert(entity.Position2D.x === 18.75); // same as above
assert(entity.Position2D.y === 6.5);   // ''
```
