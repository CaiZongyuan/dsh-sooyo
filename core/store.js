/**
 * Revision bookkeeping and the single write path every mutation goes through.
 *
 * Three facts shape this file:
 *
 * 1. **The storage domain has no cross-table transaction.** `board.remove` deletes widgets,
 *    layouts and a board; a crash between two of those `await`s leaves a half-removed Board.
 *    So the writes run through a *journal*: a `pending` marker with the steps that already
 *    landed is written first, each step clears itself, and the marker is deleted last. On
 *    open, `recover()` replays or rolls back whatever is left, so a half-done command is
 *    either finished or reported — never silently half-applied (issue §4.3).
 *
 * 2. **A revision must move only when a write is durable.** The domain already resolves
 *    `put` after the backend acknowledged it, so the revision is bumped after the write
 *    returns. A snapshot taken between the two is stale-but-honest: it names the revision
 *    whose contents it actually reflects.
 *
 * 3. **Writes must be serialized per domain, not per request.** Two devices editing at once
 *    would otherwise interleave inside one command's multi-step body. Every command runs on
 *    one promise chain, and snapshots read after that chain has drained for the revision
 *    they claim — a read/write barrier, not a lock on the whole store.
 */

import { SyncError, ERRORS, SAFE_KEY } from './protocol.js'

/** The global record that carries the monotonic revision, in the `settings` table. */
export const REVISION_KEY = 'sync'

/**
 * The physical table names.
 *
 * The storage backend accepts only `^[a-z][a-z0-9_]*$` for a table name — camelCase is
 * rejected at open with `invalid table name`, and the symptom is a store that silently never
 * becomes ready. So code names a table with this map rather than a literal, and a name that
 * looks like an identifier in JavaScript is not assumed to be a valid table.
 */
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
  /** One record per in-flight multi-step command, keyed by its operation id. */
  journal: 'journal',
  /** One record per applied operation id, so a retry is answered instead of reapplied. */
  operations: 'operations',
  /** The background review's per-item revision cursor. */
  agentReviews: 'agent_reviews',
  /** Proposals awaiting a human decision. */
  agentInbox: 'agent_inbox',
}

/** One record per in-flight multi-step command, keyed by its operation id. */
export const JOURNAL_TABLE = TABLES.journal
/** One record per applied operation id, so a retry is answered instead of reapplied. */
export const IDEMPOTENCY_TABLE = TABLES.operations

/** How long an applied operation id is remembered. A retry a day later is a new write. */
const OPERATION_TTL_MS = 7 * 24 * 3600 * 1000
/** A journal record older than this is assumed abandoned; recovery still verifies the data. */
const JOURNAL_TTL_MS = 24 * 3600 * 1000

const nowIso = () => new Date().toISOString()

/**
 * One mutation queue per open domain.
 *
 * `run` is the only way a caller mutates: it joins the chain, and the chain never rejects
 * for the next caller (a failed command resolves its own promise with the error rather than
 * poisoning the queue).
 */
export function createWriteQueue() {
  let tail = Promise.resolve()
  let depth = 0

  function run(operation) {
    depth += 1
    const result = tail.then(operation).finally(() => {
      depth -= 1
    })
    // The chain must not carry a rejection forward, or every later write fails with the
    // first one's error. The caller still sees its own rejection through `result`.
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    run,
    /** True while a command is queued or running: a snapshot read waits for it to drain. */
    get busy() {
      return depth > 0
    },
    /** Resolve once every queued command has settled, successfully or not. */
    drain: () => tail,
  }
}

/**
 * Read the current revision without creating one.
 *
 * A fresh install has no revision record, and that is revision 0 — not an error. Reading it
 * must not write, because a GET that mutates would bump `domain/changed` on every poll.
 */
