/**
 * The personal-data half of the store: Boards, Widgets, layouts, Tasks, Notes, Read Later,
 * 关注词 and habits.
 */

import {
  BREAKPOINTS,
  BOOKMARKS_DEFAULT,
  defaultBoards,
  footprint,
  layoutKey,
  newId,
  normalizeSubscription,
  normalizeWidget,
  safeSize,
  TASK_LISTS,
  WIDGET_TYPES,
} from './personal.ts'
import type { TableAccessor } from '../core/store.ts'

const SETTINGS_KEY = 'personal'
export const SETTINGS_KEYS = {
  legacy: SETTINGS_KEY,
  active: 'active',
  interests: 'interests',
  bookmarks: 'bookmarks',
  habits: 'habits',
  focus: 'focus',
} as const

const nowIso = (): string => new Date().toISOString()

/** Habits are a fixed three-domain default; the user only ticks them. */
const DEFAULT_HABITS = [
  { id: 'h1', name: '阅读 30 分钟', streak: 0, week: [0, 0, 0, 0, 0, 0, 0] },
  { id: 'h2', name: '运动 30 分钟', streak: 0, week: [0, 0, 0, 0, 0, 0, 0] },
  { id: 'h3', name: '23:30 前睡觉', streak: 0, week: [0, 0, 0, 0, 0, 0, 0] },
]

export interface FocusTimerRecord {
  total: number
  left: number
  running: boolean
  task: string | null
  sessions: number
  startedAt: string | null
  deadline?: number | null
}

export const DEFAULT_FOCUS: FocusTimerRecord = {
  total: 25 * 60,
  left: 25 * 60,
  running: false,
  task: null,
  sessions: 0,
  startedAt: null,
}

const defaultSettings = () => ({
  active: 'home',
  interests: [] as string[],
  bookmarks: BOOKMARKS_DEFAULT.map(([name, url]) => ({ name, url })),
  habits: DEFAULT_HABITS.map((h) => ({ ...h, week: [...h.week] })),
  focus: { ...DEFAULT_FOCUS },
})

const revOf = (record: any): number => (Number.isSafeInteger(record?.revision) ? Number(record.revision) : 0)

export async function ensureSeeded(tables: TableAccessor): Promise<boolean> {
  const boards = tables('boards')
  if (boards.size > 0) return false

  const { boards: boardRows, widgets, layouts } = defaultBoards()
  for (const board of boardRows) await boards.put(board.id, board)
  for (const record of widgets) await tables('widgets').put(record.id, record)
  for (const layout of layouts) {
    await tables('layouts').put(layoutKey(layout.boardId, layout.cols), {
      boardId: layout.boardId,
      cols: layout.cols,
      order: layout.order,
    })
  }
  const defaults = defaultSettings()
  const settingsTable = tables('settings')
  await settingsTable.put(SETTINGS_KEYS.active, { id: SETTINGS_KEYS.active, active: defaults.active })
  await settingsTable.put(SETTINGS_KEYS.interests, { id: SETTINGS_KEYS.interests, interests: defaults.interests })
  await settingsTable.put(SETTINGS_KEYS.bookmarks, { id: SETTINGS_KEYS.bookmarks, bookmarks: defaults.bookmarks })
  await settingsTable.put(SETTINGS_KEYS.habits, { id: SETTINGS_KEYS.habits, habits: defaults.habits })
  await settingsTable.put(SETTINGS_KEYS.focus, { id: SETTINGS_KEYS.focus, focus: defaults.focus })
  return true
}

