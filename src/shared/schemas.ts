import type { SettingsSchema } from './widget.ts'
import type { TaskListName, WidgetSize } from './domain.ts'

export const PATH_SAFE_RE = /^[a-zA-Z0-9_-]+$/
export const TABLE_NAME_RE = /^[a-z][a-z0-9_]*$/

export const ALL_WIDGET_SIZES: readonly WidgetSize[] = ['S', 'M', 'L', 'Wide', 'Tall', 'XL'] as const

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
    return null
  } catch {
    return null
  }
}

export interface SubscriptionSettings {
  sources: string[]
  pres: '图文' | '卡片' | '热榜' | '论文' | '视频' | '早报' | string
  cat?: string
}

export interface TaskWidgetSettings {
  list: TaskListName | 'all'
  showDone?: boolean
}

export interface NoteWidgetSettings {
  tag: string
}

export interface CaptureWidgetSettings {
  target: TaskListName | 'note'
  placeholder?: string
}

export interface BookmarksWidgetSettings {
  group: string
}

export interface ProjectWidgetSettings {
  focusId: string
}

export interface ReadLaterWidgetSettings {
  filter: 'all' | 'unread'
}

export interface HabitWidgetSettings {
  compact?: boolean
}

export interface FocusWidgetSettings {
  minutes: number
}

export interface AgentInboxWidgetSettings {
  filter: 'pending' | 'all'
}

export const subscriptionSettingsSchema: SettingsSchema<SubscriptionSettings> = {
  defaults: { sources: ['aihot'], pres: '图文', cat: 'all' },
  normalize(raw: unknown): SubscriptionSettings {
    const obj = isRecord(raw) ? raw : {}
    const sources = asStringArray(obj.sources, ['aihot'])
    const pres = asString(obj.pres, '图文') || '图文'
    const cat = asString(obj.cat, 'all') || 'all'
    return {
      ...obj,
      sources: sources.length > 0 ? sources : ['aihot'],
      pres,
      cat,
    }
  },
}

export const taskSettingsSchema: SettingsSchema<TaskWidgetSettings> = {
  defaults: { list: 'today', showDone: true },
  normalize(raw: unknown): TaskWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    const rawList = asString(obj.list, 'today')
    const list: TaskWidgetSettings['list'] =
      rawList === 'inbox' || rawList === 'today' || rawList === 'later' || rawList === 'all'
        ? rawList
        : 'today'
    return {
      ...obj,
      list,
      showDone: obj.showDone === undefined ? true : Boolean(obj.showDone),
    }
  },
}

export const noteSettingsSchema: SettingsSchema<NoteWidgetSettings> = {
  defaults: { tag: 'all' },
  normalize(raw: unknown): NoteWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    return { ...obj, tag: asString(obj.tag, 'all') || 'all' }
  },
}

export const captureSettingsSchema: SettingsSchema<CaptureWidgetSettings> = {
  defaults: { target: 'inbox' },
  normalize(raw: unknown): CaptureWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    const rawTarget = asString(obj.target, 'inbox')
    const target: CaptureWidgetSettings['target'] =
      rawTarget === 'inbox' || rawTarget === 'today' || rawTarget === 'later' || rawTarget === 'note'
        ? rawTarget
        : 'inbox'
    return { ...obj, target }
  },
}

export const bookmarksSettingsSchema: SettingsSchema<BookmarksWidgetSettings> = {
  defaults: { group: 'all' },
  normalize(raw: unknown): BookmarksWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    return { ...obj, group: asString(obj.group, 'all') || 'all' }
  },
}

export const projectSettingsSchema: SettingsSchema<ProjectWidgetSettings> = {
  defaults: { focusId: 'all' },
  normalize(raw: unknown): ProjectWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    return { ...obj, focusId: asString(obj.focusId, 'all') || 'all' }
  },
}

export const readLaterSettingsSchema: SettingsSchema<ReadLaterWidgetSettings> = {
  defaults: { filter: 'all' },
  normalize(raw: unknown): ReadLaterWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    const filter = obj.filter === 'unread' ? 'unread' : 'all'
    return { ...obj, filter }
  },
}

export const habitSettingsSchema: SettingsSchema<HabitWidgetSettings> = {
  defaults: { compact: false },
  normalize(raw: unknown): HabitWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    return { ...obj, compact: Boolean(obj.compact) }
  },
}

export const focusSettingsSchema: SettingsSchema<FocusWidgetSettings> = {
  defaults: { minutes: 25 },
  normalize(raw: unknown): FocusWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    const min = Number(obj.minutes)
    return { ...obj, minutes: Number.isFinite(min) && min >= 5 && min <= 120 ? Math.round(min) : 25 }
  },
}

export const agentInboxSettingsSchema: SettingsSchema<AgentInboxWidgetSettings> = {
  defaults: { filter: 'pending' },
  normalize(raw: unknown): AgentInboxWidgetSettings {
    const obj = isRecord(raw) ? raw : {}
    return { ...obj, filter: obj.filter === 'all' ? 'all' : 'pending' }
  },
}

export const passthroughSettingsSchema: SettingsSchema<Record<string, unknown>> = {
  defaults: {},
  normalize(raw: unknown): Record<string, unknown> {
    return isRecord(raw) ? { ...raw } : {}
  },
}
