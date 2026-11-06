/**
 * The Widget Type registry and the state a fresh install starts from.
 *
 * ADR 0001: a Widget Type declares its Sizes, settings and actions; the Widget's Size
 * selects how much of the information it shows. A Source only supplies Items, and may
 * suggest a default 呈现 for a new 订阅 Widget.
 *
 * Relative imports are safe in a pnpm-linked bundle; bare specifiers are not (AGENTS.md
 * rule 1), which is why this file has no imports at all.
 */

/** Desktop footprints, `[columns, rows]` on the 12-column grid. */
export const WIDGET_TYPES = {
  task: {
    name: '任务',
    desc: '今天要做的事，直接勾选完成',
    sizes: { S: [3, 2], M: [3, 4], L: [6, 4] },
    actions: ['勾选完成', '移到今天', '新建任务'],
  },
  subscription: {
    name: '订阅',
    desc: '一个或多个来源的最新内容',
    sizes: { S: [3, 2], M: [6, 2], L: [6, 4], Wide: [12, 3] },
    actions: ['稍后读', '转为任务', '打开原文'],
  },
  capture: {
    name: '快速记录',
    desc: '一行记下想法，回车存进收件箱',
    sizes: { M: [6, 2], Wide: [12, 2] },
    actions: ['记一条任务', '记一条 Note'],
  },
  bookmarks: {
    name: '书签',
    desc: '常去的网站一键直达',
    sizes: { S: [3, 2], M: [6, 2], Wide: [12, 2] },
    actions: ['打开链接'],
  },
  project: {
    name: '项目',
    desc: '按任务完成度看每个 Project 的进度',
    sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
    actions: ['查看动态'],
  },
  readlater: {
    name: '稍后读',
    desc: '存下来、晚点再读的文章',
    sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
    actions: ['转为 Note', '转为任务', '移出'],
  },
  agentInbox: {
    name: 'Agent 收件箱',
    desc: '后台审阅给出的建议，等你批准或拒绝',
    sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
    actions: ['查看差异', '批准', '拒绝'],
  },
  habit: {
    name: '习惯',
    desc: '每天打卡，看连续天数',
    sizes: { S: [3, 2], M: [6, 2] },
    actions: ['打卡'],
  },
  focus: {
    name: '专注计时',
    desc: '番茄钟，可关联一个任务',
    sizes: { S: [3, 2], M: [6, 2] },
    actions: ['开始', '暂停', '重置'],
  },
  calendar: {
    name: '日程',
    desc: '今天和这一周的安排（需要一个日历来源）',
    sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
    actions: ['查看日程'],
    soon: true,
  },
  weather: {
    name: '天气与时钟',
    desc: '本地天气和几个时区（需要一个天气来源）',
    sizes: { S: [3, 2], M: [6, 2] },
    actions: [],
    soon: true,
  },
  briefing: {
    name: '每日简报',
    desc: 'Agent 每天早上写一份摘要',
    sizes: { M: [6, 2], L: [6, 4] },
    actions: [],
    soon: true,
  },
  embed: {
    name: '自定义嵌入',
    desc: '嵌入任意网页或小工具',
    sizes: { M: [6, 2], L: [6, 4] },
    actions: [],
    soon: true,
  },
}

export const SIZE_ORDER = ['S', 'M', 'L', 'Wide']

/** The 呈现 setting of a 订阅 Widget. A Source's `suggests.pres` seeds it. */
export const PRESENTATIONS = ['图文', '榜单', '论文', '产品', '视频']

/** Grid columns per breakpoint, matching the prototype's container queries. */
export const BREAKPOINTS = [12, 6, 4]

export const TASK_LISTS = ['inbox', 'today', 'later']

export const BOOKMARKS_DEFAULT = [
  ['GitHub', 'https://github.com'],
  ['Hugging Face', 'https://huggingface.co'],
  ['arXiv', 'https://arxiv.org'],
  ['AIHOT', 'https://aihot.news'],
  ['Product Hunt', 'https://www.producthunt.com'],
  ['DSH', 'https://github.com/deepseek-ai/deepseek-harness'],
]

/**
 * The footprint a Widget occupies at a given column count.
 *
 * The Sizes are authored on the 12-column desktop grid; narrower breakpoints keep the
 * height and re-derive the width, so a card keeps its information budget rather than being
 * squeezed into an unreadable sliver.
 */