export function readSettings(tables: TableAccessor) {
  const defaults = defaultSettings()
  const settingsTable = tables('settings')
  const legacy = (settingsTable.get(SETTINGS_KEY) ?? {}) as Record<string, any>
  const activeRec = settingsTable.get(SETTINGS_KEYS.active) as Record<string, any> | undefined
  const interestsRec = settingsTable.get(SETTINGS_KEYS.interests) as Record<string, any> | undefined
  const bookmarksRec = settingsTable.get(SETTINGS_KEYS.bookmarks) as Record<string, any> | undefined
  const habitsRec = settingsTable.get(SETTINGS_KEYS.habits) as Record<string, any> | undefined
  const focusRec = settingsTable.get(SETTINGS_KEYS.focus) as Record<string, any> | undefined

  const active: string = activeRec?.active ?? legacy.active ?? defaults.active
  const interests: string[] = Array.isArray(interestsRec?.interests)
    ? interestsRec.interests
    : (Array.isArray(legacy.interests) ? legacy.interests : defaults.interests)
  const bookmarks: Array<{ name: string; url: string }> = Array.isArray(bookmarksRec?.bookmarks)
    ? bookmarksRec.bookmarks
    : (Array.isArray(legacy.bookmarks) ? legacy.bookmarks : defaults.bookmarks)
  const habits: Array<{ id: string; name: string; streak: number; week: number[] }> = Array.isArray(habitsRec?.habits)
    ? habitsRec.habits
    : (Array.isArray(legacy.habits) ? legacy.habits : defaults.habits)
  const focusRaw = (focusRec?.focus ?? legacy.focus ?? {}) as Partial<FocusTimerRecord>

  return {
    ...defaults,
    ...legacy,
    active,
    interests,
    bookmarks,
    habits,
    focus: { ...DEFAULT_FOCUS, ...focusRaw },
  }
}

export function readSettingsRevisions(tables: TableAccessor): Record<string, number> {
  const settingsTable = tables('settings')
  const legacy = settingsTable.get(SETTINGS_KEY)
  return {
    active: revOf(settingsTable.get(SETTINGS_KEYS.active) ?? legacy),
    interests: revOf(settingsTable.get(SETTINGS_KEYS.interests) ?? legacy),
    bookmarks: revOf(settingsTable.get(SETTINGS_KEYS.bookmarks) ?? legacy),
    habits: revOf(settingsTable.get(SETTINGS_KEYS.habits) ?? legacy),
    focus: revOf(settingsTable.get(SETTINGS_KEYS.focus) ?? legacy),
  }
}

async function writeSettings(tables: TableAccessor, patch: Record<string, unknown>): Promise<void> {
  const settingsTable = tables('settings')
  if ('active' in patch) {
    await settingsTable.put(SETTINGS_KEYS.active, { id: SETTINGS_KEYS.active, active: patch.active })
  }
  if ('interests' in patch) {
    await settingsTable.put(SETTINGS_KEYS.interests, { id: SETTINGS_KEYS.interests, interests: patch.interests })
  }
  if ('bookmarks' in patch) {
    await settingsTable.put(SETTINGS_KEYS.bookmarks, { id: SETTINGS_KEYS.bookmarks, bookmarks: patch.bookmarks })
  }
  if ('habits' in patch) {
    await settingsTable.put(SETTINGS_KEYS.habits, { id: SETTINGS_KEYS.habits, habits: patch.habits })
  }
  if ('focus' in patch) {
    await settingsTable.put(SETTINGS_KEYS.focus, { id: SETTINGS_KEYS.focus, focus: patch.focus })
  }
}

const listBoards = (tables: TableAccessor): Array<Record<string, any>> => {
  const rows: Array<Record<string, any>> = []
  for (const [, value] of tables('boards').entries()) if (value?.id) rows.push(value)
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)))
  return rows
}

const listWidgets = (tables: TableAccessor): Record<string, Record<string, any>> => {
  const map: Record<string, Record<string, any>> = {}
  for (const [key, value] of tables('widgets').entries()) if (value?.id) map[key] = value
  return map
}

function layoutOf(tables: TableAccessor, boardId: string, cols: number): Array<{ id: string; size: string }> {
  const stored = tables('layouts').get(layoutKey(boardId, cols))
  if (Array.isArray(stored?.order)) return stored.order
  const base = tables('layouts').get(layoutKey(boardId, 12))
  const order = Array.isArray(base?.order) ? base.order.map((entry: any) => ({ ...entry })) : []
  return order
}

const listTasks = (tables: TableAccessor): Array<Record<string, any>> => {
  const rows: Array<Record<string, any>> = []
  for (const [, value] of tables('tasks').entries()) if (value?.id) rows.push(value)
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)))
  return rows
}

const listNotes = (tables: TableAccessor): Array<Record<string, any>> => {
  const rows: Array<Record<string, any>> = []
  for (const [, value] of tables('notes').entries()) if (value?.id) rows.push(value)
  rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  return rows
}

const listReadLater = (tables: TableAccessor): string[] => {
  const rows: Array<Record<string, any>> = []
  for (const [, value] of tables('readlater').entries()) if (value?.itemId) rows.push(value)
  rows.sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))
  return rows.map((entry) => String(entry.itemId))
}

