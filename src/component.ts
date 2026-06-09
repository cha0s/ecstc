import {
  type ProperteaObjectProps,
  type ProperteaObjectShape,
  type ProxyDecorator,
  Pool,
  ProperteaObject,
} from 'propertea'

import { type Entity } from './entity.ts'
import { type World } from './world.ts'

export const OnDestroy = Symbol('Ecstc.OnDestroy')
export const OnInitialize = Symbol('Ecstc.OnInitialize')

export type ComponentConfiguration<
  P extends ProperteaObjectProps,
  Decorator extends object = {}
> = {
  decorator?: ProxyDecorator<ProperteaObjectShape<ProperteaObjectProps> & ComponentExtension<any>, Decorator>;
  dependencies?: string[];
  properties: P;
}

export interface ComponentExtension<W extends World<any, any, any>> {
  entity: Entity<W> | null
  [OnDestroy](): void
  [OnInitialize](): void
}

export type ComponentProps<CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<infer P, any> ? P : never

export type ComponentDecorator<W extends World<any, any, any>, CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<any, infer D> ? D & ComponentExtension<W> : never

export type ComponentPool<W extends World<any, any, any>, CC, K extends keyof CC> =
  Pool<ProperteaObject<ComponentProps<CC, K>, ComponentDecorator<W, CC, K>>>

// export function defineComponent<
//   P extends ProperteaObjectProps,
//   Decorator extends object = {}
// >(definition: ComponentConfiguration<P, Decorator> = {}) {
//   return definition
// }

export function defineComponent<
  P extends ProperteaObjectProps,
  Decorator extends object = {}
>(
  properties: P,
  config?: {
    decorator?: ProxyDecorator<ProperteaObjectShape<P> & ComponentExtension<any>, Decorator>;
    dependencies?: string[];
  }
): ComponentConfiguration<P, Decorator> {
  return { properties, ...config } as any
}
