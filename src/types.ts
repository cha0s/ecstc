export const WorldDirtyBit = {
  CHANGED: 1,
  REMOVED: 2,
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

export type EntityDiff<K extends keyof any> = { [P in K]: ComponentJSON | undefined }
