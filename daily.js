/**
 * The personal-data half of the store: Boards, Widgets, layouts, Tasks, Notes, Read Later,
 * 关注词 and habits.
 *
 * Items come from Sources and are already durable; everything here is what the user makes.
 * The functions take a `tables` accessor rather than the domain handle so this file stays
 * testable without a storage backend, and they never touch the network.
 *
 * Keys must be path-safe (AGENTS.md rule 3): `layoutKey()` collapses `boardId`+`cols` into
 * one, and every id is minted Host-side by `newId()`.
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
} from './personal.js'

const SETTINGS_KEY = 'personal'
export const SETTINGS_KEYS = {
  legacy: SETTINGS_KEY,
  active: 'active',
  interests: 'interests',
  bookmarks: 'bookmarks',
  habits: 'habits',
  focus: 'focus',
}

const nowIso = () => new Date().toISOString()

/** Habits are a fixed three-domain default; the user only ticks them. */
const DEFAULT_HABITS = [
  { id: 'h1', name: '阅读 30 分钟', streak: 0, week: [0, 0, 0, 0, 0, 0, 0] },
  { id: 'h2', name: '运动 30 分钟', streak: 0, week: [0, 0, 0, 0, 0, 0, 0] },
  { id: 'h3', name: '23:30 前睡觉', streak: 0, week: [0, 0, 0, 0, 0, 0, 0] },
]

export const DEFAULT_FOCUS = { total: 25 * 60, left: 25 * 60, running: false, task: null, sessions: 0, startedAt: null }

/** Settings that are singular rather than a list. */
const defaultSettings = () => ({
  active: 'home',
  interests: [],
  bookmarks: BOOKMARKS_DEFAULT.map(([name, url]) => ({ name, url })),
  habits: DEFAULT_HABITS,
  focus: DEFAULT_FOCUS,
})

const revOf = (record) => (Number.isSafeInteger(record?.revision) ? record.revision : 0)

/**
 * Write the starting Boards the first time the domain is opened.
 *
 * `seeded` lives in the settings record rather than in the domain global so a backup-and-skip
 * on that one key re-seeds nothing rather than wiping a user's boards: an existing Board row
 * is the real signal, and this only runs when there is none.
 */
export async function ensureSeeded(tables) {
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

/**
 * Read settings from granular records (`active`, `interests`, `bookmarks`, `habits`, `focus`),
 * falling back transparently to legacy `settings/personal` and then to defaults.
 */
export function readSettings(tables) {
  const defaults = defaultSettings()
  const settingsTable = tables('settings')
  const legacy = settingsTable.get(SETTINGS_KEY) ?? {}
  const activeRec = settingsTable.get(SETTINGS_KEYS.active)
  const interestsRec = settingsTable.get(SETTINGS_KEYS.interests)
  const bookmarksRec = settingsTable.get(SETTINGS_KEYS.bookmarks)
  const habitsRec = settingsTable.get(SETTINGS_KEYS.habits)
  const focusRec = settingsTable.get(SETTINGS_KEYS.focus)

  const active = activeRec?.active ?? legacy.active ?? defaults.active
  const interests = Array.isArray(interestsRec?.interests)
    ? interestsRec.interests
    : (Array.isArray(legacy.interests) ? legacy.interests : defaults.interests)
  const bookmarks = Array.isArray(bookmarksRec?.bookmarks)
    ? bookmarksRec.bookmarks
    : (Array.isArray(legacy.bookmarks) ? legacy.bookmarks : defaults.bookmarks)
  const habits = Array.isArray(habitsRec?.habits)
    ? habitsRec.habits
    : (Array.isArray(legacy.habits) ? legacy.habits : defaults.habits)
  const focusRaw = focusRec?.focus ?? legacy.focus ?? {}

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

export function readSettingsRevisions(tables) {
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

/**
 * Write only the targeted setting keys so changing active Board never bumps habits/focus/bookmarks.
 */
async function writeSettings(tables, patch) {
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

const listBoards = (tables) => {
  const rows = []
  for (const [, value] of tables('boards').entries()) if (value?.id) rows.push(value)
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)))
  return rows
}

const listWidgets = (tables) => {
  const map = {}
  for (const [key, value] of tables('widgets').entries()) if (value?.id) map[key] = value
  return map
}

/**
 * A Board's layout at one breakpoint.
 *
 * A breakpoint with no saved layout of its own is derived from the 12-column one on first
 * read, so a phone layout starts as a copy rather than an empty Board; the derived copy is
 * not written back until the user edits it, which keeps two layouts from silently diverging.
 */
function layoutOf(tables, boardId, cols) {
  const stored = tables('layouts').get(layoutKey(boardId, cols))
  if (stored?.order) return stored.order
  const base = tables('layouts').get(layoutKey(boardId, 12))
  const order = (base?.order ?? []).map((entry) => ({ ...entry }))
  return order
}

const listTasks = (tables) => {
  const rows = []
  for (const [, value] of tables('tasks').entries()) if (value?.id) rows.push(value)
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)))
  return rows
}