export function readRevision(tables) {
  const record = tables('settings').get(REVISION_KEY)
  const value = Number(record?.revision)
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

/**
 * Everything a snapshot and an ETag are computed from.
 *
 * `generatedAt` is deliberately absent: it changes on every read, and including it in the
 * ETag would defeat every conditional request. The revision plus the content hash of the
 * payload identify a snapshot exactly.
 */
export function revisionState(tables) {
  const record = tables('settings').get(REVISION_KEY)
  return {
    revision: readRevision(tables),
    changedAt: record?.changedAt ?? null,
    writer: record?.writer ?? null,
    itemsRevision: Number.isSafeInteger(record?.itemsRevision) ? record.itemsRevision : 0,
    itemsUpdatedAt: record?.itemsUpdatedAt ?? null,
  }
}

/** Bump the revision after a durable write. Never called speculatively. */
export async function bumpRevision(tables, writer, targetRevision = null) {
  const existing = tables('settings').get(REVISION_KEY) ?? {}
  const current = readRevision(tables)
  const next = Number.isSafeInteger(targetRevision) && targetRevision > current ? targetRevision : current + 1
  const record = {
    ...existing,
    revision: next,
    changedAt: nowIso(),
    writer: writer ?? null,
  }
  await tables('settings').put(REVISION_KEY, record)
  return record
}

/**
 * Record that `items` or `sources` changed (feed ingest or thumbnail resolution) without
 * advancing `dataRevision`, so Clients invalidate conditional snapshot/item caches cleanly.
 */
export async function touchItemsUpdated(tables) {
  const existing = tables('settings').get(REVISION_KEY) ?? {}
  const currentRev = readRevision(tables)
  const itemsRevision = (Number.isSafeInteger(existing.itemsRevision) ? existing.itemsRevision : 0) + 1
  const record = {
    ...existing,
    revision: currentRev,
    itemsRevision,
    itemsUpdatedAt: nowIso(),
  }
  await tables('settings').put(REVISION_KEY, record)
  return record
}

/** The revision an entity carries. Absent means "never revised since this feature landed". */
export const revisionOf = (record) => (Number.isSafeInteger(record?.revision) ? record.revision : 0)

/**
 * A table facade that stamps `revision` on every written record and refuses unsafe keys.
 *
 * `daily.js` and `personal.js` take this same accessor, so their business logic did not have
 * to learn about revisions: they call `put` exactly as before, and the stamping happens here.
 */
export function createStampTable(getTable, stamp) {
  return (name) => {
    const table = getTable(name)
    return {
      get: (key) => table.get(key),
      entries: () => table.entries(),
      keys: () => table.keys(),
      get size() {
        return table.size
      },
      async put(key, value) {
        if (!SAFE_KEY.test(String(key))) throw new Error(`sooyo: "${key}" is not a path-safe key`)
        return table.put(key, stamp(name, key, value))
      },
      async delete(key) {
        if (!SAFE_KEY.test(String(key))) throw new Error(`sooyo: "${key}" is not a path-safe key`)
        return table.delete(key)
      },
      update: (key, mutate) => table.update(key, (current) => stamp(name, key, mutate(current))),
    }
  }
}

/**
 * Tables that hold entities the sync protocol revisions.
 *
 * `items` is excluded on purpose: feed ingestion rewrites an Item's `fetchedAt` on every
 * poll, and a revision bump per item per poll would invalidate every client's cache for
 * content that did not change. `read` and `readlater` are per-Item state and do get stamped.
 */
export const REVISED_TABLES = new Set([
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

/** Stamp a record with `revision` if its table is revision-tracked. */
export function stampRecord(tableName, key, value, revision) {
  if (!REVISED_TABLES.has(tableName)) return value
  if (!Number.isSafeInteger(revision) || revision <= 0) return value
  if (tableName === 'settings' && key === REVISION_KEY) return value
  if (!value || typeof value !== 'object') return value
  return { ...value, revision }
}

/**
 * Reservation of the revision a write will carry.
 *
 * `tables` is the **accessor** (a function of table name), the same one `daily.js` takes, so
 * the stamper reads the current revision through the identical path every other reader uses.
 */
export function makeStamper(tables) {
  let pending = null
  return {
    /** Reserve the revision the next write will carry. */
    open() {
      pending = readRevision(tables) + 1
    },
    /** Called by `commit` once the write landed, so a retry reuses the same number. */
    close() {
      pending = null
    },
    /** The revision currently reserved, or `null` between writes. */
    get revision() {
      return pending
    },
    stamp(tableName, key, value) {
      return stampRecord(tableName, key, value, pending)
    },
  }
}

// ---- two-phase Intent ledger (journal + operations) -------------------------

const JOURNAL_PREFIX = (operationId) => `j-${operationId}`

const serializeStep = (step, reservedRevision) => ({
  table: step.table,
  key: step.key,
  op: step.op,
  ...(step.op === 'delete'
    ? {}
    : { value: stampRecord(step.table, step.key, step.value, reservedRevision) }),
  ...(step.before === undefined ? {} : { before: step.before }),
})

/**
 * A command's Intent / journal record.
 *
 * `steps` is the ordered list of `{ table, key, op, value, before }` the command intends to
 * perform, with full values preserved so `recover()` can deterministically replay any
 * interrupted single-step or multi-step command to completion.
 */
export function journalOf(operationId, name, steps, options = {}) {
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

/**
 * Run a command through the two-phase Intent ledger (`pending -> committed`).
 *
 * Both single-step and multi-step commands write their `pending` Intent to `operations` and
 * `journal` before touching any entity table. If the process crashes at any point after the
 * pending Intent is written, startup `recover()` (or a retry hitting `replayOperation`)
 * deterministically replays the recorded steps with the same entity IDs and `reservedRevision`.
 */
export async function runJournaled(tables, operationId, name, steps, options = {}) {
  const reservedRevision = options.reservedRevision ?? (readRevision(tables) + 1)
  const onKillPoint = typeof options.onKillPoint === 'function' ? options.onKillPoint : null

  if (steps.length === 0) {
    return { journaled: false, steps: 0, reservedRevision }
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
    const step = record.steps[index]
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

/**
 * Replay an unfinished Intent record to completion and transition it to `committed`.
 */
async function completePendingIntent(tables, intent, journalKey, log) {
  const steps = Array.isArray(intent?.steps) ? intent.steps : []
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

  const reservedRevision =
    Number.isSafeInteger(intent.reservedRevision) && intent.reservedRevision > 0
      ? intent.reservedRevision
      : readRevision(tables) + 1

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]
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

/**
 * Bring the store back to a consistent state after a crash.
 *
 * Every unfinished Intent (in `journal` or `operations` with `status === 'pending'`) carries
 * its full ordered `steps` and `reservedRevision`, so `recover()` replays it idempotently to
 * completion and marks it `committed`. Unfinished Intents are never deleted by TTL; only
 * `committed` operation records older than `OPERATION_TTL_MS` (7 days) are pruned.
 *
 * Called once when the domain opens, before the HTTP surface serves a request.
 */
export async function recover(tables, log) {
  const report = { checked: 0, completed: 0, abandoned: 0, pruned: 0, errors: [] }
  const journalTable = tables(JOURNAL_TABLE)
  const operations = tables(IDEMPOTENCY_TABLE)
  const handledOps = new Set()

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

  // Only committed idempotency records older than 7 days are pruned; pending Intents are
  // never pruned by TTL.
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

/**
 * The idempotency log: what a repeated `operationId` is answered with.
 *
 * If an earlier attempt left a `pending` Intent that has not yet been finalized, `replayOperation`
 * completes it first so the caller always receives the committed result.
 */
export async function replayOperation(tables, operationId) {
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

export async function recordOperation(tables, operationId, name, result, revision, device, extra = {}) {
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

/** Reject an operation id the Hub would have to store under an unsafe key. */
export function assertOperationId(operationId) {
  if (typeof operationId !== 'string' || !SAFE_KEY.test(operationId)) {
    throw new SyncError(ERRORS.badRequest, 'operationId 必须是 8–120 位的路径安全字符串')
  }
}