/** Build a self-contained Item metadata snapshot so saved/starred articles never dangle. */
export function extractItemSnapshot(item: any, fallback: any = null): Record<string, any> | null {
  const src = item ?? fallback
  if (!src || typeof src !== 'object') return null
  const id = src.id ?? src.itemId ?? null
  if (!id) return null
  return {
    id: String(id),
    title: String(src.title ?? '(无标题)').slice(0, 300),
    url: String(src.url ?? '').slice(0, 2000),
    sourceId: String(src.sourceId ?? 'saved').slice(0, 100),
    sourceLabel: String(src.sourceLabel ?? src.origin ?? '已保存').slice(0, 100),
    publishedAt: src.publishedAt ?? src.discoveredAt ?? null,
    thumbnail: src.thumbnail ?? null,
    summary: String(src.summary ?? '').slice(0, 1000),
    tldr: String(src.tldr ?? '').slice(0, 500),
    reason: String(src.reason ?? '').slice(0, 500),
    category: String(src.category ?? 'other').slice(0, 60),
    origin: String(src.origin ?? src.sourceLabel ?? '已保存').slice(0, 100),
    score: typeof src.score === 'number' ? src.score : null,
  }
}

const listReadLaterEntries = (tables: TableAccessor): Record<string, Record<string, any>> => {
  const map: Record<string, Record<string, any>> = {}
  for (const [, value] of tables('readlater').entries()) {
    if (!value?.itemId) continue
    const live = tables('items')?.get?.(value.itemId)
    const snap = extractItemSnapshot(live, value.snapshot)
    if (snap) map[value.itemId] = { ...snap, savedAt: value.savedAt ?? null }
  }
  return map
}

export function readDaily(tables: TableAccessor, sources: Array<Record<string, any>> = []) {
  const settings = readSettings(tables)
  const suggests = new Map<string, string | undefined>(
    sources.map((source) => [String(source.id), source.suggests?.pres]),
  )
  const widgets = listWidgets(tables)
  for (const record of Object.values(widgets)) {
    if (record.type === 'subscription') {
      const firstSource = Array.isArray(record.settings?.sources) ? record.settings.sources[0] : undefined
      record.settings = normalizeSubscription(record.settings ?? {}, firstSource ? suggests.get(String(firstSource)) : undefined)
    }
  }

  const boards = listBoards(tables)
  const active = boards.some((board) => board.id === settings.active) ? settings.active : boards[0]?.id ?? null
  const layouts: Record<string, Record<number, Array<{ id: string; size: string }>>> = {}
  const layoutRevisions: Record<string, number> = {}
  for (const board of boards) {
    layouts[board.id] = {}
    for (const cols of BREAKPOINTS) {
      const lKey = layoutKey(board.id, cols)
      layouts[board.id]![cols] = layoutOf(tables, board.id, cols)
      layoutRevisions[lKey] = revOf(tables('layouts').get(lKey))
    }
  }

  return {
    boards,
    active,
    widgets,
    layouts,
    layoutRevisions,
    settingsRevisions: readSettingsRevisions(tables),
    tasks: listTasks(tables),
    notes: listNotes(tables),
    readLater: listReadLater(tables),
    readLaterEntries: listReadLaterEntries(tables),
    interests: settings.interests,
    bookmarks: settings.bookmarks,
    habits: settings.habits,
    focus: settings.focus,
    sources: sources.map((source) => {
      const storedState = tables('sources')?.get?.(String(source.id)) ?? {}
      return {
        id: source.id,
        label: source.label,
        about: source.about ?? '',
        suggests: source.suggests ?? null,
        attribution: source.attribution ?? null,
        cadenceMinutes: source.cadenceMinutes ?? null,
        itemCount: storedState.itemCount ?? source.itemCount ?? 0,
        lastRunAt: storedState.lastRunAt ?? source.lastRunAt ?? null,
        lastResult: storedState.lastResult ?? source.lastResult ?? null,
        lastError: storedState.lastError ?? source.lastError ?? null,
        failStreak: storedState.failStreak ?? source.failStreak ?? 0,
        nextDueAt: storedState.nextDueAt ?? source.nextDueAt ?? null,
      }
    }),
    types: WIDGET_TYPES,
  }
}

