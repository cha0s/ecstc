import {
  int16,
  float32,
} from 'propertea'

import { defineComponent } from './component.ts'
import { World } from './world.ts'

const Position = defineComponent({
  decorator: (Component) => {
    return class Blah extends Component {
      foo() { return 1 }
    }
  },
  properties: {
    x: int16(),
    y: int16(),
  },
})

const Angle = defineComponent({
  dependencies: ['Position'],
  properties: {
    angle: float32(),
  }
})

const Tag = defineComponent()

const componentsConfiguration = {
  Angle,
  Position,
  Tag,
}

const world = World.create({
  components: componentsConfiguration,
  decorateEntity: (Entity) => class extends Entity { foo() { return 42 }},
  systems: {},
})
// const entity = new world.Entity(world)
const entity = world.createSpecificEntity(1, {Position: {x: 35}})
// const entity = world.createSpecificEntity(
//   1,
//   JSON.parse(JSON.stringify({Position: {x: 35}})),
// )
// const entity = world.createSpecificEntity(
//   1,
// )
  // .addComponent('Position', {x: 35})

// const position = world.allocateComponent(entity, 'Position', {x: 35} )

type StrictNumber<T extends number> = 0 extends (1 & T) ? never : T
function test<T extends number>(t: StrictNumber<T>) { console.log(t) }

test(entity.Position.foo())
test(entity.Position.entity.id)
test(entity.Position.x)

// if (entity.has('Position')) {
//   test(entity.Position.foo())
//   test(entity.Position.entity.id)
//   test(entity.Position.x)
// }
test(entity.foo())

const query = world.query({excludes: [], includes: ['Position']})
console.log(Array.from(query.select()))
