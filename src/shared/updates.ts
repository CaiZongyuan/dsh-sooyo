import type { BuildInfo } from './build.js'

export const PACKAGE_NAME = 'dsh-sooyo'
export const PROTOCOL_VERSION = 1
export const PROTOCOL_RANGE = { min: 1, max: 1 }
export const DATA_SCHEMA_VERSION = 2
export const UPDATE_CONTRACT = {
  version: 1,
  dataSchemaVersion: DATA_SCHEMA_VERSION,
  protocolVersion: PROTOCOL_VERSION,
  outboxVersion: 1,
} as const

export type UpdateContract = { [K in keyof typeof UPDATE_CONTRACT]: number }
export type RuntimePhase = 'running' | 'pausing' | 'paused' | 'closing' | 'closed'

export interface LocalRuntime {
  build: BuildInfo
  instanceId: string
  role: string
  ready: boolean
  phase: RuntimePhase
  contract: UpdateContract
}

export interface ReleaseCandidate {
  version: string
  publishedAt: string | null
  notes: string
  registry: string
  compatible: boolean
  reason: string | null
  contract: UpdateContract | null
}

export interface PluginUpdateStatus {
  state: 'unchecked' | 'current' | 'available' | 'error'
  checkedAt: string | null
  installedVersion: string | null
  runtime: LocalRuntime
  source: 'checkout' | 'registry' | 'other' | 'unknown'
  canUpdate: boolean
  reason: string | null
  candidate: ReleaseCandidate | null
  error: string | null
  development: { installedCommit: string | null; latestCommit: string | null; changed: boolean | null } | null
}

export interface PanelPresence {
  id: string
  dirty: boolean
  busy: boolean
  build: BuildInfo
}

export interface PreparedUpdate {
  requestId: string
  version: string
  registry: string
  instanceId: string
}

export function compatibleContract(value: unknown): value is UpdateContract {
  if (!value || typeof value !== 'object') return false
  return Object.entries(UPDATE_CONTRACT).every(([key, expected]) =>
    (value as Record<string, unknown>)[key] === expected)
}

export function stableVersion(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
}

export function compareStableVersions(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return (a[i] ?? 0) > (b[i] ?? 0) ? 1 : -1
  }
  return 0
}
