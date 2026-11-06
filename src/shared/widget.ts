import type * as React from 'react'
import type {
  Bookmark,
  FeedItem,
  FocusState,
  GridColumns,
  Habit,
  ItemSnapshot,
  Note,
  Proposal,
  SourceMeta,
  Task,
  WidgetRecord,
  WidgetSize,
  WidgetTypeMeta,
} from './domain.ts'

export interface SettingsFieldOption {
  value: string
  label: string
}

export interface SettingsFieldSpec {
  key: string
  label: string
  kind: 'select' | 'multiselect' | 'text' | 'textarea' | 'chips' | 'number'
  options?: SettingsFieldOption[]
  placeholder?: string
}

export interface SettingsSchema<Settings> {
  defaults: Settings
  fields?: SettingsFieldSpec[]
  normalize(raw: unknown): Settings
}

export interface WidgetLayoutMeta {
  sub?: string
  cls?: string
  noHeader?: boolean
  deco?: string
  bg?: React.ReactNode
}

export interface WidgetRenderContext {
  items: FeedItem[]
  byId: Map<string, FeedItem>
  saved: Set<string>
  tasks: Task[]
  notes: Note[]
  readLater: string[]
  readLaterEntries: Record<string, ItemSnapshot>
  interests: string[]
  bookmarks: Bookmark[]
  habits: Habit[]
  focus: FocusState | null
  sources: SourceMeta[]
  agentInbox: Proposal[]
  types: Record<string, WidgetTypeMeta>
  cols: GridColumns
  layoutSizes?: Record<string, WidgetSize>
  deckIndex: Record<string, number>
  deckFlipped: Record<string, boolean>
  sizesOf: (type: string) => WidgetSize[]
}

export interface WidgetRendererProps<Settings = Record<string, unknown>> {
  widget: WidgetRecord<Settings>
  size: WidgetSize
  settings: Settings
  context: WidgetRenderContext
  onAction: (name: string, body?: Record<string, unknown>) => void
}

export interface WidgetDefinition<Settings = Record<string, unknown>> {
  type: string
  name: string
  desc: string
  priority?: 'P0' | 'P1' | 'P2' | string
  soon?: boolean
  sizes: Partial<Record<WidgetSize, [number, number]>>
  defaultSize: WidgetSize
  actions: string[]
  defaultSettings: () => Settings
  normalizeSettings: (raw: unknown) => Settings
  Component: React.ComponentType<WidgetRendererProps<Settings>>
  computeLayoutMeta?: (props: WidgetRendererProps<Settings>) => WidgetLayoutMeta
}
