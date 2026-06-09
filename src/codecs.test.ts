import { expect, test } from 'vitest';

import { WorldCodec } from './codecs.ts'
import { World } from './world.ts';
import { defineComponent } from './component.ts';
import { array, object, string, uint8 } from 'propertea';

test('world', () => {
  const world = World.create({
    components: {
      A: defineComponent({
        w: array({ element: string() }),
        x: uint8(),
        y: uint8(),
        a: object({
          z: uint8(),
        }),
      })
    },
    systems: {}
  })
  const entity = world.createEntity({A: {}})
  const codec = new WorldCodec(world)
  world.markClean()
  entity.A.y = 1
  entity.A.w.setAt(0, 'hi')
  entity.A.a.z = 2
  const diff = world.diff()
  expect(codec.decode(codec.encode(diff))).to.deep.equal(diff)
})
