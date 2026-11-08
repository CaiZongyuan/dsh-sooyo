export type WidgetSize = 'S' | 'M' | 'L' | 'Wide' | 'Tall' | 'XL'

export type KnownWidgetType =
  | 'task'
  | 'subscription'
  | 'notes'
  | 'capture'
  | 'bookmarks'
  | 'project'
  | 'readlater'
  | 'habit'
  | 'focus'
  | 'agent-inbox'
  | 'agentInbox'
  | 'calendar'
  | 'weather'
  | 'briefing'
  | 'embed'

export type WidgetType = KnownWidgetType | (string & {})

export type BreakpointCols = 12 | 6 | 4
export type GridColumns = BreakpointCols

export type GridFootprint = readonly [number, number]

export interface Board {
  id: string
  name: string
  icon?: string
  revision?: number
  updatedAt?: string
}

export interface TaskWidgetSettings {
  list?: TaskListName
  project?: string | null
  showCompleted?: boolean
  [key: string]: unknown
}

export interface SubscriptionWidgetSettings {
  sources?: string[]
  pres?: string
  sort?: 'match' | 'new' | 'score' | 'rank' | string
  cat?: string | null
  deck?: boolean
  topic?: boolean
  group?: string | null
  kind?: string | null
  [key: string]: unknown
}

export type CaptureWidgetSettings = Record<string, unknown>
export type NoteWidgetSettings = Record<string, unknown>
export type BookmarksWidgetSettings = Record<string, unknown>
export type ProjectWidgetSettings = Record<string, unknown>
export type ReadLaterWidgetSettings = Record<string, unknown>
export type HabitWidgetSettings = Record<string, unknown>
export type FocusWidgetSettings = Record<string, unknown>
export type AgentInboxWidgetSettings = Record<string, unknown>

export interface WidgetRecord<Settings = Record<string, any>> {
  id: string
  type: WidgetType
  size?: WidgetSize
  title?: string
  settings: Settings
  revision?: number
  updatedAt?: string
  [key: string]: unknown
}

export interface LayoutPlacement {
  id: string
  size: WidgetSize
  col?: number
  row?: number
}

export type LayoutEntry = LayoutPlacement

export interface PackedCell {
  id: string
  size: WidgetSize
  col: number
  row: number
  w: number
  h: number
  widget: WidgetRecord
}

export type TaskListName = 'inbox' | 'today' | 'later'
export type TaskList = TaskListName
export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskSubtask {
  id: string
  title: string
  done: boolean
}

export interface TaskOrigin {
  itemId?: string | null
  title?: string | null
  url?: string | null
  sourceId?: string | null
  source?: string | null
}

export interface Task {
  id: string
  title: string
  list: TaskListName
  done: boolean
  due: string | null
  priority?: TaskPriority | null
  note?: string | null
  subtasks?: TaskSubtask[]
  project: string | null
  origin: TaskOrigin | null
  createdAt: string
  completedAt?: string | null
  revision?: number
  updatedAt?: string
}

export type CollectionKind = 'github' | 'x' | 'web' | 'image' | 'music' | 'video' | 'article'
export type ContentStatus = 'inbox' | 'curated' | 'archived'

export interface CollectionMeta {
  stars?: number
  language?: string
  author?: string
  duration?: string
  artist?: string
  w?: number
  h?: number
  [key: string]: unknown
}

export interface Note {
  id: string
  title?: string | null
  text: string
  tags: string[]
  externalUrl?: string | null
  status?: ContentStatus
  pinned?: boolean
  origin: TaskOrigin | null
  createdAt: string
  revision?: number
  updatedAt?: string
}

export interface RetrospectiveRecord {
  key: string
  period: 'day' | 'week' | 'month'
  highlights: string
  blockers: string
  nextFocus: string
  updatedAt: string
}

export interface ItemMetrics {
  rank?: number
  hotValue?: number
  views?: number
  likes?: number
  upvotes?: number
  comments?: number
  signalCount?: number
  stars?: number
  [key: string]: number | undefined
}

export interface ItemSnapshot {
  id: string
  sourceId?: string | null
  sourceLabel?: string | null
  title: string
  url: string
  publishedAt?: string | null
  summary?: string
  tldr?: string | null
  reason?: string | null
  origin?: string | null
  category?: string | null
  kind?: CollectionKind | string | null
  status?: ContentStatus
  tags?: string[]
  externalUrl?: string | null
  meta?: CollectionMeta | null
  thumbnail?: string | null
  cover?: string | null
  savedAt?: string
  state?: ItemState
  metrics?: ItemMetrics | null
}

export interface ItemState {
  seen?: boolean
  starred?: boolean
  seenAt?: string
  starredAt?: string
  snapshot?: ItemSnapshot | null
  revision?: number
  updatedAt?: string
}