export function footprint(type, size, cols) {
  const sizes = WIDGET_TYPES[type]?.sizes
  const [w, h] = (sizes && (sizes[size] ?? Object.values(sizes)[0])) || [3, 2]
  if (cols >= 12) return [w, h]
  if (cols === 6) return [w >= 6 ? 6 : 3, h]
  return [size === 'S' ? 2 : 4, h]
}

/** A Size the type actually supports, or its smallest (preserving size for unknown types). */
export function safeSize(type, size) {
  if (!WIDGET_TYPES[type]) {
    return typeof size === 'string' && size.trim() ? size.trim() : 'M'
  }
  const sizes = WIDGET_TYPES[type]?.sizes ?? {}
  if (sizes[size]) return size
  return SIZE_ORDER.find((entry) => sizes[entry]) ?? 'S'
}

const widget = (id, type, size, settings = {}, title) => ({ id, type, size, settings, title })

/**
 * What a fresh install shows. Boards, Widgets and layouts only — Tasks, Notes, Read Later,
 * habits and interests start empty, because the prototype's copies were example data.
 *
 * Weather and 日程 are absent on purpose: both need a data source this version does not
 * have, so they sit in the Widget 库 marked 即将推出 rather than showing invented weather.
 */
export function defaultBoards() {
  const boards = [
    { id: 'home', name: '总览', icon: 'home', order: 0 },
    { id: 'work', name: '工作', icon: 'work', order: 1 },
    { id: 'life', name: '生活', icon: 'life', order: 2 },
    { id: 'read', name: '阅读', icon: 'read', order: 3 },
  ]

  const widgets = [
    widget('w-home-task', 'task', 'M'),
    widget('w-home-hot', 'subscription', 'S', { sources: ['aihot-hot'], pres: '榜单', sort: 'rank', deck: true, auto: true }, '热榜'),
    widget('w-home-capture', 'capture', 'Wide'),
    widget('w-home-aihot', 'subscription', 'L', { sources: ['aihot'], pres: '图文', sort: 'match', deck: true }, 'AIHOT 精选'),
    widget('w-home-focus', 'focus', 'S'),
    widget('w-home-project', 'project', 'S'),
    widget('w-home-links', 'bookmarks', 'S'),
    // The Agent Inbox ships on the first Board: a suggestion that no one can find is a
    // suggestion that never gets approved, and this Widget is the whole user-facing half of
    // the background review (issue §6.2).
    widget('w-home-inbox', 'agentInbox', 'S'),

    widget('w-work-task', 'task', 'L'),
    widget('w-work-project', 'project', 'L'),
    widget('w-work-capture', 'capture', 'M'),
    widget('w-work-focus', 'focus', 'S'),

    widget('w-life-habit', 'habit', 'M'),
    widget('w-life-task', 'task', 'S', { project: '生活' }),
    widget('w-life-links', 'bookmarks', 'M'),

    widget('w-read-aihot', 'subscription', 'L', { sources: ['aihot'], pres: '图文', sort: 'match' }, 'AIHOT 精选'),
    widget('w-read-papers', 'subscription', 'L', { sources: ['hf-papers'], pres: '论文', sort: 'score', deck: true }, 'HF 今日论文'),
    widget('w-read-hot', 'subscription', 'S', { sources: ['aihot-hot'], pres: '榜单', sort: 'rank' }, '热榜'),
    widget('w-read-ph', 'subscription', 'S', { sources: ['producthunt'], pres: '产品', sort: 'new' }, 'Product Hunt'),
    widget('w-read-later', 'readlater', 'M'),
    widget('w-read-video', 'subscription', 'Wide', { sources: ['youtube'], pres: '视频', sort: 'new' }, 'Dwarkesh Patel'),
  ]

  const layouts = [
    { boardId: 'home', cols: 12, order: [
      { id: 'w-home-task', size: 'M' },
      { id: 'w-home-hot', size: 'S' },
      { id: 'w-home-capture', size: 'Wide' },
      { id: 'w-home-aihot', size: 'L' },
      { id: 'w-home-focus', size: 'S' },
      { id: 'w-home-project', size: 'S' },
      { id: 'w-home-links', size: 'S' },
      { id: 'w-home-inbox', size: 'S' },
    ] },
    { boardId: 'work', cols: 12, order: [
      { id: 'w-work-task', size: 'L' },
      { id: 'w-work-project', size: 'L' },
      { id: 'w-work-capture', size: 'M' },
      { id: 'w-work-focus', size: 'S' },
    ] },
    { boardId: 'life', cols: 12, order: [
      { id: 'w-life-habit', size: 'M' },
      { id: 'w-life-task', size: 'S' },
      { id: 'w-life-links', size: 'M' },
    ] },
    { boardId: 'read', cols: 12, order: [
      { id: 'w-read-aihot', size: 'L' },
      { id: 'w-read-papers', size: 'L' },
      { id: 'w-read-hot', size: 'S' },
      { id: 'w-read-ph', size: 'S' },
      { id: 'w-read-later', size: 'M' },
      { id: 'w-read-video', size: 'Wide' },
    ] },
  ]

  return { boards, widgets, layouts }
}

