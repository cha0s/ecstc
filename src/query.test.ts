import { string, uint8 } from 'propertea';
import { expect, test, vi } from 'vitest';

import { defineComponent } from './component.ts';
import { Query } from './query.ts';
import { World } from './world.ts'

test('(in|ex)cludes', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  const query = new Query({ includes: { A }, excludes: { B } })
  const world = World.create({ components: { A, B }, systems: {} })
  const entityWithA = world.createEntity({ A: {} })
  const entityWithB = world.createEntity({ B: {} })
  const entityWithBoth = world.createEntity({ A: {}, B: {} })
  query.reindex(entityWithA)
  query.reindex(entityWithB)
  query.reindex(entityWithBoth)
  expect(query.entities).toHaveLength(1)
  expect(Array.from(query.select())).to.deep.equal(query.entities)
})

test('reindex existing', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  const query = new Query({ includes: { A } })
  const world = World.create({ components: { A, B }, systems: {} })
  const entityWithA = world.createEntity({ A: {} })
  query.reindex(entityWithA)
  entityWithA.addComponent('B')
  query.reindex(entityWithA)
  expect(query.entities).toHaveLength(1)
  expect(query.entities[0]).to.not.equal(null)
  expect(Array.from(query.select())).to.deep.equal(query.entities)
})

test('deindex', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  const query = new Query({ includes: { A } })
  const world = World.create({ components: { A, B }, systems: {} })
  const entityWithBoth = world.createEntity({ A: {}, B: {} })
  query.reindex(entityWithBoth)
  expect(query.entities).toHaveLength(1)
  expect(query.entities[0]).to.not.equal(null)
  expect(Array.from(query.select())).to.deep.equal(query.entities)
  entityWithBoth.removeComponent('A')
  query.reindex(entityWithBoth)
  expect(query.entities).toHaveLength(1)
  expect(query.entities[0]).to.equal(null)
})

test('callbacks', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  const onDeindex = vi.fn()
  const onInsert = vi.fn()
  const query = new Query({
    includes: { A },
    onDeindex,
    onInsert,
  })
  const world = World.create({ components: { A, B }, systems: {} })
  const entityWithBoth = world.createEntity({ A: {}, B: {} })
  query.reindex(entityWithBoth)
  expect(onInsert).toHaveBeenCalledExactlyOnceWith(entityWithBoth)
  // nop reindex
  query.reindex(entityWithBoth)
  expect(onDeindex).toHaveBeenCalledTimes(0)
  expect(onInsert).toHaveBeenCalledExactlyOnceWith(entityWithBoth)
  onDeindex.mockClear()
  onInsert.mockClear()
  // remove the inclusion, so it gets deindexed
  entityWithBoth.removeComponent('A')
  query.reindex(entityWithBoth)
  expect(onDeindex).toHaveBeenCalledExactlyOnceWith(entityWithBoth)
  expect(onInsert).toHaveBeenCalledTimes(0)
  query.reindex(entityWithBoth)
  expect(onDeindex).toHaveBeenCalledExactlyOnceWith(entityWithBoth)
  expect(onInsert).toHaveBeenCalledTimes(0)
})

test('types', () => {
  const A = defineComponent({
    test: uint8(),
  })
  const B = defineComponent({
    test: string(),
  })
  const query = new Query({
    includes: { A },
  })
  const world = World.create({ components: { A, B }, systems: {} })
  const entityWithBoth = world.createEntity({ A: {}, B: {} })
  query.reindex(entityWithBoth)
  for (const entity of query.select()) {
    entity.A.test = 43
    expect(entity.id).to.equal(entityWithBoth.id)
  }
  expect(entityWithBoth.toJSON()).to.deep.equal({ A: { test: 43 }, B: { test: '' }})
  const { length } = query.entities
  for (let i = 0; i < length; ++i) {
    const entity = query.entities[i]
    if (entity) {
      expect(entity.id).to.equal(entityWithBoth.id)
      entity.A.test = 56
    }
  }
  expect(entityWithBoth.toJSON()).to.deep.equal({ A: { test: 56 }, B: { test: '' }})
})