export interface Item {
  id: string
  sourceId?: string | null
  sourceLabel?: string | null
  sourceGroup?: string
  itemKind?: 'article' | 'rank' | string | null
  kind?: 'short' | 'episode' | string | null
  nativeId?: string
  title: string
  url: string
  altUrl?: string | null
  project?: string | null
  publishedAt?: string | null
  fetchedAt?: string
  summary?: string
  description?: string | null
  tldr?: string | null
  reason?: string | null
  keywords?: string[]
  tags?: string[]
  authorCount?: number | null
  author?: string | null
  origin?: string | null
  category?: string | null
  score?: number | null
  thumbnail?: string | null
  thumbnailCheckedAt?: string | null
  cover?: string | null
  metrics?: ItemMetrics | null
  state?: ItemState
}

export type FeedItem = Item

export interface SourceSuggests {
  pres: string
  name?: string
}

export interface SourceStateRecord {
  lastAttemptAt?: string
  lastSuccessAt?: string | null
  lastStatus?: string
  lastError?: string | null
  etag?: string | null
  lastModified?: string | null
  lastCount?: number
  totalStored?: number
}

export interface SourceMeta {
  id: string
  label: string
  group: string
  itemKind: string
  homepage?: string
  description?: string
  defaultLimit?: number
  suggests?: SourceSuggests
  state?: SourceStateRecord | null
  lastError?: string | null
  count?: number
}

export interface Habit {
  id: string
  name: string
  target: string
  streak: number
  week: number[]
  lastTickDate?: string | null
}

export interface FocusState {
  total: number
  left: number
  sessions: number
  task?: string | null
  minutes?: number
  running: boolean
  remainingSec?: number
  deadline?: number | null
  sessionsToday?: number
  totalMinutesToday?: number
  sessionDay?: string
}

export interface Bookmark {
  id?: string
  name: string
  label?: string
  url: string
  group?: string
  tone?: string
}

export interface ProjectSummary {
  id?: string
  name: string
  tone?: string
  lead?: string
  due?: string
  total: number
  done: number
  pct: number
  open: number
  next?: string | null
}

export type PreconditionEntity =
  | 'board'
  | 'widget'
  | 'task'
  | 'note'
  | 'readLater'
  | 'proposal'
  | 'itemState'
  | 'layout'
  | 'settings'

export interface Precondition {
  entity: PreconditionEntity | string
  id: string
  revision: number
}

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'expired'
  | 'failed'
  | 'rolled_back'

export interface ProposalOperation {
  name: string
  body: Record<string, unknown>
  precondition?: Precondition | null
}

export interface ProposalDiffEntry {
  opIndex?: number
  op?: string
  name?: string
  summary?: string
  entity?: string
  targetId?: string
  before: unknown
  after: unknown
}

export interface ProposalPreview {
  generatedAt?: string
  baseRevision?: number
  diff?: ProposalDiffEntry[]
  diffs?: ProposalDiffEntry[]
}

export interface InverseStep {
  table: string
  key: string
  before: unknown
}

export interface Proposal {
  id: string
  status: ProposalStatus
  reason: string
  operations: ProposalOperation[]
  evidenceRefs: string[]
  createdAt: string
  expiresAt: string
  decidedAt?: string | null
  appliedAt?: string | null
  rolledBackAt?: string | null
  error?: string | null
  preview?: ProposalPreview | null
  basePreconditions?: Precondition[]
  inverseSteps?: InverseStep[]
  revision?: number
  updatedAt?: string
}

export interface OutboxEntry {
  operationId: string
  name: string
  body: Record<string, unknown>
  precondition?: Precondition | null
  createdAt: string
  attempts: number
  lastError?: string | null
}

export interface ConflictEntry {
  operationId: string
  name: string
  body: Record<string, unknown>
  precondition?: Precondition | null
  conflict: Record<string, unknown>
  detectedAt: string
  status: 'quarantined' | 'resolved'
}

export interface WidgetTypeMeta {
  type?: string
  name: string
  desc?: string
  blurb?: string
  category?: string
  accent?: string
  icon?: string
  soon?: boolean
  defaultSize?: WidgetSize
  sizes: Record<string, [number, number]>
  defaults?: Record<string, unknown>
  actions?: string[]
  acts?: string
}

export interface DailySnapshot {
  ready: boolean
  role?: 'standalone' | 'hub' | 'client'
  stale?: boolean
  syncError?: string | null
  dataRevision: number
  itemsUpdatedAt?: string | null
  generatedAt?: string
  active: string
  boards: Board[]
  widgets: Record<string, WidgetRecord>
  layouts: Record<string, Record<number, LayoutPlacement[]>>
  layoutRevisions?: Record<string, any>
  settingsRevisions?: Record<string, number>
  tasks: Task[]
  notes: Note[]
  readLater: string[]
  readLaterEntries?: Record<string, ItemSnapshot & { revision?: number; savedAt?: string }>
  interests: string[]
  habits: Habit[]
  focus: FocusState
  bookmarks: Bookmark[]
  retros?: Record<string, RetrospectiveRecord>
  projects?: ProjectSummary[]
  sources?: SourceMeta[]
  agentInbox: Proposal[]
  types: Record<string, WidgetTypeMeta>
  outboxCount?: number
  conflictCount?: number
  conflicts?: ConflictEntry[]
}
