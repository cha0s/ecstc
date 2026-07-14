import {
  type ProperteaObjectProps,
  type ProperteaObjectProxyInterface,
  type ProxyDecorator,
  Pool,
  ProperteaObject,
} from 'propertea'

import { type Entity } from './entity.ts'
import { type World } from './world.ts'

export const OnDestroy = Symbol('Ecstc.OnDestroy')
export const OnInitialize = Symbol('Ecstc.OnInitialize')

export interface ComponentExtension<W extends World<any, any, any, any>> {
  entity: Entity<W> | null
  [OnDestroy](): void
  [OnInitialize](): void
}

export type ComponentProps<CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<infer P, any, any> ? P : never

export type ComponentDecorator<W extends World<any, any, any, any>, CC, K extends keyof CC> =
  CC[K] extends ComponentConfiguration<any, infer D, any> ? D & ComponentExtension<W> : never

export type ComponentPool<W extends World<any, any, any, any>, CC, UW extends boolean, K extends keyof CC> =
  Pool<ProperteaObject<ComponentProps<CC, K>, ComponentDecorator<W, CC, K>>, UW>

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

export type ComponentInstance<C> =
  C extends ComponentConfiguration<infer P, infer D, any>
    ? ProperteaObjectProxyInterface<P> & D & ComponentExtension<any>
    : never

export type ComponentDependencies<Deps extends Record<string, ComponentConfiguration<any, any, any>>> =
  & { [K in keyof Deps]: ComponentInstance<Deps[K]> }
  & UnionToIntersection<{
      [K in keyof Deps]: Deps[K] extends ComponentConfiguration<any, any, infer SubDeps extends Record<string, ComponentConfiguration<any, any, any>>>
        ? ComponentDependencies<SubDeps>
        : never
    }[keyof Deps]>

export type ComponentConfiguration<
  P extends ProperteaObjectProps,
  Decorator extends object = {},
  Deps extends Record<string, ComponentConfiguration<any, any, any>> = {}
> = {
  decorator?: ProxyDecorator<
    ProperteaObjectProxyInterface<P> & ComponentExtension<any> & { entity: Entity<any> & ComponentDependencies<Deps> },
    Decorator
  >
  dependencies?: Deps
  properties: P
}

export function defineComponent<
  P extends ProperteaObjectProps,
  Decorator extends object = {},
  Deps extends Record<string, ComponentConfiguration<any, any, any>> = {}
>(
  properties: P,
  config?: {
    decorator?: ProxyDecorator<
      ProperteaObjectProxyInterface<P> & ComponentExtension<any> & { entity: Entity<any> & ComponentDependencies<Deps> },
      Decorator
    >
    dependencies?: Deps
  }
): ComponentConfiguration<P, Decorator, Deps> {
  return { properties, ...config }
}
