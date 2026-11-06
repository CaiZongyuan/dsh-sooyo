/**
 * Revision bookkeeping and the single write path every mutation goes through.
 */

import { SyncError, ERRORS, SAFE_KEY } from './protocol.ts'

export interface StorageTable {
  get(key: string): any
  entries(): IterableIterator<[string, any]> | Array<[string, any]>
  keys(): IterableIterator<string> | string[]
  readonly size: number
  put(key: string, value: any): Promise<any>
  delete(key: string): Promise<any>
  update?(key: string, mutate: (current: any) => any): Promise<any>
}

export type TableAccessor = (name: string) => StorageTable

/** The global record that carries the monotonic revision, in the `settings` table. */
export const REVISION_KEY = 'sync'

export const TABLES = {
  items: 'items',
  sources: 'sources',
  read: 'read',
  boards: 'boards',
  widgets: 'widgets',
  layouts: 'layouts',
  tasks: 'tasks',
  notes: 'notes',
  readlater: 'readlater',
  settings: 'settings',
  journal: 'journal',
  operations: 'operations',
  agentReviews: 'agent_reviews',
  agentInbox: 'agent_inbox',
} as const

export const JOURNAL_TABLE = TABLES.journal
export const IDEMPOTENCY_TABLE = TABLES.operations

const OPERATION_TTL_MS = 7 * 24 * 3600 * 1000

const nowIso = (): string => new Date().toISOString()

export interface WriteQueue {
  run<T>(operation: () => Promise<T> | T): Promise<T>
  readonly busy: boolean
  drain(): Promise<void>
}

export function createWriteQueue(): WriteQueue {
  let tail: Promise<void> = Promise.resolve()
  let depth = 0

  function run<T>(operation: () => Promise<T> | T): Promise<T> {
    depth += 1
    const result = tail.then(operation).finally(() => {
      depth -= 1
    })
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    run,
    get busy() {
      return depth > 0
    },
    drain: () => tail,
  }
}

