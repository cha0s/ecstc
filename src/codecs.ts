import {
  CrunchesMap,
  CrunchesObject,
  CrunchesOptional,
  CrunchesType,
  CrunchesVarUint,
  map,
  object,
  varuint,
  type InferObjectInput,
  type InferObjectOutput,
  type Target,
} from "crunches"
import type { World } from "./world"

export class WorldCodec<
  W extends World<any>
>
  extends CrunchesType<
    Map<number, InferObjectOutput<Record<keyof W['_CC'], any>> | undefined>,
    Map<number, InferObjectInput<Record<keyof W['_CC'], any>> | undefined>
  >
{

  mapCodec: CrunchesMap<CrunchesVarUint, CrunchesObject<Record<keyof W['_CC'], any>>, true>
  world: W

  constructor(world: W) {
    super()
    this.world = world
    const { factories } = world.componentCollection
    const componentProperties: Record<
      keyof W['_CC'],
      CrunchesOptional<CrunchesObject<any>>
    > = {} as any
    for (const componentName in factories) {
      const factory = factories[componentName]
      componentProperties[componentName as keyof W['_CC']] = factory.proxyProperty.codec
    }
    this.mapCodec = map({
      key: varuint(),
      value: object(componentProperties).deepOptional(),
      sparse: true,
    })
  }

  decodeFrom(view: DataView, target: Target) {
    return this.mapCodec.decodeFrom(view, target)
  }

  encodeInto(
    value: Map<number, InferObjectInput<Record<keyof W['_CC'], any>> | undefined>,
    view: DataView,
    byteOffset: number
  ) {
    return this.mapCodec.encodeInto(value, view, byteOffset)
  }

  sizeOf(
    value: Map<number, InferObjectInput<Record<keyof W['_CC'], any>> | undefined>,
    byteOffset: number
  ) {
    return this.mapCodec.sizeOf(value, byteOffset)
  }

}
