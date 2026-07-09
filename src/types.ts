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

export type ComponentDiff = JSONValue
export type EntityDiff<K extends keyof any> = { [P in K]: ComponentDiff | false }
