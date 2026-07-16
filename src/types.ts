export const WorldDirtyBit = {
  CHANGED: 0,
  REMOVED: 1,
} as const

export type WorldDirtyBit = typeof WorldDirtyBit[keyof typeof WorldDirtyBit]

type JSONValue = (
  | boolean
  | null
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue }
)

type ComponentJSON = { [key: string]: JSONValue }

export type EntityDiff<K extends keyof any> = { [P in K]: ComponentJSON | false }