// ---- Boards ----------------------------------------------------------------

export async function createBoard(tables: TableAccessor, body: any) {
  const name = String(body?.name ?? '').trim()
  if (!name) return { ok: false, error: '需要一个 Board 名称' }
  const boards = listBoards(tables)
  const id = newId('b')
  const existing = tables('boards').get(id)
  if (existing) return { ok: true, board: existing, active: id }
  const record = {
    id,
    name: name.slice(0, 40),
    icon: typeof body?.icon === 'string' ? body.icon : 'board',
    order: boards.length,
  }
  await tables('boards').put(id, record)
  for (const cols of BREAKPOINTS) {
    await tables('layouts').put(layoutKey(id, cols), { boardId: id, cols, order: [] })
  }
  await writeSettings(tables, { active: id })
  return { ok: true, board: record, active: id }
}

export async function renameBoard(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const existing = tables('boards').get(id)
  if (!existing) return { ok: false, error: '没有这个 Board' }
  const name = String(body?.name ?? '').trim()
  if (!name) return { ok: false, error: '需要一个 Board 名称' }
  const record = { ...existing, name: name.slice(0, 40) }
  await tables('boards').put(id, record)
  return { ok: true, board: record }
}

export async function removeBoard(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const boards = listBoards(tables)
  if (boards.length <= 1) return { ok: false, error: '至少要留一个 Board' }
  const existing = tables('boards').get(id)
  if (!existing) return { ok: false, error: '没有这个 Board' }
  const layoutRows = BREAKPOINTS.map((cols) => tables('layouts').get(layoutKey(id, cols))).filter(Boolean)
  const kept = new Set<string>()
  for (const board of boards) {
    if (board.id === id) continue
    for (const cols of BREAKPOINTS) {
      for (const entry of layoutOf(tables, board.id, cols)) kept.add(entry.id)
    }
  }
  const removedWidgets: string[] = []
  for (const record of layoutRows.flatMap((row: any) => row?.order ?? [])) {
    if (kept.has(record.id)) continue
    if (tables('widgets').get(record.id)) {
      await tables('widgets').delete(record.id)
      removedWidgets.push(record.id)
    }
  }
  for (const cols of BREAKPOINTS) {
    if (tables('layouts').get(layoutKey(id, cols))) await tables('layouts').delete(layoutKey(id, cols))
  }
  await tables('boards').delete(id)
  const settings = readSettings(tables)
  const active = settings.active === id ? (boards.find((board) => board.id !== id)?.id ?? null) : settings.active
  await writeSettings(tables, { active })
  return { ok: true, removedWidgets, active }
}

export async function setActiveBoard(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  if (!tables('boards').get(id)) return { ok: false, error: '没有这个 Board' }
  await writeSettings(tables, { active: id })
  return { ok: true, active: id }
}

// ---- Widgets and layouts ---------------------------------------------------

export async function addWidget(tables: TableAccessor, body: any) {
  const type = String(body?.type ?? '')
  if (!WIDGET_TYPES[type]) return { ok: false, error: `没有这种 Widget：${type}` }
  const boardId = String(body?.boardId ?? readSettings(tables).active)
  if (!tables('boards').get(boardId)) return { ok: false, error: '没有这个 Board' }

  const size = safeSize(type, body?.size)
  const id = newId('w')
  const existing = tables('widgets').get(id)
  if (existing) return { ok: true, widget: existing }
  const record = normalizeWidget({
    id,
    type,
    title: body?.title,
    settings: body?.settings ?? {},
  })
  await tables('widgets').put(id, record)

  for (const cols of BREAKPOINTS) {
    const key = layoutKey(boardId, cols)
    const current = tables('layouts').get(key) ?? { boardId, cols, order: layoutOf(tables, boardId, cols) }
    await tables('layouts').put(key, { boardId, cols, order: [...(current.order ?? []), { id, size }] })
  }
  return { ok: true, widget: record }
}

export async function updateWidget(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const existing = tables('widgets').get(id)
  if (!existing) return { ok: false, error: '没有这个 Widget' }
  const next = normalizeWidget({
    ...existing,
    title: body?.title === undefined ? existing.title : body.title,
    settings: body?.settings === undefined ? existing.settings : body.settings,
  })
  await tables('widgets').put(id, next)
  return { ok: true, widget: next }
}

