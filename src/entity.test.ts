import { MarkClean, string, uint8 } from 'propertea';
import { assert, expect, test } from 'vitest';

import { defineComponent, OnDestroy, OnInitialize } from './component.ts';
import { World } from './world.ts'

test('component manipulation', () => {
  let wasDestroyed = false
  let wasInitialized = false
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
    decorator: (A) => {
      return class extends A {
        [OnDestroy]() {
          wasDestroyed = true
        }
        [OnInitialize]() {
          wasInitialized = true
        }
      }
    }
  })
  const B = defineComponent({
    properties: {
      test: string(),
    },
  })
  const world = new World({ components: { A, B }, systems: {} })
  // initialize
  const entity = world.createEntity({A: {test: 1}})
  expect(wasInitialized).to.equal(true)
  // existence
  expect(entity.has('A')).to.equal(true)
  expect(entity.A.test).to.equal(1)
  expect(entity.A.entity).to.equal(entity)
  expect(entity.has('B')).to.equal(false)
  // @ts-expect-error - entity only includes explicit components
  assert.notExists(entity.B)
  // removal
  const component = entity.A
  const entityWithoutA = entity.removeComponent('A')
  entityWithoutA.removeComponent('A') // dupe - no problem
  // @ts-expect-error - typed removal
  assert.notExists(entityWithoutA.A)
  expect(entity.A).to.equal(null)
  expect(component.entity).to.equal(null)
  expect(wasDestroyed).to.equal(true)
  // addition
  const entityWithB = entity.addComponent('B', { test: 'foo' })
  expect(entityWithB.B.test).to.equal('foo')
  // @ts-expect-error - exists despite lack of type awareness
  assert.exists(entity.B)
  const entityWithoutComponents = entityWithB.destroyComponents()
  // @ts-expect-error - no components
  assert.notExists(entityWithoutComponents.B)
  // removed despite type unawareness
  assert.notExists(entityWithB.B)
})

test('diffs', () => {
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
  })
  const B = defineComponent({
    properties: {
      test: string(),
    },
  })
  const C = defineComponent()
  const world = new World({ components: { A, B, C }, systems: {} })
  const entity = world.createEntity({ A: { test: 1 } })
  expect(entity.diff()).to.deep.equal({ A: { test: 1 } })
  world.markClean()
  entity.addComponent('B', { test: 'foo'})
  expect(entity.diff()).to.deep.equal({ B: { test: 'foo' } })
  world.markClean()
  entity.removeComponent('A')
  expect(entity.diff()).to.deep.equal({ A: false })
  world.markClean()
  entity.set({ B: false })
  // @ts-expect-error - removed
  assert.notExists(entity.B)
  expect(entity.diff()).to.deep.equal({ B: false })
  world.markClean()
  assert.notExists(entity.A)
  entity.set({ A: { test: 2 } })
  assert.exists(entity.A) // added
  expect(entity.diff()).to.deep.equal({ A: { test: 2 } })
  entity.set({ A: { test: 3 } })
  expect(entity.diff()).to.deep.equal({ A: { test: 3 } }) // updated
  world.markClean()
  // empty
  entity.set({ C: {} })
  expect(entity.diff()).to.deep.equal({ C: {} }) // updated
  // only world dirty
  world.markClean()
  entity.set({ A: { test: 4 } })
  ;(entity.A as any)[MarkClean]()
  expect(entity.diff()).to.deep.equal(undefined) // updated
})

test('json', () => {
  const A = defineComponent({
    properties: {
      test: uint8(),
    },
  })
  const B = defineComponent({
    properties: {
      test: string(),
    },
  })
  const world = new World({ components: { A, B }, systems: {} })
  const entity = world.createEntity()
  expect(entity.toJSON()).to.deep.equal({})
  entity.addComponent('A', { test: 1 })
  expect(entity.toJSON()).to.deep.equal({ A: { test: 1 } })
  expect(entity.toJSONWithoutDefaults({ A: { test: 1 }})).to.deep.equal({})
  expect(entity.toJSONWithoutDefaults({ A: { test: 2 }})).to.deep.equal({ A: { test: 1 }})
})
