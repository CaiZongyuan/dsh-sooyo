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
  retros: 'retros',
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
  retros: {} as Record<string, any>,
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
  const retrosRec = settingsTable.get(SETTINGS_KEYS.retros) as Record<string, any> | undefined

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
  const retros: Record<string, any> = retrosRec?.retros && typeof retrosRec.retros === 'object'
    ? retrosRec.retros
    : (legacy.retros && typeof legacy.retros === 'object' ? legacy.retros : defaults.retros)

  return {
    ...defaults,
    ...legacy,
    active,
    interests,
    bookmarks,
    habits,
    focus: { ...DEFAULT_FOCUS, ...focusRaw },
    retros,
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
    retros: revOf(settingsTable.get(SETTINGS_KEYS.retros) ?? legacy),
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
  if ('retros' in patch) {
    await settingsTable.put(SETTINGS_KEYS.retros, { id: SETTINGS_KEYS.retros, retros: patch.retros })
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

export const COLLECTION_KINDS = ['github', 'x', 'web', 'image', 'music', 'video', 'article'] as const
export const CONTENT_STATUSES = ['inbox', 'curated', 'archived'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

export function inferCollectionKind(url?: string | null, explicit?: string | null): string {
  if (explicit && (COLLECTION_KINDS as readonly string[]).includes(explicit)) return explicit
  const u = String(url ?? '').trim()
  if (!u) return 'web'
  if (/github\.com\//i.test(u)) return 'github'
  if (/(^|\/\/|\.)(x\.com|twitter\.com)\//i.test(u)) return 'x'
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u)) return 'image'
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /(youtube\.com|youtu\.be|bilibili\.com|b23\.tv|vimeo\.com)/i.test(u)) return 'video'
  if (/\.(mp3|flac|wav|ogg|m4a)(\?|$)/i.test(u) || /(music\.163\.com|y\.qq\.com|spotify\.com|music\.apple\.com|soundcloud\.com)/i.test(u)) return 'music'
  return 'web'
}

const KIND_LABELS: Record<string, string> = {
  github: 'GitHub',
  x: 'X 收藏',
  web: '网站',
  image: '图片',
  music: '音乐',
  video: '视频',
  article: '文章',
}

/** Build a self-contained Item metadata snapshot so saved/starred articles never dangle. */
export function extractItemSnapshot(item: any, fallback: any = null): Record<string, any> | null {
  const src = item ?? fallback
  if (!src || typeof src !== 'object') return null
  const id = src.id ?? src.itemId ?? null
  if (!id) return null
  const url = String(src.url ?? fallback?.url ?? '').slice(0, 2000)
  const kind = inferCollectionKind(url, src.kind ?? fallback?.kind)
  const status = (CONTENT_STATUSES as readonly string[]).includes(String(src.status ?? fallback?.status ?? ''))
    ? String(src.status ?? fallback?.status)
    : 'inbox'
  const rawTags = Array.isArray(src.tags) ? src.tags : (Array.isArray(fallback?.tags) ? fallback.tags : [])
  const tags = rawTags.map((t: unknown) => String(t ?? '').trim()).filter(Boolean).slice(0, 12)
  const rawMeta = (src.meta && typeof src.meta === 'object' ? src.meta : (fallback?.meta && typeof fallback.meta === 'object' ? fallback.meta : null))
  return {
    id: String(id),
    title: String(src.title ?? fallback?.title ?? '(无标题)').slice(0, 300),
    url,
    sourceId: String(src.sourceId ?? fallback?.sourceId ?? kind ?? 'saved').slice(0, 100),
    sourceLabel: String(src.sourceLabel ?? fallback?.sourceLabel ?? src.origin ?? KIND_LABELS[kind] ?? '已保存').slice(0, 100),
    publishedAt: src.publishedAt ?? src.discoveredAt ?? fallback?.publishedAt ?? null,
    thumbnail: src.thumbnail ?? src.cover ?? fallback?.thumbnail ?? null,
    summary: String(src.summary ?? src.description ?? fallback?.summary ?? '').slice(0, 1000),
    tldr: String(src.tldr ?? fallback?.tldr ?? '').slice(0, 500),
    reason: String(src.reason ?? fallback?.reason ?? '').slice(0, 500),
    category: String(src.category ?? fallback?.category ?? kind ?? 'other').slice(0, 60),
    kind,
    status,
    tags,
    externalUrl: src.externalUrl ? String(src.externalUrl).slice(0, 2000) : (fallback?.externalUrl ? String(fallback.externalUrl).slice(0, 2000) : null),
    meta: rawMeta,
    origin: String(src.origin ?? src.sourceLabel ?? fallback?.origin ?? KIND_LABELS[kind] ?? '已保存').slice(0, 100),
    score: typeof src.score === 'number' ? src.score : (typeof fallback?.score === 'number' ? fallback.score : null),
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
    retros: settings.retros ?? {},
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

const todayDayKey = (): string => new Date().toISOString().slice(0, 10)

async function nextTaskOrder(tables: TableAccessor, list: string): Promise<number> {
  const rows = listTasks(tables).filter((task) => task.list === list)
  return rows.reduce((max, task) => Math.max(max, task.order ?? 0), 0) + 1
}

export async function capture(tables: TableAccessor, body: any) {
  const text = String(body?.text ?? '').trim()
  if (!text) return { ok: false, error: '写点什么再回车' }
  const mode = String(body?.mode ?? '')
  const asNote = mode === 'note' || /^#note\s*/i.test(text)
  if (asNote) {
    return addNote(tables, {
      text: text.replace(/^#note\s*/i, '').slice(0, 2000),
      title: body?.title,
      tags: body?.tags,
      externalUrl: body?.externalUrl,
      origin: body?.origin ?? null,
    })
  }
  const isBareUrl = mode === 'collection' || (mode !== 'task' && /^https?:\/\/\S+$/i.test(text))
  if (isBareUrl) {
    return saveCollection(tables, {
      url: text,
      title: body?.title || text.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 120),
      kind: body?.kind,
      summary: body?.summary,
      thumbnail: body?.thumbnail,
      tags: body?.tags,
    })
  }
  return addTask(tables, {
    title: text,
    list: body?.list ?? 'inbox',
    due: body?.due ?? null,
    priority: body?.priority ?? null,
    project: body?.project ?? null,
  })
}

export async function addTask(tables: TableAccessor, body: any) {
  const title = String(body?.title ?? '').trim()
  if (!title) return { ok: false, error: '任务需要一个标题' }
  const due = typeof body?.due === 'string' && body.due.trim() ? body.due.trim().slice(0, 10) : null
  const explicitList = (TASK_LISTS as readonly string[]).includes(String(body?.list ?? '')) ? String(body.list) : null
  const list = explicitList ?? (due ? (due <= todayDayKey() ? 'today' : 'later') : 'inbox')
  const priority = (TASK_PRIORITIES as readonly string[]).includes(String(body?.priority ?? ''))
    ? String(body.priority)
    : null
  const subtasks = Array.isArray(body?.subtasks)
    ? body.subtasks
        .slice(0, 30)
        .map((s: any, idx: number) => ({
          id: String(s?.id || `sub-${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-'),
          title: String(s?.title ?? '').trim().slice(0, 200),
          done: Boolean(s?.done),
        }))
        .filter((s: any) => s.title)
    : []
  const id = newId('t')
  const existing = tables('tasks').get(id)
  if (existing) return { ok: true, task: existing }
  const task = {
    id,
    title: title.slice(0, 300),
    list,
    due: list === 'today' && !due && explicitList === 'today' ? due : due,
    priority,
    note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null,
    subtasks,
    project: typeof body?.project === 'string' && body.project ? body.project : null,
    done: false,
    completedAt: null,
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
  if (typeof body?.done === 'boolean') {
    patch.done = body.done
    patch.completedAt = body.done ? nowIso() : null
  }
  if (body?.due !== undefined) {
    const nextDue = typeof body.due === 'string' && body.due.trim() ? body.due.trim().slice(0, 10) : null
    patch.due = nextDue
    if (!(TASK_LISTS as readonly string[]).includes(String(body?.list ?? ''))) {
      patch.list = nextDue === null ? 'inbox' : (nextDue <= todayDayKey() ? 'today' : 'later')
    }
  }
  if ((TASK_LISTS as readonly string[]).includes(String(body?.list ?? ''))) {
    patch.list = body.list
    if (body.list === 'inbox' && body?.due === undefined && existing.due) {
      patch.due = null
    }
  }
  if (body?.priority !== undefined) {
    patch.priority = (TASK_PRIORITIES as readonly string[]).includes(String(body.priority ?? '')) ? String(body.priority) : null
  }
  if (body?.note !== undefined) {
    patch.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null
  }
  if (Array.isArray(body?.subtasks)) {
    patch.subtasks = body.subtasks
      .slice(0, 30)
      .map((s: any, idx: number) => ({
        id: String(s?.id || `sub-${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-'),
        title: String(s?.title ?? '').trim().slice(0, 200),
        done: Boolean(s?.done),
      }))
      .filter((s: any) => s.title)
  }
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

// ---- Notes (轻量速记/备忘/灵感) ---------------------------------------------

export async function addNote(tables: TableAccessor, body: any) {
  const text = String(body?.text ?? '').trim()
  if (!text) return { ok: false, error: 'Note 需要一个标题' }
  const id = newId('n')
  const existing = tables('notes').get(id)
  if (existing) return { ok: true, kind: 'note', note: existing }
  const tags = Array.isArray(body?.tags)
    ? body.tags.map((t: unknown) => String(t ?? '').trim()).filter(Boolean).slice(0, 12)
    : []
  const status = (CONTENT_STATUSES as readonly string[]).includes(String(body?.status ?? ''))
    ? String(body.status)
    : 'inbox'
  const note = {
    id,
    title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 160) : null,
    text: text.slice(0, 2000),
    tags,
    status,
    pinned: Boolean(body?.pinned),
    externalUrl: typeof body?.externalUrl === 'string' && /^https?:\/\//i.test(body.externalUrl.trim())
      ? body.externalUrl.trim().slice(0, 2000)
      : null,
    origin: body?.origin ?? null,
    createdAt: nowIso(),
  }
  await tables('notes').put(note.id, note)
  return { ok: true, kind: 'note', note }
}

export async function updateNote(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  const existing = tables('notes').get(id)
  if (!existing) return { ok: false, error: '没有这条 Note' }
  const patch: Record<string, any> = {}
  if (typeof body?.text === 'string' && body.text.trim()) patch.text = body.text.trim().slice(0, 2000)
  if (body?.title !== undefined) patch.title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 160) : null
  if (Array.isArray(body?.tags)) {
    patch.tags = body.tags.map((t: unknown) => String(t ?? '').trim()).filter(Boolean).slice(0, 12)
  }
  if (body?.status !== undefined && (CONTENT_STATUSES as readonly string[]).includes(String(body.status))) {
    patch.status = String(body.status)
  }
  if (typeof body?.pinned === 'boolean') patch.pinned = body.pinned
  if (body?.externalUrl !== undefined) {
    patch.externalUrl = typeof body.externalUrl === 'string' && /^https?:\/\//i.test(body.externalUrl.trim())
      ? body.externalUrl.trim().slice(0, 2000)
      : null
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: '没有要改的字段' }
  const next = { ...existing, ...patch, updatedAt: nowIso() }
  await tables('notes').put(id, next)
  return { ok: true, note: next }
}

export async function removeNote(tables: TableAccessor, body: any) {
  const id = String(body?.id ?? '')
  if (!tables('notes').get(id)) return { ok: false, error: '没有这条 Note' }
  await tables('notes').delete(id)
  return { ok: true, removed: id }
}

// ---- Read Later & Multi-media Collections ----------------------------------

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
    savedAt: existing?.savedAt ?? nowIso(),
    ...(snapshot ? { snapshot } : {}),
  })
  return { ok: true, itemId, saved: true, ...(snapshot ? { snapshot } : {}) }
}

export async function saveCollection(tables: TableAccessor, body: any) {
  const rawItems = Array.isArray(body?.items) ? body.items : [body]
  if (rawItems.length === 0) return { ok: false, error: '缺少要保存的收藏条目' }
  const saved: Array<Record<string, any>> = []
  for (const entry of rawItems.slice(0, 50)) {
    const rawId = typeof entry?.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(entry.id)
      ? entry.id
      : (typeof entry?.itemId === 'string' && /^[a-zA-Z0-9_-]+$/.test(entry.itemId) ? entry.itemId : newId('col'))
    const existing = tables('readlater').get(rawId)
    const live = tables('items')?.get?.(rawId)
    const mergedInput = {
      ...(existing?.snapshot ?? {}),
      ...(live ?? {}),
      ...entry,
      id: rawId,
    }
    const snapshot = extractItemSnapshot(mergedInput, existing?.snapshot)
    if (!snapshot) continue
    await tables('readlater').put(rawId, {
      itemId: rawId,
      savedAt: existing?.savedAt ?? nowIso(),
      updatedAt: nowIso(),
      snapshot,
    })
    saved.push(snapshot)
  }
  if (saved.length === 0) return { ok: false, error: '未能生成有效的收藏元信息' }
  return { ok: true, kind: 'collection', count: saved.length, item: saved[0], items: saved }
}

export async function removeCollection(tables: TableAccessor, body: any) {
  const itemId = String(body?.id ?? body?.itemId ?? '')
  if (!itemId) return { ok: false, error: '缺少收藏 id' }
  if (tables('readlater').get(itemId)) await tables('readlater').delete(itemId)
  return { ok: true, removed: itemId }
}

export async function saveRetro(tables: TableAccessor, body: any) {
  const key = String(body?.key ?? '').trim()
  if (!key || !/^[a-zA-Z0-9_-]+$/.test(key)) return { ok: false, error: '缺少有效的复盘周期 key' }
  const period = ['day', 'week', 'month'].includes(String(body?.period ?? '')) ? String(body.period) : 'week'
  const settings = readSettings(tables)
  const current = { ...(settings.retros ?? {}) }
  const record = {
    key,
    period,
    highlights: String(body?.highlights ?? '').trim().slice(0, 2000),
    blockers: String(body?.blockers ?? '').trim().slice(0, 2000),
    nextFocus: String(body?.nextFocus ?? '').trim().slice(0, 2000),
    updatedAt: nowIso(),
  }
  current[key] = record
  await writeSettings(tables, { retros: current })
  return { ok: true, retro: record, retros: current }
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
  'note.update': updateNote,
  'note.remove': removeNote,
  'readlater.set': setReadLater,
  'collection.save': saveCollection,
  'collection.remove': removeCollection,
  'retro.save': saveRetro,
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
