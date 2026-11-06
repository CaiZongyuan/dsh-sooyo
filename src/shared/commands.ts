import type { Precondition } from './domain.ts'

export type CommandPrecondition = Precondition

export type CommandName =
  | 'board.active'
  | 'board.create'
  | 'board.rename'
  | 'board.remove'
  | 'widget.add'
  | 'widget.update'
  | 'widget.resize'
  | 'widget.duplicate'
  | 'widget.remove'
  | 'layout.set'
  | 'task.add'
  | 'task.fromItem'
  | 'task.update'
  | 'task.remove'
  | 'capture'
  | 'note.add'
  | 'note.remove'
  | 'readlater.set'
  | 'interests.set'
  | 'bookmarks.set'
  | 'habit.tick'
  | 'focus.set'
  | 'bookmark.add'
  | 'bookmark.remove'
  | 'item.state'
  | 'proposal.create'
  | 'proposal.decide'

export interface CommandActor {
  device?: string
  access?: 'read' | 'write'
  local?: boolean
}

export interface CommandEnvelope<TBody = Record<string, unknown>> {
  protocolVersion?: number
  operationId?: string
  name: CommandName | string
  body?: TBody
  precondition?: Precondition | null
  actor?: CommandActor
  onKillPoint?: (point: 'after-intent-pending' | 'mid-step' | 'after-steps-before-bump' | 'after-bump-before-commit') => void
}

export interface CommandErrorDetail {
  code: string
  message: string
  status?: number
  details?: Record<string, unknown>
}

export interface CommandResult<TResult = Record<string, unknown>> {
  ok: boolean
  status: number
  dataRevision?: number
  replayed?: boolean
  queued?: boolean
  result?: TResult
  error?: CommandErrorDetail
}

export interface IntentStep {
  table: string
  op: 'put' | 'delete'
  key: string
  value?: Record<string, unknown>
  stamp?: boolean
}

export interface IntentRecord {
  id?: string
  operationId: string
  name: string
  actor: string
  status: 'pending' | 'committed'
  reservedRevision: number
  revision?: number
  steps: IntentStep[]
  result: Record<string, unknown>
  createdAt: string
  completedAt?: string
}