export async function removeWidget(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  if (!tables('widgets').get(id)) return { ok: false, error: '没有这个 Widget' }
  for (const [, value] of tables('layouts').entries()) {
    if (!Array.isArray(value?.order) || !value.order.some((entry: any) => entry.id === id)) continue
    await tables('layouts').put(layoutKey(value.boardId, value.cols), {
      ...value,
      order: value.order.filter((entry: any) => entry.id !== id),
    })
  }
  await tables('widgets').delete(id)
  return { ok: true, removed: id }
}

export async function duplicateWidget(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const existing = tables('widgets').get(id)
  if (!existing) return { ok: false, error: '没有这个 Widget' }
  const boardId = String(body?.boardId ?? readSettings(tables).active)
  if (!tables('boards').get(boardId)) return { ok: false, error: '没有这个 Board' }

  const copyId = newId('w')
  const copy = { ...normalizeWidget({ ...existing, id: copyId }), id: copyId }
  await tables('widgets').put(copy.id, copy)
  for (const cols of BREAKPOINTS) {
    const key = layoutKey(boardId, cols)
    const current = tables('layouts').get(key) ?? { boardId, cols, order: layoutOf(tables, boardId, cols) }
    const order = [...(current.order ?? [])]
    const index = order.findIndex((entry: any) => entry.id === id)
    const at = index >= 0 ? index + 1 : order.length
    const size = index >= 0 && order[index] ? order[index].size : safeSize(String(copy.type), undefined)
    order.splice(at, 0, { id: copy.id, size })
    await tables('layouts').put(key, { boardId, cols, order })
  }
  return { ok: true, widget: copy }
}

export async function setLayout(tables: TableAccessor, body: any) {
  const boardId = String(body?.boardId ?? '')
  const cols = Number(body?.cols)
  if (!tables('boards').get(boardId)) return { ok: false, error: '没有这个 Board' }
  if (!(BREAKPOINTS as readonly number[]).includes(cols)) return { ok: false, error: `不支持的列数：${body?.cols}` }
  const widgets = listWidgets(tables)
  const seen = new Set<string>()
  const order: Array<{ id: string; size: string }> = []
  for (const entry of Array.isArray(body?.order) ? body.order : []) {
    const id = String(entry?.id ?? '')
    const w = widgets[id]
    if (!w || seen.has(id)) continue
    seen.add(id)
    order.push({ id, size: safeSize(String(w.type), entry?.size) })
  }
  await tables('layouts').put(layoutKey(boardId, cols), { boardId, cols, order })
  return { ok: true, order }
}

export async function resizeWidget(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const boardId = String(body?.boardId ?? readSettings(tables).active)
  const cols = Number(body?.cols ?? 12)
  const record = tables('widgets').get(id)
  if (!record) return { ok: false, error: '没有这个 Widget' }
  if (!(BREAKPOINTS as readonly number[]).includes(cols)) return { ok: false, error: `不支持的列数：${body?.cols}` }
  const size = safeSize(String(record.type), body?.size)
  const key = layoutKey(boardId, cols)
  const current = tables('layouts').get(key) ?? { boardId, cols, order: layoutOf(tables, boardId, cols) }
  const order = (current.order ?? []).map((entry: any) => (entry.id === id ? { ...entry, size } : entry))
  await tables('layouts').put(key, { boardId, cols, order })
  return { ok: true, id, size }
}

// ---- Tasks -----------------------------------------------------------------

async function nextTaskOrder(tables: TableAccessor, list: string): Promise<number> {
  const rows = listTasks(tables).filter((task) => task.list === list)
  return rows.reduce((max, task) => Math.max(max, task.order ?? 0), 0) + 1
}

