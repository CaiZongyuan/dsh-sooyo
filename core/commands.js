/**
 * The command funnel: one whitelist, one validator, one write path.
 *
 * Every mutation — from the local UI's `POST /sooyo/action`, from a Client's
 * `POST /sooyo/sync/v1/command`, from an Agent tool — arrives here as `{ name, body }` and
 * leaves as a durable, revision-stamped write. Nothing else may call `daily.js`.
 *
 * Two mechanisms do the work:
 *
 * **A recording facade.** The business logic lives in `daily.js` and must not be duplicated;
 * but a journal needs the *concrete* steps before they run. So the command body is executed
 * once against `recorder()`, a tables facade that buffers `put`/`delete` and overlays them on
 * reads. What comes out is the exact ordered list of writes the real execution would perform,
 * with the ids `newId()` already minted. That list is journaled and then applied — so a crash
 * mid-command is recoverable and a retry cannot mint a second entity.
 *
 * **Strict validation.** The storage schema is lenient (`LENIENT_SCHEMA`) and must stay that
 * way for old records, but a lenient schema is not a remote security boundary: a caller on
 * the network gets an explicit per-command check here, and unknown fields never reach a write.
 */

import * as daily from '../daily.js'
import { BREAKPOINTS, TASK_LISTS, WIDGET_TYPES, layoutKey } from '../personal.js'
import { createProposal, decideProposal, PROPOSAL_OPERATIONS } from '../agent/inbox.js'
import {
  COMMAND_SET,
  ENTITY_TABLE,
  ERRORS,
  OPERATION_ID,
  SAFE_KEY,
  SyncError,
} from './protocol.js'
import {
  assertOperationId,
  bumpRevision,
  readRevision,
  recordOperation,
  replayOperation,
  revisionOf,
  runJournaled,
} from './store.js'

const nowIso = () => new Date().toISOString()

// ---- the recording facade --------------------------------------------------

/**
 * A tables accessor that performs no writes: it buffers them and overlays them on reads.
 *
 * The overlay matters because the commands interleave reads and writes, and a plan computed
 * from stale state would not match what the real execution does. A later `put` for the same
 * key replaces the earlier buffered one, and a `delete` shadows it, so the final list is
 * already compact — a command that writes one record three times journals one write.
 */
export function recorder(tables) {
  /** @type {Map<string, { op: 'put'|'delete', table: string, key: string, value?: unknown }>} */
  const ops = new Map()
  const bufferKey = (table, key) => `${table}\u0000${key}`

  const facade = (name) => ({
    get: (key) => {
      const buffered = ops.get(bufferKey(name, key))
      if (buffered) return buffered.op === 'delete' ? undefined : buffered.value
      return tables(name).get(key)
    },
    entries: () => {
      // A read-modify-write over entries() is how several commands work, so the iterator has
      // to yield the overlay rather than the raw table.
      const merged = new Map()
      for (const [key, value] of tables(name).entries()) merged.set(key, value)
      for (const [compound, entry] of ops) {
        if (entry.table !== name) continue
        const key = compound.slice(name.length + 1)
        if (entry.op === 'delete') merged.delete(key)
        else merged.set(key, entry.value)
      }
      return merged.entries()
    },
    keys: () => [...facade(name).entries()].map(([key]) => key),
    get size() {
      return [...facade(name).entries()].length
    },
    async put(key, value) {
      ops.set(bufferKey(name, key), { op: 'put', table: name, key, value })
    },
    async delete(key) {
      ops.set(bufferKey(name, key), { op: 'delete', table: name, key })
    },
    async update(key, mutate) {
      const current = facade(name).get(key)
      const next = mutate(current)
      ops.set(bufferKey(name, key), { op: 'put', table: name, key, value: next })
      return next
    },
  })
  return { tables: facade, ops }
}

