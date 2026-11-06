import type { ConflictEntry, DailySnapshot, Item, Precondition, Proposal, SourceMeta } from './domain.ts'

export type SyncRole = 'standalone' | 'hub' | 'client'
export type SyncTokenAccess = 'read' | 'write'

export interface SyncTokenSpec {
  token: string
  device: string
  access: SyncTokenAccess
}

export interface SyncConfig {
  role: SyncRole
  device: string
  endpoint: string | null
  token: string | null
  tokens: SyncTokenSpec[]
  allowLoopbackOnly: boolean
  cacheMs: number
  timeoutMs: number
  error: string | null
}

export interface SyncHealthResponse {
  ok: boolean
  protocolVersion: number
  protocolRange: { min: number; max: number }
  dataSchemaVersion: number
  capabilities: readonly string[]
  role: SyncRole
  device: string
  dataRevision: number
  itemsUpdatedAt: string | null
}

export type ExportMode = 'portable' | 'backup'

export interface ExportRow<T = Record<string, unknown>> {
  key: string
  value: T
}

export interface ExportDocument {
  kind: 'sooyo-export'
  exportVersion: number
  dataSchemaVersion?: number
  mode?: ExportMode
  generatedAt: string
  source: {
    device: string
    role: SyncRole | string
    dataRevision: number
  }
  counts: Record<string, number>
  tables: Record<string, ExportRow[]>
  referencedItems?: ExportRow<Item>[]
  checksum?: string
}

export interface ImportConflict {
  table: string
  key: string
  current: Record<string, unknown>
  incoming: Record<string, unknown>
}

export interface ImportRejected {
  table: string
  key: string
  reason: string
}

export interface ImportOperation {
  table: string
  key: string
  kind: 'create' | 'update'
  value: Record<string, unknown>
}

export interface ImportPlan {
  ok: boolean
  error?: string
  mode?: ExportMode
  source?: ExportDocument['source']
  summary: {
    create: number
    update: number
    identical: number
    conflict: number
    rejected: number
  }
  perTable: Record<string, { create: number; update: number; identical: number; conflict: number; rejected: number }>
  conflicts: ImportConflict[]
  rejected: ImportRejected[]
  operations: ImportOperation[]
}

export interface SooyoService {
  readonly role: SyncRole
  readonly isAuthoritative: boolean
  ready(): boolean
  state(): { ready: boolean; revision: number; updatedAt: string | null }
  snapshot(options?: { force?: boolean }): Promise<DailySnapshot>
  items(query?: Record<string, unknown>): Promise<{
    ready: boolean
    stale?: boolean
    error?: string | null
    matched: number
    total: number
    items: Item[]
  }>
  sources(): Promise<{ ready: boolean; sources: SourceMeta[]; itemCount?: number; articleCount?: number }>
  context(options?: { limit?: number }): Promise<Record<string, unknown>>
  execute(command: {
    operationId?: string
    name: string
    body?: Record<string, unknown>
    precondition?: Precondition | null
    actor?: { device?: string; access?: 'read' | 'write'; local?: boolean }
  }): Promise<Record<string, unknown>>
  decideProposal?(input: {
    id: string
    decision: 'approve' | 'reject' | 'rollback'
    precondition?: Precondition | null
  }): Promise<{ ok: boolean; status?: number; proposal?: Proposal; applied?: unknown; dataRevision?: number; error?: string }>
  outboxList?(): OutboxEntrySummary[]
  conflictList?(): ConflictEntry[]
  flushOutbox?(): Promise<{ flushed: number; conflicts: number; remaining: number }>
  resolveConflict?(input: { operationId: string; action: 'discard' | 'retry' }): Promise<{ ok: boolean; error?: string }>
}

export interface OutboxEntrySummary {
  operationId: string
  name: string
  body: Record<string, unknown>
  precondition?: Precondition | null
  createdAt: string
  attempts: number
  lastError?: string | null
}