export async function capture(tables: TableAccessor, body: any) {
  const text = String(body?.text ?? '').trim()
  if (!text) return { ok: false, error: '写点什么再回车' }
  const asNote = /^#note\s*/i.test(text)
  if (asNote) {
    const id = newId('n')
    const existing = tables('notes').get(id)
    if (existing) return { ok: true, kind: 'note', note: existing }
    const note = {
      id,
      text: text.replace(/^#note\s*/i, '').slice(0, 2000),
      createdAt: nowIso(),
    }
    await tables('notes').put(note.id, note)
    return { ok: true, kind: 'note', note }
  }
  return addTask(tables, { title: text, list: 'inbox' })
}

export async function addTask(tables: TableAccessor, body: any) {
  const title = String(body?.title ?? '').trim()
  if (!title) return { ok: false, error: '任务需要一个标题' }
  const list = (TASK_LISTS as readonly string[]).includes(String(body?.list ?? '')) ? String(body.list) : 'inbox'
  const id = newId('t')
  const existing = tables('tasks').get(id)
  if (existing) return { ok: true, task: existing }
  const task = {
    id,
    title: title.slice(0, 300),
    list,
    project: typeof body?.project === 'string' && body.project ? body.project : null,
    done: false,
    origin: body?.origin ?? null,
    createdAt: nowIso(),
    order: await nextTaskOrder(tables, list),
  }
  await tables('tasks').put(task.id, task)
  return { ok: true, task }
}

export async function updateTask(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const existing = tables('tasks').get(id)
  if (!existing) return { ok: false, error: '没有这个任务' }
  const patch: Record<string, any> = {}
  if (typeof body?.done === 'boolean') patch.done = body.done
  if ((TASK_LISTS as readonly string[]).includes(String(body?.list ?? ''))) patch.list = body.list
  if (body?.project !== undefined) patch.project = body.project || null
  if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 300)
  if (Object.keys(patch).length === 0) return { ok: false, error: '没有要改的字段' }
  if (patch.list && patch.list !== existing.list) patch.order = await nextTaskOrder(tables, patch.list)
  const next = { ...existing, ...patch }
  await tables('tasks').put(id, next)
  return { ok: true, task: next }
}

export async function removeTask(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  if (!tables('tasks').get(id)) return { ok: false, error: '没有这个任务' }
  await tables('tasks').delete(id)
  return { ok: true, removed: id }
}

// ---- Notes -----------------------------------------------------------------

export async function addNote(tables: TableAccessor, body: any) {
  const text = String(body?.text ?? '').trim()
  if (!text) return { ok: false, error: 'Note 需要一个标题' }
  const id = newId('n')
  const existing = tables('notes').get(id)
  if (existing) return { ok: true, note: existing }
  const note = { id, text: text.slice(0, 2000), origin: body?.origin ?? null, createdAt: nowIso() }
  await tables('notes').put(note.id, note)
  return { ok: true, note }
}

export async function removeNote(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  if (!tables('notes').get(id)) return { ok: false, error: '没有这条 Note' }
  await tables('notes').delete(id)
  return { ok: true, removed: id }
}

// ---- Read Later ------------------------------------------------------------

export async function setReadLater(tables: TableAccessor, body: any) {
  const itemId = String(body?.itemId ?? '')
  if (!itemId) return { ok: false, error: '缺少 itemId' }
  if (body?.on === false) {
    if (tables('readlater').get(itemId)) await tables('readlater').delete(itemId)
    return { ok: true, itemId, saved: false }
  }
  const existing = tables('readlater').get(itemId)
  const item = tables('items')?.get?.(itemId)
  const snapshot = extractItemSnapshot(item, body?.snapshot ?? existing?.snapshot)
  await tables('readlater').put(itemId, {
    itemId,
    savedAt: nowIso(),
    ...(snapshot ? { snapshot } : {}),
  })
  return { ok: true, itemId, saved: true, ...(snapshot ? { snapshot } : {}) }
}

// ---- 关注词 ----------------------------------------------------------------

export async function setInterests(tables: TableAccessor, body: any) {
  const raw = Array.isArray(body?.interests) ? body.interests : String(body?.text ?? '').split(/[,，、\s]+/)
  const interests = [...new Set(raw.map((entry: unknown) => String(entry).trim()).filter(Boolean))].slice(0, 40)
  await writeSettings(tables, { interests })
  return { ok: true, interests }
}

// ---- bookmarks -------------------------------------------------------------