/** `boardId`+`cols` is the layout's identity, so it has to survive the path-safe rule. */
export const layoutKey = (boardId, cols) =>
  `${boardId}-${cols}`.replace(/[^a-zA-Z0-9_-]/g, '-')

let activeIdContext = null

/**
 * Deterministically derive a path-safe entity ID from `(prefix, operationId, seq)`.
 *
 * Using a pure-JS 64-bit hash (two 32-bit lanes) keeps `personal.js` isomorphic and
 * dependency-free while guaranteeing that retrying or recovering the same `operationId`
 * always produces the exact same entity IDs in the exact same order.
 */
export function deriveEntityId(prefix, operationId, seq = 0) {
  const seed = `${String(operationId)}:${String(prefix)}:${Number(seq) || 0}`
  let h1 = 0xdeadbeef ^ seed.length
  let h2 = 0x41c6ce57 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const part1 = (h1 >>> 0).toString(36)
  const part2 = (h2 >>> 0).toString(36)
  const safePrefix = String(prefix ?? 'id').replace(/[^a-zA-Z0-9_-]/g, '') || 'id'
  return `${safePrefix}-${part1}${part2}`
}

/**
 * Run `fn` with deterministic `newId()` derivation seeded by `operationId`.
 */
export async function withOperationIdScope(operationId, fn) {
  const previous = activeIdContext
  activeIdContext = operationId ? { operationId: String(operationId), seq: 0 } : null
  try {
    return await fn()
  } finally {
    activeIdContext = previous
  }
}

/** Ids are generated Host-side so a Client never invents a key the store would reject. */
export const newId = (prefix) => {
  if (activeIdContext?.operationId) {
    const seq = activeIdContext.seq
    activeIdContext.seq += 1
    return deriveEntityId(prefix, activeIdContext.operationId, seq)
  }
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/**
 * A 订阅 Widget's settings, normalised.
 *
 * Every field is optional on input: the Gallery may send only `{ sources }`, an older
 * record may carry `kind` (the retired per-Source card), and the renderer must still get a
 * complete set.
 */
export function normalizeSubscription(settings = {}, suggestsPres) {
  const sources = Array.isArray(settings.sources) && settings.sources.length > 0 ? settings.sources : ['aihot']
  const pres = PRESENTATIONS.includes(settings.pres) ? settings.pres : (suggestsPres ?? '图文')
  return {
    ...settings,
    sources,
    pres,
    sort: ['match', 'new', 'score', 'rank'].includes(settings.sort) ? settings.sort : 'new',
    deck: Boolean(settings.deck),
    auto: Boolean(settings.auto),
    cat: typeof settings.cat === 'string' && settings.cat ? settings.cat : null,
  }
}

/**
 * Strip anything a known record must not carry into the store, and fill in its defaults.
 *
 * If `record.type` is an unrecognised Widget Type from a newer plugin version, preserve its
 * `type`, `size`, and any extra fields round-trip instead of coercing it to `'task'`.
 */
export function normalizeWidget(record) {
  const rawType = typeof record?.type === 'string' && record.type.trim() ? record.type.trim() : 'task'
  const known = Boolean(WIDGET_TYPES[rawType])
  const extra = {}
  if (!known && record && typeof record === 'object') {
    for (const [key, value] of Object.entries(record)) {
      if (!['id', 'type', 'title', 'settings'].includes(key)) extra[key] = value
    }
  } else if (known && record && typeof record === 'object' && Number.isSafeInteger(record.revision)) {
    extra.revision = record.revision
  }
  return {
    ...extra,
    id: String(record.id),
    type: rawType,
    title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined,
    settings: rawType === 'subscription' ? normalizeSubscription(record.settings ?? {}) : { ...(record.settings ?? {}) },
  }
}
