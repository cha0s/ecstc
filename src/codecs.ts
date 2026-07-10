import {
  CrunchesMap,
  CrunchesObject,
  CrunchesOptional,
  CrunchesType,
  CrunchesVarUint,
  map,
  object as crunchesObject,
  varuint,
  type InferObjectInput,
  type InferObjectOutput,
  type Target,
} from 'crunches'
import { object } from 'propertea'

import type { ComponentConfiguration } from './component.ts'

export class WorldUpdateCodec<
  CC extends { [K in keyof CC]: ComponentConfiguration<any, any, any> } = {}
>
  extends CrunchesType<
    Map<number, InferObjectOutput<Record<keyof CC, any>> | undefined>,
    Map<number, InferObjectInput<Record<keyof CC, any>> | undefined>
  >
{

  mapCodec: CrunchesMap<CrunchesVarUint, CrunchesObject<Record<keyof CC, any>>, true>
  components: CC

  constructor(components: CC) {
    super()
    this.components = components
    const componentProperties: Record<keyof CC, CrunchesOptional<CrunchesObject<any>>> = {} as any
    for (const componentName in components) {
      const { properties = {} } = components[componentName]
      const { codec } = object(properties)
      componentProperties[componentName as keyof CC] = codec
    }
    this.mapCodec = map({
      key: varuint(),
      value: crunchesObject(componentProperties).deepOptional(),
      sparse: true,
    })
  }

  decodeFrom(view: DataView, target: Target) {
    return this.mapCodec.decodeFrom(view, target)
  }

  encodeInto(
    value: Map<number, InferObjectInput<Record<keyof CC, any>> | undefined>,
    view: DataView,
    byteOffset: number
  ) {
    return this.mapCodec.encodeInto(value, view, byteOffset)
  }

  sizeOf(
    value: Map<number, InferObjectInput<Record<keyof CC, any>> | undefined>,
    byteOffset: number
  ) {
    return this.mapCodec.sizeOf(value, byteOffset)
  }

}