export async function setBookmarks(tables: TableAccessor, body: any) {
  const rows = Array.isArray(body?.bookmarks) ? body.bookmarks : []
  const bookmarks = rows
    .map((entry: any) => ({ name: String(entry?.name ?? '').trim(), url: String(entry?.url ?? '').trim() }))
    .filter((entry: { name: string; url: string }) => entry.name && /^https?:\/\//.test(entry.url))
    .slice(0, 24)
  await writeSettings(tables, { bookmarks })
  return { ok: true, bookmarks }
}

// ---- habits and focus ------------------------------------------------------

export async function tickHabit(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const settings = readSettings(tables)
  const day = Number.isInteger(body?.day) ? Number(body.day) : (new Date().getDay() + 6) % 7
  if (!Number.isInteger(day) || day < 0 || day > 6) return { ok: false, error: 'day 必须是 0–6' }
  let found: Record<string, any> | null = null
  const habits = settings.habits.map((habit) => {
    if (habit.id !== id) return habit
    const week = [...(habit.week ?? [0, 0, 0, 0, 0, 0, 0])]
    const next = week[day] ? 0 : 1
    week[day] = next
    found = { ...habit, week, streak: Math.max(0, (habit.streak ?? 0) + (next ? 1 : -1)) }
    return found
  })
  if (!found) return { ok: false, error: '没有这个习惯' }
  await writeSettings(tables, { habits })
  return { ok: true, habit: found, habits }
}

export async function setFocus(tables: TableAccessor, body: any) {
  const settings = readSettings(tables)
  const current = settings.focus
  const action = String(body?.action ?? '')
  const now = Date.now()

  if (action === 'start') {
    const left = Number.isFinite(body?.left) ? Number(body.left) : current.left
    const focus = {
      ...current,
      running: true,
      left,
      deadline: now + left * 1000,
      task: body?.task === undefined ? current.task : (body.task || null),
    }
    await writeSettings(tables, { focus })
    return { ok: true, focus }
  }
  if (action === 'pause') {
    const left = current.running && current.deadline
      ? Math.max(0, Math.round((current.deadline - now) / 1000))
      : current.left
    const focus = { ...current, running: false, left, deadline: null }
    await writeSettings(tables, { focus })
    return { ok: true, focus }
  }
  if (action === 'reset') {
    const focus = {
      ...current,
      running: false,
      left: current.total,
      deadline: null,
      task: body?.task === undefined ? current.task : (body.task || null),
    }
    await writeSettings(tables, { focus })
    return { ok: true, focus }
  }
  if (action === 'task') {
    const focus = { ...current, task: body?.task || null }
    await writeSettings(tables, { focus })
    return { ok: true, focus }
  }
  if (action === 'complete') {
    const focus = {
      ...current,
      running: false,
      left: current.total,
      deadline: null,
      sessions: (current.sessions ?? 0) + 1,
    }
    await writeSettings(tables, { focus })
    return { ok: true, focus }
  }
  return { ok: false, error: `不认识的动作：${action}` }
}

export function resolveFocus(focus: any): Record<string, any> {
  if (!focus?.running || !focus.deadline) return { ...focus, left: focus?.left ?? 0, deadline: null }
  const left = Math.max(0, Math.round((focus.deadline - Date.now()) / 1000))
  if (left > 0) return { ...focus, left }
  return { ...focus, running: false, left: focus.total, deadline: null }
}

export const fitsIn = (type: string, size: string, cols: number): boolean => {
  const [w, h] = footprint(type, size, cols)
  return w <= cols && h > 0
}

export const ACTIONS: Record<string, (tables: TableAccessor, body: any) => Promise<any>> = {
  'board.create': createBoard,
  'board.rename': renameBoard,
  'board.remove': removeBoard,
  'board.active': setActiveBoard,
  'widget.add': addWidget,
  'widget.update': updateWidget,
  'widget.remove': removeWidget,
  'widget.duplicate': duplicateWidget,
  'widget.resize': resizeWidget,
  'layout.set': setLayout,
  'task.add': addTask,
  'task.update': updateTask,
  'task.remove': removeTask,
  capture,
  'note.add': addNote,
  'note.remove': removeNote,
  'readlater.set': setReadLater,
  'interests.set': setInterests,
  'bookmarks.set': setBookmarks,
  'habit.tick': tickHabit,
  'focus.set': setFocus,
  'item.toTask': (tables, body) => addTask(tables, {
    title: String(body?.title ?? '').slice(0, 300) || '未命名',
    list: body?.list ?? 'inbox',
    origin: body?.origin ?? null,
  }),
  'item.toNote': (tables, body) => addNote(tables, {
    text: String(body?.text ?? body?.title ?? '').slice(0, 800) || '未命名',
    origin: body?.origin ?? null,
  }),
}

export const ACTION_NAMES: string[] = Object.keys(ACTIONS)