export function readRevision(tables: TableAccessor): number {
  const record = tables('settings').get(REVISION_KEY)
  const value = Number(record?.revision)
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function revisionState(tables: TableAccessor) {
  const record = tables('settings').get(REVISION_KEY)
  return {
    revision: readRevision(tables),
    changedAt: record?.changedAt ?? null,
    writer: record?.writer ?? null,
    itemsRevision: Number.isSafeInteger(record?.itemsRevision) ? Number(record.itemsRevision) : 0,
    itemsUpdatedAt: record?.itemsUpdatedAt ?? null,
  }
}

export async function bumpRevision(tables: TableAccessor, writer: string | null, targetRevision: number | null = null) {
  const existing = tables('settings').get(REVISION_KEY) ?? {}
  const current = readRevision(tables)
  const next = targetRevision !== null && Number.isSafeInteger(targetRevision) && targetRevision > current
    ? targetRevision
    : current + 1
  const record = {
    ...existing,
    revision: next,
    changedAt: nowIso(),
    writer: writer ?? null,
  }
  await tables('settings').put(REVISION_KEY, record)
  return record
}

export async function touchItemsUpdated(tables: TableAccessor) {
  const existing = tables('settings').get(REVISION_KEY) ?? {}
  const currentRev = readRevision(tables)
  const itemsRevision = (Number.isSafeInteger(existing.itemsRevision) ? Number(existing.itemsRevision) : 0) + 1
  const record = {
    ...existing,
    revision: currentRev,
    itemsRevision,
    itemsUpdatedAt: nowIso(),
  }
  await tables('settings').put(REVISION_KEY, record)
  return record
}

export const revisionOf = (record: any): number =>
  Number.isSafeInteger(record?.revision) ? Number(record.revision) : 0

export function createStampTable(
  getTable: (name: string) => StorageTable,
  stamp: (tableName: string, key: string, value: any) => any,
): TableAccessor {
  return (name: string): StorageTable => {
    const table = getTable(name)
    return {
      get: (key: string) => table.get(key),
      entries: () => table.entries(),
      keys: () => table.keys(),
      get size() {
        return table.size
      },
      async put(key: string, value: any) {
        if (!SAFE_KEY.test(String(key))) throw new Error(`sooyo: "${key}" is not a path-safe key`)
        return table.put(key, stamp(name, key, value))
      },
      async delete(key: string) {
        if (!SAFE_KEY.test(String(key))) throw new Error(`sooyo: "${key}" is not a path-safe key`)
        return table.delete(key)
      },
      update: (key: string, mutate: (current: any) => any) =>
        table.update ? table.update(key, (current) => stamp(name, key, mutate(current))) : Promise.resolve(),
    }
  }
}

export const REVISED_TABLES = new Set<string>([
  TABLES.boards,
  TABLES.widgets,
  TABLES.layouts,
  TABLES.tasks,
  TABLES.notes,
  TABLES.settings,
  TABLES.read,
  TABLES.readlater,
  TABLES.agentReviews,
  TABLES.agentInbox,
])

export function stampRecord(tableName: string, key: string, value: any, revision: number | null): any {
  if (!REVISED_TABLES.has(tableName)) return value
  if (revision === null || !Number.isSafeInteger(revision) || revision <= 0) return value
  if (tableName === 'settings' && key === REVISION_KEY) return value
  if (!value || typeof value !== 'object') return value
  return { ...value, revision }
}

export interface Stamper {
  open(): void
  close(): void
  readonly revision: number | null
  stamp(tableName: string, key: string, value: any): any
}

export function makeStamper(tables: TableAccessor): Stamper {
  let pending: number | null = null
  return {
    open() {
      pending = readRevision(tables) + 1
    },
    close() {
      pending = null
    },
    get revision() {
      return pending
    },
    stamp(tableName: string, key: string, value: any) {
      return stampRecord(tableName, key, value, pending)
    },
  }
}

// ---- two-phase Intent ledger (journal + operations) -------------------------

const JOURNAL_PREFIX = (operationId: string): string => `j-${operationId}`

const serializeStep = (step: any, reservedRevision: number | null) => ({
  table: step.table,
  key: step.key,
  op: step.op,
  ...(step.op === 'delete'
    ? {}
    : { value: stampRecord(step.table, step.key, step.value, reservedRevision) }),
  ...(step.before === undefined ? {} : { before: step.before }),
})

export function journalOf(
  operationId: string,
  name: string,
  steps: any[],
  options: { reservedRevision?: number | null; writer?: string | null; plannedResult?: any } = {},
) {
  const reservedRevision = options.reservedRevision ?? null
  return {
    operationId,
    name,
    status: 'pending',
    reservedRevision,
    writer: options.writer ?? null,
    result: options.plannedResult ?? null,
    steps: steps.map((step) => serializeStep(step, reservedRevision)),
    done: 0,
    startedAt: nowIso(),
    attempt: 0,
  }
}

export async function runJournaled(
  tables: TableAccessor,
  operationId: string,
  name: string,
  steps: any[],
  options: {
    reservedRevision?: number | null
    writer?: string | null
    plannedResult?: any
    onKillPoint?: ((point: string, info?: any) => Promise<void> | void) | null
  } = {},
) {
  const reservedRevision = options.reservedRevision ?? (readRevision(tables) + 1)
  const onKillPoint = typeof options.onKillPoint === 'function' ? options.onKillPoint : null

  if (steps.length === 0) {
    return { journaled: false, steps: 0, reservedRevision, serialSteps: [] as any[] }
  }

  const journalTable = tables(JOURNAL_TABLE)
  const opsTable = tables(IDEMPOTENCY_TABLE)
  const key = JOURNAL_PREFIX(operationId)
  const record = journalOf(operationId, name, steps, { ...options, reservedRevision })

  await opsTable.put(operationId, {
    operationId,
    name,
    status: 'pending',
    reservedRevision,
    steps: record.steps,
    result: record.result,
    device: record.writer,
    startedAt: record.startedAt,
  })
  await journalTable.put(key, record)

  if (onKillPoint) await onKillPoint('after-intent-pending', { operationId, reservedRevision, steps: record.steps })

  for (let index = 0; index < record.steps.length; index += 1) {
    const step = record.steps[index]!
    if (step.op === 'delete') {
      await tables(step.table).delete(step.key)
    } else {
      await tables(step.table).put(step.key, step.value)
    }
    record.done = index + 1
    if (index + 1 < record.steps.length) {
      await journalTable.put(key, record)
      if (onKillPoint) await onKillPoint('mid-step', { operationId, stepIndex: index, done: record.done })
    }
  }

  if (onKillPoint) await onKillPoint('after-steps-before-bump', { operationId, reservedRevision })

  return { journaled: true, steps: record.steps.length, reservedRevision, serialSteps: record.steps }
}

async function completePendingIntent(
  tables: TableAccessor,
  intent: any,
  journalKey: string | null,
  log?: (msg: string) => void,
) {
  const steps: any[] = Array.isArray(intent?.steps) ? intent.steps : []
  const canReplay =
    steps.length > 0 &&
    steps.every(
      (step) =>
        step &&
        typeof step.table === 'string' &&
        typeof step.key === 'string' &&
        (step.op === 'delete' || (step.op === 'put' && step.value !== undefined)),
    )

  if (!canReplay) {
    return { completed: false, reason: 'unresumable' }
  }

  const reservedRevision: number =
    Number.isSafeInteger(intent.reservedRevision) && intent.reservedRevision > 0
      ? Number(intent.reservedRevision)
      : readRevision(tables) + 1

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!
    if (step.op === 'delete') {
      if (tables(step.table).get(step.key) !== undefined) {
        await tables(step.table).delete(step.key)
      }
    } else {
      const stamped = stampRecord(step.table, step.key, step.value, reservedRevision)
      await tables(step.table).put(step.key, stamped)
    }
  }

  if (readRevision(tables) < reservedRevision) {
    await bumpRevision(tables, intent.writer ?? intent.device ?? 'recovery', reservedRevision)
  }

  const finalRevision = Math.max(readRevision(tables), reservedRevision)
  if (intent.operationId && SAFE_KEY.test(String(intent.operationId))) {
    await tables(IDEMPOTENCY_TABLE).put(String(intent.operationId), {
      operationId: String(intent.operationId),
      name: intent.name ?? 'unknown',
      status: 'committed',
      result: intent.result ?? { ok: true },
      revision: finalRevision,
      reservedRevision,
      steps,
      device: intent.writer ?? intent.device ?? null,
      startedAt: intent.startedAt ?? null,
      appliedAt: nowIso(),
      recovered: true,
    })
  }
  if (journalKey) {
    await tables(JOURNAL_TABLE).delete(journalKey)
  }
  log?.(`sooyo: replayed pending intent ${intent.operationId ?? journalKey} (${intent.name}) at rev ${finalRevision}`)
  return { completed: true, revision: finalRevision }
}