const listNotes = (tables) => {
  const rows = []
  for (const [, value] of tables('notes').entries()) if (value?.id) rows.push(value)
  rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  return rows
}

const listReadLater = (tables) => {
  const rows = []
  for (const [, value] of tables('readlater').entries()) if (value?.itemId) rows.push(value)
  rows.sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))
  return rows.map((entry) => entry.itemId)
}

/** Build a self-contained Item metadata snapshot so saved/starred articles never dangle. */
export function extractItemSnapshot(item, fallback = null) {
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

const listReadLaterEntries = (tables) => {
  const map = {}
  for (const [, value] of tables('readlater').entries()) {
    if (!value?.itemId) continue
    const live = tables('items')?.get?.(value.itemId)
    const snap = extractItemSnapshot(live, value.snapshot)
    if (snap) map[value.itemId] = { ...snap, savedAt: value.savedAt ?? null }
  }
  return map
}

/**
 * Everything the Client half needs, in one response.
 *
 * `sources` is passed in rather than read here: the registry belongs to index.js, and this
 * module only decides how a Widget's 呈现 falls back to its Source's suggestion.
 */
export function readDaily(tables, sources) {
  const settings = readSettings(tables)
  const suggests = new Map(sources.map((source) => [source.id, source.suggests?.pres]))
  const widgets = listWidgets(tables)
  for (const record of Object.values(widgets)) {
    if (record.type === 'subscription') {
      record.settings = normalizeSubscription(record.settings ?? {}, suggests.get(record.settings?.sources?.[0]))
    }
  }

  const boards = listBoards(tables)
  const active = boards.some((board) => board.id === settings.active) ? settings.active : boards[0]?.id ?? null
  const layouts = {}
  const layoutRevisions = {}
  for (const board of boards) {
    layouts[board.id] = {}
    for (const cols of BREAKPOINTS) {
      const lKey = layoutKey(board.id, cols)
      layouts[board.id][cols] = layoutOf(tables, board.id, cols)
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
      const storedState = tables('sources')?.get?.(source.id) ?? {}
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

export async function createBoard(tables, body) {
  const name = String(body?.name ?? '').trim()
  if (!name) return { ok: false, error: '需要一个 Board 名称' }
  const boards = listBoards(tables)
  const id = newId('b')
  const existing = tables('boards').get(id)
  if (existing) return { ok: true, board: existing, active: id }
  const record = { id, name: name.slice(0, 40), icon: typeof body?.icon === 'string' ? body.icon : 'board', order: boards.length }
  await tables('boards').put(id, record)
  // A new Board is empty at every breakpoint; writing the rows keeps a later breakpoint
  // derivation from copying another Board's Widgets into it.
  for (const cols of BREAKPOINTS) {
    await tables('layouts').put(layoutKey(id, cols), { boardId: id, cols, order: [] })
  }
  await writeSettings(tables, { active: id })
  return { ok: true, board: record, active: id }
}

export async function renameBoard(tables, body) {
  const id = String(body?.id ?? '')
  const existing = tables('boards').get(id)
  if (!existing) return { ok: false, error: '没有这个 Board' }
  const name = String(body?.name ?? '').trim()
  if (!name) return { ok: false, error: '需要一个 Board 名称' }
  const record = { ...existing, name: name.slice(0, 40) }
  await tables('boards').put(id, record)
  return { ok: true, board: record }
}

export async function removeBoard(tables, body) {
  const id = String(body?.id ?? '')
  const boards = listBoards(tables)
  if (boards.length <= 1) return { ok: false, error: '至少要留一个 Board' }
  const existing = tables('boards').get(id)
  if (!existing) return { ok: false, error: '没有这个 Board' }
  const layoutRows = BREAKPOINTS.map((cols) => tables('layouts').get(layoutKey(id, cols))).filter(Boolean)
  // Widgets placed only on this Board go with it; one placed on two Boards stays.
  const kept = new Set()
  for (const board of boards) {
    if (board.id === id) continue
    for (const cols of BREAKPOINTS) {
      for (const entry of layoutOf(tables, board.id, cols)) kept.add(entry.id)
    }
  }
  const removedWidgets = []
  for (const record of layoutRows.flatMap((row) => row.order ?? [])) {
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

export async function setActiveBoard(tables, body) {
  const id = String(body?.id ?? '')
  if (!tables('boards').get(id)) return { ok: false, error: '没有这个 Board' }
  await writeSettings(tables, { active: id })
  return { ok: true, active: id }
}

// ---- Widgets and layouts ---------------------------------------------------

export async function addWidget(tables, body) {
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

  // Place it on every breakpoint so switching to the phone layout does not lose it.
  for (const cols of BREAKPOINTS) {
    const key = layoutKey(boardId, cols)
    const current = tables('layouts').get(key) ?? { boardId, cols, order: layoutOf(tables, boardId, cols) }
    await tables('layouts').put(key, { boardId, cols, order: [...current.order, { id, size }] })
  }
  return { ok: true, widget: record }
}

export async function updateWidget(tables, body) {
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

export async function removeWidget(tables, body) {
  const id = String(body?.id ?? '')
  if (!tables('widgets').get(id)) return { ok: false, error: '没有这个 Widget' }
  for (const [, value] of tables('layouts').entries()) {
    if (!Array.isArray(value?.order) || !value.order.some((entry) => entry.id === id)) continue
    await tables('layouts').put(layoutKey(value.boardId, value.cols), {
      ...value,
      order: value.order.filter((entry) => entry.id !== id),
    })
  }
  await tables('widgets').delete(id)
  return { ok: true, removed: id }
}

export async function duplicateWidget(tables, body) {
  const id = String(body?.id ?? '')
  const existing = tables('widgets').get(id)
  if (!existing) return { ok: false, error: '没有这个 Widget' }
  const boardId = String(body?.boardId ?? readSettings(tables).active)
  if (!tables('boards').get(boardId)) return { ok: false, error: '没有这个 Board' }

  const copy = { ...normalizeWidget({ ...existing, id: newId('w') }) }
  await tables('widgets').put(copy.id, copy)
  for (const cols of BREAKPOINTS) {
    const key = layoutKey(boardId, cols)
    const current = tables('layouts').get(key) ?? { boardId, cols, order: layoutOf(tables, boardId, cols) }
    const order = [...current.order]
    const index = order.findIndex((entry) => entry.id === id)
    const at = index >= 0 ? index + 1 : order.length
    const size = index >= 0 ? order[index].size : safeSize(copy.type, undefined)
    order.splice(at, 0, { id: copy.id, size })
    await tables('layouts').put(key, { boardId, cols, order })
  }
  return { ok: true, widget: copy }
}

/** The whole ordered list at one breakpoint; the Client sends it after a drag. */
export async function setLayout(tables, body) {
  const boardId = String(body?.boardId ?? '')
  const cols = Number(body?.cols)
  if (!tables('boards').get(boardId)) return { ok: false, error: '没有这个 Board' }
  if (!BREAKPOINTS.includes(cols)) return { ok: false, error: `不支持的列数：${body?.cols}` }
  const widgets = listWidgets(tables)
  const seen = new Set()
  const order = []
  for (const entry of Array.isArray(body?.order) ? body.order : []) {
    const id = String(entry?.id ?? '')
    if (!widgets[id] || seen.has(id)) continue
    seen.add(id)
    order.push({ id, size: safeSize(widgets[id].type, entry?.size) })
  }
  await tables('layouts').put(layoutKey(boardId, cols), { boardId, cols, order })
  return { ok: true, order }
}

/** One Widget's Size at one breakpoint, without resending the list. */
export async function resizeWidget(tables, body) {
  const id = String(body?.id ?? '')
  const boardId = String(body?.boardId ?? readSettings(tables).active)
  const cols = Number(body?.cols ?? 12)
  const record = tables('widgets').get(id)
  if (!record) return { ok: false, error: '没有这个 Widget' }
  if (!BREAKPOINTS.includes(cols)) return { ok: false, error: `不支持的列数：${body?.cols}` }
  const size = safeSize(record.type, body?.size)
  const key = layoutKey(boardId, cols)
  const current = tables('layouts').get(key) ?? { boardId, cols, order: layoutOf(tables, boardId, cols) }
  const order = current.order.map((entry) => (entry.id === id ? { ...entry, size } : entry))
  await tables('layouts').put(key, { boardId, cols, order })
  return { ok: true, id, size }
}

// ---- Tasks -----------------------------------------------------------------

async function nextTaskOrder(tables, list) {
  const rows = listTasks(tables).filter((task) => task.list === list)
  return rows.reduce((max, task) => Math.max(max, task.order ?? 0), 0) + 1
}

export async function capture(tables, body) {
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

export async function addTask(tables, body) {
  const title = String(body?.title ?? '').trim()
  if (!title) return { ok: false, error: '任务需要一个标题' }
  const list = TASK_LISTS.includes(body?.list) ? body.list : 'inbox'
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

export async function updateTask(tables, body) {
  const id = String(body?.id ?? '')
  const existing = tables('tasks').get(id)
  if (!existing) return { ok: false, error: '没有这个任务' }
  const patch = {}
  if (typeof body?.done === 'boolean') patch.done = body.done
  if (TASK_LISTS.includes(body?.list)) patch.list = body.list
  if (body?.project !== undefined) patch.project = body.project || null
  if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 300)
  if (Object.keys(patch).length === 0) return { ok: false, error: '没有要改的字段' }
  if (patch.list && patch.list !== existing.list) patch.order = await nextTaskOrder(tables, patch.list)
  const next = { ...existing, ...patch }
  await tables('tasks').put(id, next)
  return { ok: true, task: next }
}

export async function removeTask(tables, body) {
  const id = String(body?.id ?? '')
  if (!tables('tasks').get(id)) return { ok: false, error: '没有这个任务' }
  await tables('tasks').delete(id)
  return { ok: true, removed: id }
}

// ---- Notes -----------------------------------------------------------------

export async function addNote(tables, body) {
  const text = String(body?.text ?? '').trim()
  if (!text) return { ok: false, error: 'Note 需要一个标题' }
  const id = newId('n')
  const existing = tables('notes').get(id)
  if (existing) return { ok: true, note: existing }
  const note = { id, text: text.slice(0, 2000), origin: body?.origin ?? null, createdAt: nowIso() }
  await tables('notes').put(note.id, note)
  return { ok: true, note }
}

export async function removeNote(tables, body) {
  const id = String(body?.id ?? '')
  if (!tables('notes').get(id)) return { ok: false, error: '没有这条 Note' }
  await tables('notes').delete(id)
  return { ok: true, removed: id }
}

// ---- Read Later ------------------------------------------------------------

export async function setReadLater(tables, body) {
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

export async function setInterests(tables, body) {
  const raw = Array.isArray(body?.interests) ? body.interests : String(body?.text ?? '').split(/[,，、\s]+/)
  const interests = [...new Set(raw.map((entry) => String(entry).trim()).filter(Boolean))].slice(0, 40)
  await writeSettings(tables, { interests })
  return { ok: true, interests }
}

// ---- bookmarks -------------------------------------------------------------

export async function setBookmarks(tables, body) {
  const rows = Array.isArray(body?.bookmarks) ? body.bookmarks : []
  const bookmarks = rows
    .map((entry) => ({ name: String(entry?.name ?? '').trim(), url: String(entry?.url ?? '').trim() }))
    .filter((entry) => entry.name && /^https?:\/\//.test(entry.url))
    .slice(0, 24)
  await writeSettings(tables, { bookmarks })
  return { ok: true, bookmarks }
}

// ---- habits and focus ------------------------------------------------------

export async function tickHabit(tables, body) {
  const id = String(body?.id ?? '')
  const settings = readSettings(tables)
  const day = Number.isInteger(body?.day) ? body.day : (new Date().getDay() + 6) % 7
  if (!Number.isInteger(day) || day < 0 || day > 6) return { ok: false, error: 'day 必须是 0–6' }
  let found = null
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

/**
 * The focus timer is a countdown the Host owns.
 *
 * Ticking it in the Client would reset on every reload, and a stale `left` would be shown
 * after a restart; storing the deadline instead means "how much is left" is derived.
 */
export async function setFocus(tables, body) {
  const settings = readSettings(tables)
  const current = settings.focus
  const action = String(body?.action ?? '')
  const now = Date.now()

  if (action === 'start') {
    const left = Number.isFinite(body?.left) ? body.left : current.left
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
    const focus = { ...current, running: false, left: current.total, deadline: null, task: body?.task === undefined ? current.task : (body.task || null) }
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

/** A running timer that was never paused is derived from its deadline on read. */
export function resolveFocus(focus) {
  if (!focus?.running || !focus.deadline) return { ...focus, left: focus?.left ?? 0, deadline: null }
  const left = Math.max(0, Math.round((focus.deadline - Date.now()) / 1000))
  if (left > 0) return { ...focus, left }
  return { ...focus, running: false, left: focus.total, deadline: null }
}

/**
 * How many rows a Widget's content needs at one breakpoint, used only to validate a Size
 * the Client asked for; the renderer measures itself.
 */
export const fitsIn = (type, size, cols) => {
  const [w, h] = footprint(type, size, cols)
  return w <= cols && h > 0
}

// ---- the action registry ---------------------------------------------------

/**
 * Every mutation the personal half performs, named.
 *
 * This table is what `core/commands.js` validates against and journals, so the local
 * `POST /sooyo/action`, the sync API's `/command` and the Agent tools all reach exactly the
 * same implementation. A name that is not here cannot be invoked by any of them — the
 * whitelist in `core/protocol.js` is generated from this table rather than maintained twice.
 *
 * `item.state` is deliberately absent: it is Item state (the `read` table), not personal
 * data, and it lives in `core/commands.js` next to the funnel that writes it.
 */
export const ACTIONS = {
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
  // An Item becomes a Task or a Note while keeping its Origin (source + original link).
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

/** The names the local route and the sync funnel both accept. */
export const ACTION_NAMES = Object.keys(ACTIONS)
