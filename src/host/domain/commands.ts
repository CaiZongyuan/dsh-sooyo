/**
 * The command funnel: one whitelist, one validator, one write path.
 */

import * as daily from './daily.ts'
import { BREAKPOINTS, TASK_LISTS, WIDGET_TYPES, layoutKey, withOperationIdScope } from './personal.ts'
import { createProposal, decideProposal, PROPOSAL_OPERATIONS } from '../agent/inbox.ts'
import {
  COMMAND_SET,
  ENTITY_TABLE,
  ERRORS,
  OPERATION_ID,
  SAFE_KEY,
  SyncError,
} from '../core/protocol.ts'
import {
  assertOperationId,
  bumpRevision,
  readRevision,
  recordOperation,
  replayOperation,
  revisionOf,
  runJournaled,
  stampRecord,
  type StorageTable,
  type TableAccessor,
} from '../core/store.ts'

const nowIso = (): string => new Date().toISOString()

export interface RecordedOperation {
  op: 'put' | 'delete'
  table: string
  key: string
  value?: any
  before?: any
}

export function recorder(tables: TableAccessor): { tables: TableAccessor; ops: Map<string, RecordedOperation> } {
  const ops = new Map<string, RecordedOperation>()
  const bufferKey = (table: string, key: string): string => `${table}\u0000${key}`

  const captureBefore = (name: string, key: string): any => {
    const existing = ops.get(bufferKey(name, key))
    if (existing && 'before' in existing) return existing.before
    return tables(name).get(key)
  }

  const facade = (name: string): StorageTable => ({
    get: (key: string) => {
      const buffered = ops.get(bufferKey(name, key))
      if (buffered) return buffered.op === 'delete' ? undefined : buffered.value
      return tables(name).get(key)
    },
    entries: () => {
      const merged = new Map<string, any>()
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
    async put(key: string, value: any) {
      const before = captureBefore(name, key)
      ops.set(bufferKey(name, key), { op: 'put', table: name, key, value, before })
    },
    async delete(key: string) {
      const before = captureBefore(name, key)
      ops.set(bufferKey(name, key), { op: 'delete', table: name, key, before })
    },
    async update(key: string, mutate: (current: any) => any) {
      const before = captureBefore(name, key)
      const current = facade(name).get(key)
      const next = mutate(current)
      ops.set(bufferKey(name, key), { op: 'put', table: name, key, value: next, before })
      return next
    },
  })
  return { tables: facade, ops }
}

const stepsOf = (ops: Map<string, RecordedOperation>) =>
  [...ops.values()].map((entry) => ({
    table: entry.table,
    key: entry.key,
    op: entry.op,
    value: entry.value,
    before: entry.before,
    apply: async (tables: TableAccessor) => {
      if (entry.op === 'delete') await tables(entry.table).delete(entry.key)
      else await tables(entry.table).put(entry.key, entry.value)
    },
  }))

// ---- validation ------------------------------------------------------------

function fail(message: string, details?: Record<string, unknown>): never {
  throw new SyncError(ERRORS.badRequest, message, details)
}

const str = (
  value: unknown,
  field: string,
  { max = 2000, required = false, trim = true }: { max?: number; required?: boolean; trim?: boolean } = {},
): string | undefined => {
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

const bool = (value: unknown, field: string): boolean | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') fail(`${field} 必须是布尔值`)
  return value
}

const num = (
  value: unknown,
  field: string,
  { min = -Infinity, max = Infinity, integer = false }: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} 必须是有限数字`)
  if (integer && !Number.isInteger(value)) fail(`${field} 必须是整数`)
  if (value < min || value > max) fail(`${field} 超出范围 ${min}–${max}`)
  return value
}

const id = (value: unknown, field: string, { required = true }: { required?: boolean } = {}): string | undefined => {
  const text = str(value, field, { max: 200, required })
  if (text === undefined) return undefined
  if (!SAFE_KEY.test(text)) fail(`${field} 必须是路径安全的 id（a-zA-Z0-9_-）`)
  return text
}

const oneOf = <T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined => {
  if (value === undefined || value === null) return undefined
  if (!allowed.includes(value as T)) fail(`${field} 只能是 ${allowed.join(' / ')}`)
  return value as T
}

const url = (value: unknown, field: string, { required = false }: { required?: boolean } = {}): string | undefined => {
  const text = str(value, field, { max: 2000, required })
  if (text === undefined) return undefined
  if (!/^https?:\/\//i.test(text)) fail(`${field} 必须是 http(s) 链接`)
  return text
}

const origin = (value: any): Record<string, string> | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object') fail('origin 必须是对象')
  const out: Record<string, string> = {}
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

function settingsObject(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) fail('settings 必须是对象')
  const keys = Object.keys(value)
  if (keys.length > 24) fail('settings 字段过多')
  const text = JSON.stringify(value)
  if (text.length > 8000) fail('settings 过大')
  return JSON.parse(text) as Record<string, unknown>
}

const VALIDATORS: Record<string, (body: any) => Record<string, any>> = {
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
    const type = str(body?.type, 'type', { max: 40, required: true })!
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
    if (cols !== undefined && !(BREAKPOINTS as readonly number[]).includes(cols)) fail(`不支持的列数：${cols}`)
    if (!Array.isArray(body?.order)) fail('order 必须是数组')
    if (body.order.length > 200) fail('order 超过 200 项')
    return {
      boardId: id(body?.boardId, 'boardId'),
      cols,
      order: body.order.map((entry: any, index: number) => ({
        id: id(entry?.id, `order[${index}].id`),
        size: str(entry?.size, `order[${index}].size`, { max: 16 }),
      })),
    }
  },

  'task.add': (body) => ({
    title: str(body?.title, 'title', { max: 300, required: true }),
    list: oneOf(body?.list, 'list', TASK_LISTS),
    due: body?.due === undefined || body?.due === null || body?.due === '' ? null : str(body.due, 'due', { max: 40 }),
    priority: body?.priority === undefined || body?.priority === null || body?.priority === ''
      ? null
      : oneOf(body.priority, 'priority', daily.TASK_PRIORITIES),
    note: body?.note === undefined || body?.note === null ? undefined : str(body.note, 'note', { max: 2000 }),
    subtasks: Array.isArray(body?.subtasks)
      ? body.subtasks.slice(0, 30).map((s: any, idx: number) => ({
          id: str(s?.id, `subtasks[${idx}].id`, { max: 80 }) ?? `sub-${idx + 1}`,
          title: str(s?.title, `subtasks[${idx}].title`, { max: 200, required: true }),
          done: Boolean(s?.done),
        }))
      : undefined,
    project: body?.project === undefined || body?.project === null ? undefined : str(body.project, 'project', { max: 60 }),
    origin: origin(body?.origin),
  }),
  'task.update': (body) => {
    const patch: Record<string, any> = {
      id: id(body?.id, 'id'),
      done: bool(body?.done, 'done'),
      list: oneOf(body?.list, 'list', TASK_LISTS),
      due: body?.due === undefined ? undefined : (body.due === null || body.due === '' ? null : str(body.due, 'due', { max: 40 })),
      priority: body?.priority === undefined
        ? undefined
        : (body.priority === null || body.priority === '' ? null : oneOf(body.priority, 'priority', daily.TASK_PRIORITIES)),
      note: body?.note === undefined ? undefined : (body.note === null || body.note === '' ? '' : str(body.note, 'note', { max: 2000 })),
      subtasks: body?.subtasks === undefined
        ? undefined
        : (Array.isArray(body.subtasks)
            ? body.subtasks.slice(0, 30).map((s: any, idx: number) => ({
                id: str(s?.id, `subtasks[${idx}].id`, { max: 80 }) ?? `sub-${idx + 1}`,
                title: str(s?.title, `subtasks[${idx}].title`, { max: 200, required: true }),
                done: Boolean(s?.done),
              }))
            : fail('subtasks 必须是数组')),
      title: body?.title === undefined ? undefined : str(body.title, 'title', { max: 300 }),
      project: body?.project === undefined ? undefined : (body.project === null || body.project === '' ? '' : str(body.project, 'project', { max: 60 })),
    }
    if (
      patch.done === undefined &&
      patch.list === undefined &&
      patch.due === undefined &&
      patch.priority === undefined &&
      patch.note === undefined &&
      patch.subtasks === undefined &&
      patch.title === undefined &&
      patch.project === undefined
    ) {
      fail('没有要改的字段')
    }
    return patch
  },
  'task.remove': (body) => ({ id: id(body?.id, 'id') }),

  'capture': (body) => ({
    text: str(body?.text, 'text', { max: 2000, required: true }),
    mode: oneOf(body?.mode, 'mode', ['task', 'note', 'collection'] as const),
    kind: oneOf(body?.kind, 'kind', daily.COLLECTION_KINDS),
    title: str(body?.title, 'title', { max: 300 }),
    summary: str(body?.summary, 'summary', { max: 1000 }),
    thumbnail: url(body?.thumbnail, 'thumbnail'),
    externalUrl: url(body?.externalUrl, 'externalUrl'),
    due: body?.due === undefined || body?.due === null || body?.due === '' ? undefined : str(body.due, 'due', { max: 40 }),
    priority: body?.priority === undefined || body?.priority === null || body?.priority === ''
      ? undefined
      : oneOf(body.priority, 'priority', daily.TASK_PRIORITIES),
    project: body?.project === undefined || body?.project === null ? undefined : str(body.project, 'project', { max: 60 }),
    tags: Array.isArray(body?.tags)
      ? body.tags.slice(0, 12).map((t: unknown, i: number) => str(t, `tags[${i}]`, { max: 40 })).filter(Boolean)
      : undefined,
  }),
  'note.add': (body) => ({
    title: str(body?.title, 'title', { max: 160 }),
    text: str(body?.text, 'text', { max: 2000, required: true }),
    tags: Array.isArray(body?.tags)
      ? body.tags.slice(0, 12).map((t: unknown, i: number) => str(t, `tags[${i}]`, { max: 40 })).filter(Boolean)
      : undefined,
    status: oneOf(body?.status, 'status', daily.CONTENT_STATUSES),
    pinned: bool(body?.pinned, 'pinned'),
    externalUrl: body?.externalUrl === undefined || body?.externalUrl === null || body?.externalUrl === ''
      ? null
      : url(body.externalUrl, 'externalUrl'),
    origin: origin(body?.origin),
  }),
  'note.update': (body) => {
    const patch: Record<string, any> = {
      id: id(body?.id, 'id'),
      title: body?.title === undefined ? undefined : (body.title === null || body.title === '' ? '' : str(body.title, 'title', { max: 160 })),
      text: body?.text === undefined ? undefined : str(body.text, 'text', { max: 2000 }),
      tags: body?.tags === undefined
        ? undefined
        : (Array.isArray(body.tags)
            ? body.tags.slice(0, 12).map((t: unknown, i: number) => str(t, `tags[${i}]`, { max: 40 })).filter(Boolean)
            : fail('tags 必须是数组')),
      status: oneOf(body?.status, 'status', daily.CONTENT_STATUSES),
      pinned: bool(body?.pinned, 'pinned'),
      externalUrl: body?.externalUrl === undefined
        ? undefined
        : (body.externalUrl === null || body.externalUrl === '' ? '' : url(body.externalUrl, 'externalUrl')),
    }
    if (
      patch.title === undefined &&
      patch.text === undefined &&
      patch.tags === undefined &&
      patch.status === undefined &&
      patch.pinned === undefined &&
      patch.externalUrl === undefined
    ) {
      fail('没有要改的字段')
    }
    return patch
  },
  'note.remove': (body) => ({ id: id(body?.id, 'id') }),

  'readlater.set': (body) => {
    const out: Record<string, any> = {
      itemId: id(body?.itemId, 'itemId'),
      on: bool(body?.on, 'on'),
    }
    if (body?.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot)) {
      out.snapshot = daily.extractItemSnapshot({ ...body.snapshot, id: out.itemId })
    }
    return out
  },

  'collection.save': (body) => {
    const normOne = (entry: any, prefix = '') => {
      if (!entry || typeof entry !== 'object') fail(`${prefix || 'entry'} 必须是对象`)
      const rawId = entry.id ?? entry.itemId
      return {
        id: rawId === undefined || rawId === null || rawId === '' ? undefined : id(rawId, `${prefix}id`, { required: false }),
        title: str(entry.title, `${prefix}title`, { max: 300, required: true }),
        url: entry.url ? url(entry.url, `${prefix}url`) : '',
        kind: oneOf(entry.kind, `${prefix}kind`, daily.COLLECTION_KINDS),
        status: oneOf(entry.status, `${prefix}status`, daily.CONTENT_STATUSES),
        thumbnail: entry.thumbnail ? url(entry.thumbnail, `${prefix}thumbnail`) : null,
        summary: str(entry.summary ?? entry.description, `${prefix}summary`, { max: 1000 }) ?? '',
        sourceLabel: str(entry.sourceLabel ?? entry.origin, `${prefix}sourceLabel`, { max: 100 }),
        externalUrl: entry.externalUrl ? url(entry.externalUrl, `${prefix}externalUrl`) : null,
        tags: Array.isArray(entry.tags)
          ? entry.tags.slice(0, 12).map((t: unknown, i: number) => str(t, `${prefix}tags[${i}]`, { max: 40 })).filter(Boolean)
          : [],
        meta: entry.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta)
          ? settingsObject(entry.meta)
          : null,
      }
    }
    if (Array.isArray(body?.items)) {
      if (body.items.length === 0) fail('items 不能为空')
      if (body.items.length > 50) fail('单次最多保存 50 条收藏')
      return { items: body.items.map((entry: any, i: number) => normOne(entry, `items[${i}].`)) }
    }
    return normOne(body)
  },
  'collection.remove': (body) => ({
    id: id(body?.id ?? body?.itemId, 'id'),
  }),

  'retro.save': (body) => ({
    key: id(body?.key, 'key'),
    period: oneOf(body?.period, 'period', ['day', 'week', 'month'] as const) ?? 'week',
    highlights: str(body?.highlights ?? '', 'highlights', { max: 2000 }) ?? '',
    blockers: str(body?.blockers ?? '', 'blockers', { max: 2000 }) ?? '',
    nextFocus: str(body?.nextFocus ?? '', 'nextFocus', { max: 2000 }) ?? '',
  }),

  'interests.set': (body) => {
    if (Array.isArray(body?.interests)) {
      if (body.interests.length > 40) fail('关注词超过 40 个')
      return { interests: body.interests.map((entry: unknown, index: number) => str(entry, `interests[${index}]`, { max: 60 })).filter(Boolean) }
    }
    return { text: str(body?.text, 'text', { max: 2000 }) }
  },
  'bookmarks.set': (body) => {
    if (!Array.isArray(body?.bookmarks)) fail('bookmarks 必须是数组')
    if (body.bookmarks.length > 24) fail('书签超过 24 个')
    return {
      bookmarks: body.bookmarks.map((entry: any, index: number) => ({
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
    action: oneOf(body?.action, 'action', ['start', 'pause', 'reset', 'task', 'complete'] as const),
    left: num(body?.left, 'left', { min: 0, max: 24 * 3600 }),
    task: body?.task === undefined ? undefined : (body.task === null || body.task === '' ? '' : id(body.task, 'task')),
  }),

  'item.state': (body) => {
    if (!Array.isArray(body?.ids)) fail('ids 必须是数组')
    if (body.ids.length === 0) fail('ids 不能为空')
    if (body.ids.length > 500) fail('ids 超过 500 项')
    const patch: Record<string, boolean> = {}
    for (const key of ['seen', 'starred', 'hidden']) {
      const value = bool(body?.[key], key)
      if (value !== undefined) patch[key] = value
    }
    if (Object.keys(patch).length === 0) fail('no state field supplied')
    return { ids: body.ids.map((entry: unknown, index: number) => id(entry, `ids[${index}]`)), ...patch }
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
    decision: oneOf(body?.decision, 'decision', ['approve', 'reject'] as const),
  }),
  'proposal.create': (body) => {
    if (typeof body?.reason !== 'string' || body.reason.trim() === '') fail('proposal 需要一个理由')
    if (!Array.isArray(body?.operations) || body.operations.length === 0) fail('proposal 至少需要一个操作')
    if (body.operations.length > 10) fail('proposal 最多 10 个操作')
    const operations = body.operations.map((operation: any, index: number) => {
      const name = str(operation?.name, `operations[${index}].name`, { max: 40, required: true })!
      if (!PROPOSAL_OPERATIONS.has(name)) fail(`proposal 里不允许 ${name}`)
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

export function validate(name: string, body: unknown): Record<string, any> {
  if (typeof name !== 'string' || !COMMAND_SET.has(name)) {
    throw new SyncError(ERRORS.unsupported, `不支持的命令：${String(name)}`)
  }
  const validator = VALIDATORS[name]
  if (!validator) throw new SyncError(ERRORS.unsupported, `命令 ${name} 还没有校验器`)
  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    fail('body 必须是对象')
  }
  return validator((body as Record<string, unknown>) ?? {})
}

// ---- local implementations that are not in daily.js ------------------------

async function applyItemState(tables: TableAccessor, body: any) {
  const read = tables('read')
  const ids: string[] = body.ids ?? []
  if (ids.length === 0) return { ok: false, error: 'ids is required' }
  for (const itemId of ids) {
    const current = read.get(itemId) ?? { seen: false, starred: false, hidden: false }
    const nextStarred = 'starred' in body ? body.starred : current.starred
    const item = nextStarred ? tables('items')?.get?.(itemId) : null
    const snapshot = nextStarred ? daily.extractItemSnapshot(item, current.snapshot) : undefined
    await read.put(itemId, {
      ...current,
      ...('seen' in body ? { seen: body.seen } : {}),
      ...('starred' in body ? { starred: body.starred } : {}),
      ...('hidden' in body ? { hidden: body.hidden } : {}),
      ...(snapshot ? { snapshot } : {}),
      openedAt: body.seen === true ? nowIso() : current.openedAt ?? null,
    })
  }
  return { ok: true, changed: ids.length }
}

async function createProposalWithPreview(tables: TableAccessor, body: any) {
  const sim = recorder(tables)
  const diff: any[] = []
  const basePreconditions: any[] = []
  const seenPreconditions = new Set<string>()

  for (const operation of body?.operations ?? []) {
    if (!PROPOSAL_OPERATIONS.has(String(operation?.name ?? ''))) continue
    try {
      const norm = validate(operation.name, operation.body ?? {})
      await runCommand(sim.tables, operation.name, norm)
    } catch {
      // keep creating the proposal
    }
  }

  for (const entry of sim.ops.values()) {
    diff.push({
      table: entry.table,
      key: entry.key,
      op: entry.op,
      before: entry.before ?? null,
      after: entry.op === 'delete' ? null : (entry.value ?? null),
    })
    if (entry.before && typeof entry.before === 'object' && Number.isSafeInteger(entry.before.revision)) {
      const pKey = `${entry.table}:${entry.key}`
      if (!seenPreconditions.has(pKey)) {
        seenPreconditions.add(pKey)
        basePreconditions.push({
          table: entry.table,
          key: entry.key,
          expectedRevision: entry.before.revision,
        })
      }
    }
  }

  return createProposal(tables, {
    ...body,
    preview: { diff },
    basePreconditions,
  })
}

const IMPLEMENTATIONS: Record<string, (tables: TableAccessor, body: any) => Promise<any>> = {
  'item.state': applyItemState,
  'proposal.create': createProposalWithPreview,
  'proposal.decide': (tables, body) => decideProposal(tables, body),
}

export async function runCommand(tables: TableAccessor, name: string, body: any): Promise<any> {
  if (!COMMAND_SET.has(name)) throw new SyncError(ERRORS.unsupported, `不支持的命令：${String(name)}`)
  const implementation = IMPLEMENTATIONS[name]
  if (implementation) return implementation(tables, body)
  const handler = daily.ACTIONS?.[name]
  if (!handler) throw new SyncError(ERRORS.unsupported, `命令 ${name} 没有实现`)
  return handler(tables, body)
}

export async function plan(tables: TableAccessor, name: string, body: any, operationId: string | null = null) {
  const dry = recorder(tables)
  const result = await withOperationIdScope(operationId, () => runCommand(dry.tables, name, body))
  return { result, steps: stepsOf(dry.ops), writes: dry.ops.size }
}

function reconcileResult(result: any, tables: TableAccessor | null, steps: any[], reservedRevision: number | null = null): any {
  if (!result || typeof result !== 'object') return result
  const stored = new Map<string, any>()
  for (const step of steps) {
    if (step.op !== 'put') continue
    const fromTable = tables ? tables(step.table).get(step.key) : undefined
    const candidate = fromTable ?? (reservedRevision !== null ? stampRecord(step.table, step.key, step.value, reservedRevision) : step.value)
    if (candidate && typeof candidate === 'object' && candidate.id !== undefined) {
      stored.set(String(candidate.id), candidate)
    }
  }
  if (stored.size === 0) return result

  const seen = new Set<any>()
  const walk = (value: any, depth: number): any => {
    if (depth > 4 || value === null || typeof value !== 'object') return value
    if (seen.has(value)) return value
    seen.add(value)
    if (Array.isArray(value)) return value.map((entry) => walk(entry, depth + 1))
    const replacement = value.id !== undefined ? stored.get(String(value.id)) : undefined
    if (replacement) return replacement
    const next: Record<string, any> = {}
    for (const [key, entry] of Object.entries(value)) next[key] = walk(entry, depth + 1)
    return next
  }
  return walk(result, 0)
}

export async function execute(
  tables: TableAccessor,
  {
    operationId,
    name,
    body,
    actor,
    precondition,
    onKillPoint,
  }: {
    operationId: string
    name: string
    body?: any
    actor?: any
    precondition?: any
    onKillPoint?: ((point: string, info?: any) => Promise<void> | void) | null
  },
) {
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
      dataRevision: replay.revision ?? replay.reservedRevision ?? readRevision(tables),
      result: replay.result,
      appliedAt: replay.appliedAt,
    }
  }

  const normalised = validate(name, body)
  const preconditionRevision = checkPrecondition(tables, precondition)

  const planned = await plan(tables, name, normalised, operationId)
  if (planned.result && planned.result.ok === false) {
    return {
      ok: false,
      operationId,
      error: planned.result.error,
      dataRevision: readRevision(tables),
      result: planned.result,
    }
  }

  const writer: string | null = actor?.device ?? actor?.sessionId ?? null
  const reservedRevision = readRevision(tables) + 1
  const plannedResult = reconcileResult(planned.result, null, planned.steps, reservedRevision)

  const journal = await runJournaled(tables, operationId, name, planned.steps, {
    reservedRevision,
    writer,
    plannedResult,
    onKillPoint,
  })
  const revision = await bumpRevision(tables, writer, reservedRevision)
  if (typeof onKillPoint === 'function') {
    await onKillPoint('after-bump-before-commit', { operationId, reservedRevision: revision.revision })
  }
  const result = reconcileResult(planned.result, tables, planned.steps, revision.revision)
  await recordOperation(tables, operationId, name, result, revision.revision, writer, {
    reservedRevision: revision.revision,
    steps: journal.serialSteps,
  })

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

export function checkPrecondition(tables: TableAccessor, precondition: any): number | null {
  if (!precondition) return null
  const entity = String(precondition?.entity ?? precondition?.entityType ?? '')
  const table = ENTITY_TABLE[entity]
  if (!table) throw new SyncError(ERRORS.badRequest, `precondition.entity 只能是 ${Object.keys(ENTITY_TABLE).join(' / ')}`)
  const key = precondition?.id ?? precondition?.entityId
  if (typeof key !== 'string' || !SAFE_KEY.test(key)) {
    throw new SyncError(ERRORS.badRequest, 'precondition.id 必须是路径安全的 id')
  }
  const expected = precondition?.revision ?? precondition?.expectedRevision
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw new SyncError(ERRORS.badRequest, 'precondition.revision 必须是非负整数')
  }
  let current = tables(table).get(key)
  if (!current && entity === 'settings') {
    current = tables('settings').get('personal')
  }
  if (!current && entity === 'layout' && expected === 0) {
    return 0
  }
  if (!current) {
    throw new SyncError(ERRORS.conflict, '这条记录已经被删除，请刷新后重试', {
      entity,
      id: key,
      revision: 0,
      missing: true,
    })
  }
  const actual = revisionOf(current)
  if (actual !== expected) {
    throw new SyncError(ERRORS.conflict, '这条记录已经被其它设备改过，请刷新后重试', {
      entity,
      id: key,
      expected,
      revision: actual,
      current,
    })
  }
  return actual
}

export function newOperationId(device = 'local'): string {
  const stamp = Date.now().toString(36)
  const noise = Math.random().toString(36).slice(2, 10)
  return `${device}-${stamp}${noise}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)
}

export { OPERATION_ID, layoutKey }
