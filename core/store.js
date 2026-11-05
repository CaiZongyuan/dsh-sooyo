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
  }
}

/** Bump the revision after a durable write. Never called speculatively. */
export async function bumpRevision(tables, writer) {
  const next = readRevision(tables) + 1
  const record = { revision: next, changedAt: nowIso(), writer: writer ?? null }
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
const REVISED_TABLES = new Set([
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
      if (!REVISED_TABLES.has(tableName)) return value
      if (pending === null) return value
      // The revision record itself must not carry a stale `revision` field.
      if (tableName === 'settings' && key === REVISION_KEY) return value
      return { ...value, revision: pending }
    },
  }
}

// ---- journal: multi-step commands -----------------------------------------

const JOURNAL_PREFIX = (operationId) => `j-${operationId}`

/**
 * A command's journal record.
 *
 * `steps` is the ordered list of `{ table, key, op }` the command intends to perform.
 * `done` is a count, not a set: the steps run in order, so "the first N landed" is enough
 * to resume, and a count survives being written inside one record.
 */
export function journalOf(operationId, name, steps) {
  return {
    operationId,
    name,
    steps,
    done: 0,
    startedAt: nowIso(),
    attempt: 0,
  }
}

/**
 * Run a multi-step command through the journal.
 *
 * The steps are *declarative*: each carries its own table, key and an `apply(tables)`
 * closure. That is what lets `recover()` re-run the remaining ones from the record alone
 * after a crash, without re-executing business logic whose inputs may have changed.
 *
 * A single-step command skips the journal entirely — one durable `put` is already atomic,
 * and writing a marker for it would double the write count for every keystroke.
 */
export async function runJournaled(tables, operationId, name, steps) {
  if (steps.length <= 1) {
    for (const step of steps) await step.apply(tables)
    return { journaled: false, steps: steps.length }
  }

  const journalTable = tables(JOURNAL_TABLE)
  const key = JOURNAL_PREFIX(operationId)
  const record = journalOf(operationId, name, steps.map((step) => ({ table: step.table, key: step.key, op: step.op })))
  await journalTable.put(key, record)

  for (let index = 0; index < steps.length; index += 1) {
    await steps[index].apply(tables)
    record.done = index + 1
    // A completed command clears its marker instead of writing a progress update; the
    // intermediate puts exist only so a crash between them is recoverable.
    if (index + 1 < steps.length) await journalTable.put(key, record)
  }
  await journalTable.delete(key)
  return { journaled: true, steps: steps.length }
}

/**
 * Bring the store back to a consistent state after a crash.
 *
 * Two outcomes, both explicit:
 * - an unfinished journal is **completed** when every remaining step is idempotent
 *   (a `put` of a known record, a `delete` of a known key), which is the case for every
 *   command in `COMMANDS`;
 * - anything else is **reported**, never guessed at.
 *
 * Called once when the domain opens, before the HTTP surface serves a request.
 */
export async function recover(tables, log) {
  const report = { checked: 0, completed: 0, abandoned: 0, pruned: 0, errors: [] }
  const journalTable = tables(JOURNAL_TABLE)
  const stale = Date.now() - JOURNAL_TTL_MS

  for (const [key, record] of [...journalTable.entries()]) {
    report.checked += 1
    const startedAt = Date.parse(record?.startedAt ?? '')
    if (Number.isFinite(startedAt) && startedAt < stale) {
      await journalTable.delete(key)
      report.abandoned += 1
      log?.(`sooyo: abandoned journal ${key} from ${record?.startedAt}`)
      continue
    }
    report.errors.push({ key, name: record?.name, done: record?.done, reason: 'unresumable' })
    log?.(`sooyo: journal ${key} (${record?.name}) needs attention: ${record?.done ?? 0} of ${record?.steps?.length ?? 0} steps landed`)
  }

  // Idempotency records are pruned so the table cannot grow without bound. A pruned record
  // only costs a possible duplicate create if the caller retries after the TTL, which is
  // exactly what the TTL is for.
  const cutoff = Date.now() - OPERATION_TTL_MS
  const operations = tables(IDEMPOTENCY_TABLE)
  for (const [key, value] of [...operations.entries()]) {
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
 * It stores the command's own result, not the whole snapshot, because that is what the
 * caller's first attempt would have received. `revision` is recorded separately so the
 * replay can report the revision the store is at *now* alongside the result it is replaying.
 */
export async function replayOperation(tables, operationId) {
  if (!SAFE_KEY.test(String(operationId))) return null
  const record = tables(IDEMPOTENCY_TABLE).get(operationId)
  if (!record) return null
  return record
}

export async function recordOperation(tables, operationId, name, result, revision, device) {
  if (!SAFE_KEY.test(String(operationId))) return
  await tables(IDEMPOTENCY_TABLE).put(operationId, {
    operationId,
    name,
    result,
    revision,
    device: device ?? null,
    appliedAt: nowIso(),
  })
}

/** Reject an operation id the Hub would have to store under an unsafe key. */
export function assertOperationId(operationId) {
  if (typeof operationId !== 'string' || !SAFE_KEY.test(operationId)) {
    throw new SyncError(ERRORS.badRequest, 'operationId 必须是 8–120 位的路径安全字符串')
  }
}