/** Turn a recorded operation list into journal steps that `runJournaled` can replay. */
const stepsOf = (ops) =>
  [...ops.values()].map((entry) => ({
    table: entry.table,
    key: entry.key,
    op: entry.op,
    apply: async (tables) => {
      if (entry.op === 'delete') await tables(entry.table).delete(entry.key)
      else await tables(entry.table).put(entry.key, entry.value)
    },
  }))

// ---- validation ------------------------------------------------------------

const fail = (message, details) => {
  throw new SyncError(ERRORS.badRequest, message, details)
}

const str = (value, field, { max = 2000, required = false, trim = true } = {}) => {
  if (value === undefined || value === null) {
    if (required) fail(`缺少 ${field}`)
    return undefined
  }
  if (typeof value !== 'string') fail(`${field} 必须是字符串`)
  const text = trim ? value.trim() : value
  if (text.length === 0 && required) fail(`${field} 不能为空`)
  if (text.length > max) fail(`${field} 超过 ${max} 字`)
  return text
}

const bool = (value, field) => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') fail(`${field} 必须是布尔值`)
  return value
}

const num = (value, field, { min = -Infinity, max = Infinity, integer = false } = {}) => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} 必须是有限数字`)
  if (integer && !Number.isInteger(value)) fail(`${field} 必须是整数`)
  if (value < min || value > max) fail(`${field} 超出范围 ${min}–${max}`)
  return value
}

const id = (value, field, { required = true } = {}) => {
  const text = str(value, field, { max: 200, required })
  if (text === undefined) return undefined
  if (!SAFE_KEY.test(text)) fail(`${field} 必须是路径安全的 id（a-zA-Z0-9_-）`)
  return text
}

const oneOf = (value, field, allowed) => {
  if (value === undefined || value === null) return undefined
  if (!allowed.includes(value)) fail(`${field} 只能是 ${allowed.join(' / ')}`)
  return value
}

const url = (value, field, { required = false } = {}) => {
  const text = str(value, field, { max: 2000, required })
  if (text === undefined) return undefined
  if (!/^https?:\/\//i.test(text)) fail(`${field} 必须是 http(s) 链接`)
  return text
}

/** An Origin keeps the Source and the original link (GLOSSARY: Origin). */
const origin = (value) => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object') fail('origin 必须是对象')
  const out = {}
  const title = str(value.title, 'origin.title', { max: 300 })
  const sourceId = str(value.sourceId, 'origin.sourceId', { max: 100 })
  const link = url(value.url, 'origin.url')
  const itemId = str(value.itemId, 'origin.itemId', { max: 200 })
  if (title !== undefined) out.title = title
  if (sourceId !== undefined) out.sourceId = sourceId
  if (link !== undefined) out.url = link
  if (itemId !== undefined) {
    if (!SAFE_KEY.test(itemId)) fail('origin.itemId 必须是路径安全的 id')
    out.itemId = itemId
  }
  return out
}

/**
 * One validator per command, returning the *normalised* body.
 *
 * Only declared fields survive, which is the difference between this and `LENIENT_SCHEMA`:
 * a caller cannot smuggle an unexpected key into a stored record.
 */
const VALIDATORS = {
  'board.create': (body) => ({
    name: str(body?.name, 'name', { max: 40, required: true }),
    icon: str(body?.icon, 'icon', { max: 40 }),
  }),
  'board.rename': (body) => ({
    id: id(body?.id, 'id'),
    name: str(body?.name, 'name', { max: 40, required: true }),
  }),
  'board.remove': (body) => ({ id: id(body?.id, 'id') }),
  'board.active': (body) => ({ id: id(body?.id, 'id') }),

  'widget.add': (body) => {
    const type = str(body?.type, 'type', { max: 40, required: true })
    if (!WIDGET_TYPES[type]) fail(`没有这种 Widget：${type}`)
    return {
      type,
      size: str(body?.size, 'size', { max: 16 }),
      boardId: id(body?.boardId, 'boardId', { required: false }),
      title: str(body?.title, 'title', { max: 80 }),
      settings: settingsObject(body?.settings),
    }
  },
  'widget.update': (body) => ({
    id: id(body?.id, 'id'),
    title: body?.title === undefined ? undefined : str(body.title, 'title', { max: 80 }),
    settings: body?.settings === undefined ? undefined : settingsObject(body.settings),
  }),
  'widget.remove': (body) => ({ id: id(body?.id, 'id') }),
  'widget.duplicate': (body) => ({
    id: id(body?.id, 'id'),
    boardId: id(body?.boardId, 'boardId', { required: false }),
  }),
  'widget.resize': (body) => ({
    id: id(body?.id, 'id'),
    size: str(body?.size, 'size', { max: 16 }),
    cols: num(body?.cols, 'cols', { integer: true }),
    boardId: id(body?.boardId, 'boardId', { required: false }),
  }),
  'layout.set': (body) => {
    const cols = num(body?.cols, 'cols', { integer: true, min: 1, max: 12 })
    if (cols !== undefined && !BREAKPOINTS.includes(cols)) fail(`不支持的列数：${cols}`)
    if (!Array.isArray(body?.order)) fail('order 必须是数组')
    if (body.order.length > 200) fail('order 超过 200 项')
    return {
      boardId: id(body?.boardId, 'boardId'),
      cols,
      order: body.order.map((entry, index) => ({
        id: id(entry?.id, `order[${index}].id`),
        size: str(entry?.size, `order[${index}].size`, { max: 16 }),
      })),
    }
  },

  'task.add': (body) => ({
    title: str(body?.title, 'title', { max: 300, required: true }),
    list: oneOf(body?.list, 'list', TASK_LISTS),
    project: body?.project === undefined || body?.project === null ? undefined : str(body.project, 'project', { max: 60 }),
    origin: origin(body?.origin),
  }),
  'task.update': (body) => {
    const patch = {
      id: id(body?.id, 'id'),
      done: bool(body?.done, 'done'),
      list: oneOf(body?.list, 'list', TASK_LISTS),
      title: body?.title === undefined ? undefined : str(body.title, 'title', { max: 300 }),
      project: body?.project === undefined ? undefined : (body.project === null || body.project === '' ? '' : str(body.project, 'project', { max: 60 })),
    }
    if (patch.done === undefined && patch.list === undefined && patch.title === undefined && patch.project === undefined) {
      fail('没有要改的字段')
    }
    return patch
  },
  'task.remove': (body) => ({ id: id(body?.id, 'id') }),

  'capture': (body) => ({ text: str(body?.text, 'text', { max: 2000, required: true }) }),
  'note.add': (body) => ({
    text: str(body?.text, 'text', { max: 2000, required: true }),
    origin: origin(body?.origin),
  }),
  'note.remove': (body) => ({ id: id(body?.id, 'id') }),

  'readlater.set': (body) => ({
    itemId: id(body?.itemId, 'itemId'),
    on: bool(body?.on, 'on'),
  }),

  'interests.set': (body) => {
    if (Array.isArray(body?.interests)) {
      if (body.interests.length > 40) fail('关注词超过 40 个')
      return { interests: body.interests.map((entry, index) => str(entry, `interests[${index}]`, { max: 60 })).filter(Boolean) }
    }
    return { text: str(body?.text, 'text', { max: 2000 }) }
  },
  'bookmarks.set': (body) => {
    if (!Array.isArray(body?.bookmarks)) fail('bookmarks 必须是数组')
    if (body.bookmarks.length > 24) fail('书签超过 24 个')
    return {
      bookmarks: body.bookmarks.map((entry, index) => ({
        name: str(entry?.name, `bookmarks[${index}].name`, { max: 40, required: true }),
        url: url(entry?.url, `bookmarks[${index}].url`, { required: true }),
      })),
    }
  },
  'habit.tick': (body) => ({
    id: id(body?.id, 'id'),
    day: num(body?.day, 'day', { integer: true, min: 0, max: 6 }),
  }),
  'focus.set': (body) => ({
    action: oneOf(body?.action, 'action', ['start', 'pause', 'reset', 'task', 'complete']),
    left: num(body?.left, 'left', { min: 0, max: 24 * 3600 }),
    task: body?.task === undefined ? undefined : (body.task === null || body.task === '' ? '' : id(body.task, 'task')),
  }),

  'item.state': (body) => {
    if (!Array.isArray(body?.ids)) fail('ids 必须是数组')
    if (body.ids.length === 0) fail('ids 不能为空')
    if (body.ids.length > 500) fail('ids 超过 500 项')
    const patch = {}
    for (const key of ['seen', 'starred', 'hidden']) {
      const value = bool(body?.[key], key)
      if (value !== undefined) patch[key] = value
    }
    if (Object.keys(patch).length === 0) fail('no state field supplied')
    return { ids: body.ids.map((entry, index) => id(entry, `ids[${index}]`)), ...patch }
  },
  'item.toTask': (body) => ({
    title: str(body?.title, 'title', { max: 300, required: true }),
    list: oneOf(body?.list, 'list', TASK_LISTS),
    origin: origin(body?.origin),
  }),
  'item.toNote': (body) => ({
    text: str(body?.text ?? body?.title, 'text', { max: 800, required: true }),
    origin: origin(body?.origin),
  }),

  'proposal.decide': (body) => ({
    id: id(body?.id, 'id'),
    decision: oneOf(body?.decision, 'decision', ['approve', 'reject']),
  }),
  'proposal.create': (body) => {
    if (typeof body?.reason !== 'string' || body.reason.trim() === '') fail('proposal 需要一个理由')
    if (!Array.isArray(body?.operations) || body.operations.length === 0) fail('proposal 至少需要一个操作')
    if (body.operations.length > 10) fail('proposal 最多 10 个操作')
    const operations = body.operations.map((operation, index) => {
      const name = str(operation?.name, `operations[${index}].name`, { max: 40, required: true })
      if (!PROPOSAL_OPERATIONS.has(name)) fail(`proposal 里不允许 ${name}`)
      // The nested body is validated by the command it names when the proposal is applied,
      // not here: validating it twice would reject a body this validator would also rewrite.
      const nested = operation?.body
      if (nested !== undefined && nested !== null && (typeof nested !== 'object' || Array.isArray(nested))) {
        fail(`operations[${index}].body 必须是对象`)
      }
      return { name, body: nested ?? {} }
    })
    return {
      reason: str(body.reason, 'reason', { max: 500, required: true }),
      operations,
      evidenceRefs: Array.isArray(body?.evidenceRefs) ? body.evidenceRefs.map(String).slice(0, 10) : [],
      createdBySessionId: str(body?.createdBySessionId, 'createdBySessionId', { max: 120 }),
    }
  },
}

/** A Widget's settings are free-form by design, but must stay a plain, bounded object. */
function settingsObject(value) {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) fail('settings 必须是对象')
  const keys = Object.keys(value)
  if (keys.length > 24) fail('settings 字段过多')
  const text = JSON.stringify(value)
  if (text.length > 8000) fail('settings 过大')
  return JSON.parse(text)
}

/** Normalise and validate one command body. Unknown commands are refused before this. */
export function validate(name, body) {
  if (typeof name !== 'string' || !COMMAND_SET.has(name)) {
    throw new SyncError(ERRORS.unsupported, `不支持的命令：${String(name)}`)
  }
  const validator = VALIDATORS[name]
  if (!validator) throw new SyncError(ERRORS.unsupported, `命令 ${name} 还没有校验器`)
  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    fail('body 必须是对象')
  }
  return validator(body ?? {})
}

// ---- local implementations that are not in daily.js ------------------------

/**
 * Marking Items seen/starred/hidden.
 *
 * It lives here rather than in `daily.js` because it is Item state, not personal data, and
 * it is the one action whose body is a list — the recording facade turns it into one journal
 * step per Item without any extra bookkeeping.
 */
async function applyItemState(tables, body) {
  const read = tables('read')
  const ids = body.ids ?? []
  if (ids.length === 0) return { ok: false, error: 'ids is required' }
  for (const itemId of ids) {
    const current = read.get(itemId) ?? { seen: false, starred: false, hidden: false }
    await read.put(itemId, {
      ...current,
      ...('seen' in body ? { seen: body.seen } : {}),
      ...('starred' in body ? { starred: body.starred } : {}),
      ...('hidden' in body ? { hidden: body.hidden } : {}),
      openedAt: body.seen === true ? nowIso() : current.openedAt ?? null,
    })
  }
  return { ok: true, changed: ids.length }
}

/** `daily.js` keeps the business semantics; these are the funnels's own commands. */
const IMPLEMENTATIONS = {
  'item.state': applyItemState,
  'proposal.create': (tables, body) => createProposal(tables, body),
  'proposal.decide': (tables, body) => decideProposal(tables, body),
}

/**
 * Run one command against a tables accessor and return its result.
 *
 * This is the single place a command body becomes writes. `plan()` calls it with a recorder,
 * the executor calls it with the real tables, and the offline self-test calls it directly.
 */
export async function runCommand(tables, name, body) {
  if (!COMMAND_SET.has(name)) throw new SyncError(ERRORS.unsupported, `不支持的命令：${String(name)}`)
  const implementation = IMPLEMENTATIONS[name]
  if (implementation) return implementation(tables, body)
  const handler = daily.ACTIONS?.[name]
  if (!handler) throw new SyncError(ERRORS.unsupported, `命令 ${name} 没有实现`)
  return handler(tables, body)
}

/**
 * Compute the exact writes a command would perform, without performing them.
 *
 * The returned `result` is the command's own return value as computed against the overlay,
 * which is what the caller will receive. It is safe to discard the plan: nothing was written.
 */
export async function plan(tables, name, body) {
  const dry = recorder(tables)
  const result = await runCommand(dry.tables, name, body)
  return { result, steps: stepsOf(dry.ops), writes: dry.ops.size }
}

/**
 * Apply a validated command: journal it, write it, bump the revision, remember the operation.
 *
 * Order matters and is the whole safety argument:
 * 1. The idempotency log is consulted first, so a retry returns the first attempt's result
 *    and never re-runs a create.
 * 2. The plan is computed before the journal is written, so the journal can name every step.
 * 3. The journal is written, the steps run, the journal is cleared.
 * 4. Only after the last write is durable does the revision move, and only then is the
 *    operation recorded — a crash before step 4 leaves a revision that honestly describes
 *    what a reader can see, and the retry re-applies an already-applied command harmlessly.
 */
/**
 * Put the *stored* records into a command's result.
 *
 * A business function builds its result before the write happens, so the record it returns has
 * no `revision` — or, worse, the revision it had when it was read. A caller that then uses that
 * revision as a `precondition` would be told its own write was stale. The end-to-end check found
 * exactly that: `task.add` returned a task without `revision`, so the follow-up `task.update`
 * could never carry a valid precondition.
 *
 * The steps' keys are already known, so the fix is to read them back and swap them in. Walking
 * the result rather than naming its fields keeps this correct for every command: `{ task }`,
 * `{ board }`, `{ widget }`, and the nested shapes some of them return.
 */
function reconcileResult(result, tables, steps) {
  if (!result || typeof result !== 'object') return result
  const stored = new Map()
  for (const step of steps) {
    if (step.op !== 'put') continue
    const record = tables(step.table).get(step.key)
    if (record && typeof record === 'object' && record.id !== undefined) stored.set(String(record.id), record)
  }
  if (stored.size === 0) return result

  const seen = new Set()
  const walk = (value, depth) => {
    if (depth > 4 || value === null || typeof value !== 'object') return value
    if (seen.has(value)) return value
    seen.add(value)
    if (Array.isArray(value)) return value.map((entry) => walk(entry, depth + 1))
    const replacement = value.id !== undefined ? stored.get(String(value.id)) : undefined
    // The stored record is the truth: it has the stamped revision and nothing the UI must not
    // see. Replacing wholesale (rather than merging) means a deleted field cannot linger.
    if (replacement) return replacement
    const next = {}
    for (const [key, entry] of Object.entries(value)) next[key] = walk(entry, depth + 1)
    return next
  }
  return walk(result, 0)
}

export async function execute(tables, { operationId, name, body, actor, precondition }) {
  assertOperationId(operationId)
  if (typeof name !== 'string' || !COMMAND_SET.has(name)) {
    throw new SyncError(ERRORS.unsupported, `不支持的命令：${String(name)}`)
  }

  const replay = await replayOperation(tables, operationId)
  if (replay) {
    return {
      ok: true,
      operationId,
      replayed: true,
      dataRevision: readRevision(tables),
      result: replay.result,
      appliedAt: replay.appliedAt,
    }
  }

  const normalised = validate(name, body)

  // A precondition is checked here — inside the write queue's turn, before the plan is
  // computed — so a concurrent command from another device cannot slip between the check and
  // the write. A mismatch is a 409 that carries the current record, never an overwrite.
  const preconditionRevision = checkPrecondition(tables, precondition)

  const planned = await plan(tables, name, normalised)
  if (planned.result && planned.result.ok === false) {
    // A business refusal ("至少要留一个 Board") is not a protocol error: the caller gets the
    // message the UI shows, with a 200, exactly as the local route always did.
    return { ok: false, operationId, error: planned.result.error, dataRevision: readRevision(tables), result: planned.result }
  }

  const writer = actor?.device ?? actor?.sessionId ?? null
  const journal = await runJournaled(tables, operationId, name, planned.steps)
  const revision = await bumpRevision(tables, writer)
  // Read the written records back, so the caller's result names the revision it must use next.
  const result = reconcileResult(planned.result, tables, planned.steps)
  await recordOperation(tables, operationId, name, result, revision.revision, writer)

  return {
    ok: true,
    operationId,
    dataRevision: revision.revision,
    changedAt: revision.changedAt,
    journaled: journal.journaled,
    writes: planned.writes,
    ...(preconditionRevision === null ? {} : { preconditionRevision }),
    result,
  }
}

/**
 * A conflict check for a caller that read at revision N and is now writing.
 *
 * `precondition.entity` names the kind of record the caller edited; the Hub compares the
 * record's stored `revision` with the one the caller last saw. A mismatch is a 409 that
 * carries the current record, so the UI can show the two versions instead of overwriting.
 */
export function checkPrecondition(tables, precondition) {
  if (!precondition) return null
  const table = ENTITY_TABLE[precondition?.entity]
  if (!table) throw new SyncError(ERRORS.badRequest, `precondition.entity 只能是 ${Object.keys(ENTITY_TABLE).join(' / ')}`)
  const key = precondition?.id
  if (typeof key !== 'string' || !SAFE_KEY.test(key)) {
    throw new SyncError(ERRORS.badRequest, 'precondition.id 必须是路径安全的 id')
  }
  const expected = precondition?.revision
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw new SyncError(ERRORS.badRequest, 'precondition.revision 必须是非负整数')
  }
  const current = tables(table).get(key)
  // A record the caller deleted elsewhere is a conflict too: silently recreating it would
  // resurrect something the user removed.
  if (!current) {
    throw new SyncError(ERRORS.conflict, '这条记录已经被删除，请刷新后重试', {
      entity: precondition.entity,
      id: key,
      revision: 0,
      missing: true,
    })
  }
  const actual = revisionOf(current)
  if (actual !== expected) {
    throw new SyncError(ERRORS.conflict, '这条记录已经被其它设备改过，请刷新后重试', {
      entity: precondition.entity,
      id: key,
      expected,
      revision: actual,
      current,
    })
  }
  return actual
}

/** Mint an operation id for a caller that did not supply one (local UI, tool, schedule). */
export function newOperationId(device = 'local') {
  const stamp = Date.now().toString(36)
  const noise = Math.random().toString(36).slice(2, 10)
  return `${device}-${stamp}${noise}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)
}

export { OPERATION_ID, layoutKey }