export async function recover(tables: TableAccessor, log?: (msg: string) => void) {
  const report = {
    checked: 0,
    completed: 0,
    abandoned: 0,
    pruned: 0,
    errors: [] as Array<{ key: string; name: unknown; done: unknown; reason: string | undefined }>,
  }
  const journalTable = tables(JOURNAL_TABLE)
  const operations = tables(IDEMPOTENCY_TABLE)
  const handledOps = new Set<string>()

  for (const [key, record] of [...journalTable.entries()]) {
    report.checked += 1
    if (record?.operationId) handledOps.add(String(record.operationId))
    const outcome = await completePendingIntent(tables, record, key, log)
    if (outcome.completed) {
      report.completed += 1
    } else {
      report.errors.push({ key, name: record?.name, done: record?.done, reason: outcome.reason })
      log?.(`sooyo: journal ${key} (${record?.name}) needs attention: ${record?.done ?? 0} of ${record?.steps?.length ?? 0} steps landed`)
    }
  }

  for (const [opId, record] of [...operations.entries()]) {
    if (record?.status !== 'pending' || handledOps.has(opId)) continue
    report.checked += 1
    const jKey = JOURNAL_PREFIX(opId)
    const outcome = await completePendingIntent(tables, record, journalTable.get(jKey) ? jKey : null, log)
    if (outcome.completed) {
      report.completed += 1
    } else {
      report.errors.push({ key: opId, name: record?.name, done: 0, reason: outcome.reason })
    }
  }

  const cutoff = Date.now() - OPERATION_TTL_MS
  for (const [key, value] of [...operations.entries()]) {
    if (value?.status === 'pending') continue
    const at = Date.parse(value?.appliedAt ?? '')
    if (!Number.isFinite(at) || at < cutoff) {
      await operations.delete(key)
      report.pruned += 1
    }
  }
  return report
}

export async function replayOperation(tables: TableAccessor, operationId: string): Promise<any> {
  if (!SAFE_KEY.test(String(operationId))) return null
  const record = tables(IDEMPOTENCY_TABLE).get(operationId)
  if (!record) return null
  if (record.status === 'pending') {
    const jKey = JOURNAL_PREFIX(operationId)
    await completePendingIntent(tables, record, tables(JOURNAL_TABLE).get(jKey) ? jKey : null)
    return tables(IDEMPOTENCY_TABLE).get(operationId) ?? record
  }
  return record
}

export async function recordOperation(
  tables: TableAccessor,
  operationId: string,
  name: string,
  result: any,
  revision: number,
  device: string | null,
  extra: { reservedRevision?: number; steps?: any[] } = {},
) {
  if (!SAFE_KEY.test(String(operationId))) return
  const jKey = JOURNAL_PREFIX(operationId)
  await tables(IDEMPOTENCY_TABLE).put(operationId, {
    operationId,
    name,
    status: 'committed',
    result,
    revision,
    ...(extra.reservedRevision === undefined ? {} : { reservedRevision: extra.reservedRevision }),
    ...(extra.steps === undefined ? {} : { steps: extra.steps }),
    device: device ?? null,
    appliedAt: nowIso(),
  })
  if (tables(JOURNAL_TABLE).get(jKey)) {
    await tables(JOURNAL_TABLE).delete(jKey)
  }
}

export function assertOperationId(operationId: unknown): asserts operationId is string {
  if (typeof operationId !== 'string' || !SAFE_KEY.test(operationId)) {
    throw new SyncError(ERRORS.badRequest, 'operationId 必须是 8–120 位的路径安全字符串')
  }
}
