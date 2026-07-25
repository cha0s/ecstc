import type { CrunchesJSONOutput } from 'crunches'

export const WorldDirtyBit = {
  CHANGED: 1,
  REMOVED: 2,
} as const

export type WorldDirtyBit = typeof WorldDirtyBit[keyof typeof WorldDirtyBit]

type ComponentJSON = { [key: string]: CrunchesJSONOutput }

export type EntityDiff<K extends keyof any> = { [P in K]: ComponentJSON | undefined }
