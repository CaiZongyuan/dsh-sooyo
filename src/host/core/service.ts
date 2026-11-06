/**
 * `SooyoService`: the one interface the routes and Agent tools are allowed to call.
 */

import * as daily from '../domain/daily.ts'
import { bumpRevision, readRevision, recordOperation, recover, replayOperation, revisionState, TABLES, type TableAccessor, type WriteQueue } from './store.ts'
import { checkPrecondition, newOperationId, execute as executeCommand } from '../domain/commands.ts'
import { ERRORS, SyncError } from './protocol.ts'
import { applyProposal, readAgentInbox, rollbackProposal, settleProposal } from '../agent/inbox.ts'
import { applyImport } from './migrate.ts'

const nowIso = (): string => new Date().toISOString()

export const MAX_ITEMS = 500
export const DEFAULT_ITEMS = 60

export const localActor = (extra: Record<string, unknown> = {}) => ({
  kind: 'local',
  device: 'local',
  access: 'write',
  ...extra,
})

export class LocalSooyoService {
  readonly getTables: () => TableAccessor
  readonly getSources: () => Array<Record<string, any>>
  readonly queue: WriteQueue
  readonly role: string
  readonly device: string
  readonly readers: { items: (params: URLSearchParams) => any; meta?: () => any }
  readonly hooks: { beginWrite?: () => void; endWrite?: () => void }
  ready: boolean
  status?: any

  constructor(options: {
    tables: () => TableAccessor
    sources?: () => Array<Record<string, any>>
    queue: WriteQueue
    role?: string
    device?: string
    readers?: { items: (params: URLSearchParams) => any; meta?: () => any }
    hooks?: { beginWrite?: () => void; endWrite?: () => void }
  }) {
    this.getTables = options.tables
    this.getSources = options.sources ?? (() => [])
    this.queue = options.queue
    this.role = options.role ?? 'standalone'
    this.device = options.device ?? 'local'
    this.readers = options.readers ?? { items: () => ({ items: [], total: 0, matched: 0 }), meta: () => ({ ready: false }) }
    this.hooks = options.hooks ?? {}
    this.ready = false
  }

  get tables(): TableAccessor {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    return this.getTables()
  }

  state() {
    return this.ready
      ? revisionState(this.tables)
      : { revision: 0, changedAt: null, writer: null, itemsRevision: 0, itemsUpdatedAt: null }
  }

  snapshot(): any {
    if (!this.ready) {
      return { ready: false, error: '存储域尚未就绪', boards: [], widgets: {}, layouts: {}, tasks: [], sources: [] }
    }
    const snapshot = daily.readDaily(this.tables, this.getSources())
    const state = revisionState(this.tables)
    const overview = this.readers.meta ? this.readers.meta() : null
    return {
      ready: true,
      ...snapshot,
      focus: daily.resolveFocus(snapshot.focus),
      agentInbox: readAgentInbox(this.tables),
      dataRevision: state.revision,
      itemsRevision: state.itemsRevision ?? 0,
      itemsUpdatedAt: state.itemsUpdatedAt ?? null,
      ...(overview
        ? {
            meta: {
              articleCount: overview.articleCount ?? 0,
              itemCount: overview.itemCount ?? 0,
              unreadCount: overview.unreadCount ?? 0,
              todayCount: overview.todayCount ?? 0,
              starredCount: overview.starredCount ?? 0,
              health: overview.health ?? { total: snapshot.sources.length, erroring: 0 },
              itemsUpdatedAt: state.itemsUpdatedAt ?? null,
              generatedAt: nowIso(),
            },
          }
        : {}),
      generatedAt: nowIso(),
      role: this.role,
    }
  }

  context(query: Record<string, any> = {}, _options?: Record<string, any>): any {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    const tables = this.tables
    const boards = daily.readDaily(tables, this.getSources())
    const state = revisionState(tables)
    const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 20)
    const open = boards.tasks.filter((task) => !task.done)
    const today = open.filter((task) => task.list === 'today')
    const inbox = open.filter((task) => task.list === 'inbox')
    const later = open.filter((task) => task.list === 'later')
    const projects = [...new Set(open.map((task) => task.project).filter(Boolean))]
    const proposals = readAgentInbox(tables).filter((p) => p.status === 'pending')
    return {
      ready: true,
      dataRevision: state.revision,
      generatedAt: nowIso(),
      role: this.role,
      counts: {
        tasks: boards.tasks.length,
        open: open.length,
        today: today.length,
        inbox: inbox.length,
        later: later.length,
        done: boards.tasks.filter((task) => task.done).length,
        notes: boards.notes.length,
        readLater: boards.readLater.length,
        boards: boards.boards.length,
        proposals: Array.isArray(proposals) ? proposals.length : 0,
      },
      today: today.slice(0, limit).map(briefTask),
      inbox: inbox.slice(0, limit).map(briefTask),
      later: later.slice(0, limit).map(briefTask),
      projects: projects.slice(0, 10),
      recentNotes: boards.notes.slice(0, Math.min(limit, 5)).map((note) => ({
        id: note.id,
        text: String(note.text ?? '').slice(0, 160),
        createdAt: note.createdAt,
      })),
      activeBoard: boards.active,
      sourceCounts: boards.sources.map((source) => ({ id: source.id, label: source.label })),
    }
  }

  items(query: Record<string, any> = {}, _options?: Record<string, any>): any {
    if (!this.ready) return { items: [], total: 0, matched: 0, pending: true, error: '存储域尚未就绪' }
    const params = new URLSearchParams()
    params.set('limit', String(Math.min(Math.max(Number(query.limit) || DEFAULT_ITEMS, 1), MAX_ITEMS)))
    if (query.kind === 'all') params.set('kind', 'all')
    if (query.source) params.set('source', String(query.source).slice(0, 60))
    if (query.unread === true || query.unread === '1') params.set('unread', '1')
    if (query.starred === true || query.starred === '1') params.set('starred', '1')
    if (query.q) params.set('q', String(query.q).slice(0, 200))
    return this.readers.items(params)
  }

  meta(): any {
    return this.readers.meta ? this.readers.meta() : { ready: this.ready }
  }

  async _executeUnlocked(command: any, actor?: any): Promise<any> {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    if (actor?.access && actor.access !== 'write') {
      throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    }
    const operationId = command?.operationId ?? newOperationId(actor?.device ?? this.device)
    this.hooks?.beginWrite?.()
    try {
      return await executeCommand(this.tables, {
        operationId,
        name: command?.name,
        body: command?.body,
        actor,
        precondition: command?.precondition,
        onKillPoint: command?.onKillPoint,
      })
    } finally {
      this.hooks?.endWrite?.()
    }
  }

  async execute(command: any, actor?: any): Promise<any> {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    if (actor?.access && actor.access !== 'write') {
      throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    }
    return this.queue.run(() => this._executeUnlocked(command, actor))
  }

  async decideProposal(request: any = {}, actor: any = localActor({ device: this.device })): Promise<any> {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    if (actor?.access && actor.access !== 'write') {
      throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    }
    const operationId = request?.operationId ?? newOperationId(actor?.device ?? this.device)
    const writer = actor?.device ?? this.device

    return this.queue.run(async () => {
      const replay = await replayOperation(this.tables, operationId)
      if (replay) {
        return {
          ...(replay.result ?? { ok: true }),
          operationId,
          replayed: true,
          dataRevision: readRevision(this.tables),
        }
      }

      if (request?.precondition) {
        checkPrecondition(this.tables, request.precondition)
      }

      if (request?.decision === 'rollback') {
        this.hooks?.beginWrite?.()
        let rolled: any
        try {
          rolled = await rollbackProposal(this.tables, request?.id)
          if (rolled.ok) {
            await bumpRevision(this.tables, `proposal:rollback:${writer}`)
          }
        } finally {
          this.hooks?.endWrite?.()
        }
        const rev = readRevision(this.tables)
        if (rolled.ok) {
          await recordOperation(this.tables, operationId, 'inbox.decide', rolled, rev, writer)
        }
        return {
          ...rolled,
          operationId,
          dataRevision: rev,
        }
      }

      const decideOpId = `${operationId}-d`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)
      const decidedEnvelope = await this._executeUnlocked(
        {
          operationId: decideOpId,
          name: 'proposal.decide',
          body: { id: request?.id, decision: request?.decision },
        },
        actor,
      )
      const decided = decidedEnvelope?.result ?? decidedEnvelope
      if (!decided?.ok) {
        return {
          ...decided,
          ok: false,
          operationId,
          dataRevision: readRevision(this.tables),
        }
      }

      let finalOutcome: any = { ...decided }
      if (request?.decision === 'approve' && request?.apply !== false) {
        const proposal = this.tables(TABLES.agentInbox).get(String(request?.id ?? ''))
        if (proposal) {
          try {
            const applied = await applyProposal(this.tables, proposal, (cmd) =>
              this._executeUnlocked(cmd, {
                kind: 'proposal',
                device: proposal.id,
                access: 'write',
              }),
            )
            const failed = applied.filter((entry) => !entry.ok)
            this.hooks?.beginWrite?.()
            let settled: any
            try {
              settled = await settleProposal(
                this.tables,
                proposal.id,
                failed.length === 0 ? 'applied' : 'failed',
                failed.length === 0 ? null : failed.map((entry) => entry.error).join('; '),
                applied,
                applied.inverseSteps,
              )
              await bumpRevision(this.tables, `proposal:${writer}`)
            } finally {
              this.hooks?.endWrite?.()
            }
            finalOutcome = {
              ok: failed.length === 0,
              proposal: settled ?? proposal,
              applied: {
                ok: failed.length === 0,
                applied,
                ...(failed.length > 0 ? { failed } : {}),
              },
              ...(failed.length > 0 ? { error: failed.map((entry) => entry.error).join('; ') } : {}),
            }
          } catch (error) {
            const errObj = error as { message?: string } | undefined
            const errMsg = String(errObj?.message ?? error)
            this.hooks?.beginWrite?.()
            let settled: any
            try {
              settled = await settleProposal(this.tables, proposal.id, 'failed', errMsg)
              await bumpRevision(this.tables, `proposal:${writer}`)
            } finally {
              this.hooks?.endWrite?.()
            }
            finalOutcome = {
              ok: false,
              proposal: settled ?? proposal,
              error: errMsg,
            }
          }
        }
      }

      const finalRev = readRevision(this.tables)
      await recordOperation(this.tables, operationId, 'inbox.decide', finalOutcome, finalRev, writer)
      return {
        ...finalOutcome,
        operationId,
        dataRevision: finalRev,
      }
    })
  }

  async expireProposals(ids: string[] = []): Promise<{ expired: number; dataRevision?: number }> {
    if (!this.ready || !Array.isArray(ids) || ids.length === 0) return { expired: 0 }
    return this.queue.run(async () => {
      this.hooks?.beginWrite?.()
      let expired = 0
      try {
        for (const id of ids) {
          const existing = this.tables(TABLES.agentInbox).get(id)
          if (!existing || existing.status !== 'pending') continue
          await this.tables(TABLES.agentInbox).put(id, {
            ...existing,
            status: 'expired',
            expiredAt: nowIso(),
          })
          expired += 1
        }
        if (expired > 0) {
          await bumpRevision(this.tables, 'review:sweep')
        }
      } finally {
        this.hooks?.endWrite?.()
      }
      return { expired, dataRevision: readRevision(this.tables) }
    })
  }

  async applyImportPlan(plan: any, options: any = {}, actor: any = localActor({ device: this.device })): Promise<any> {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    return this.queue.run(async () => {
      this.hooks?.beginWrite?.()
      try {
        const applied = await applyImport(this.tables, plan, options)
        if ((applied.written?.create ?? 0) + (applied.written?.update ?? 0) > 0) {
          await bumpRevision(this.tables, `import:${actor?.device ?? this.device}`)
        }
        return { ...applied, dataRevision: readRevision(this.tables) }
      } finally {
        this.hooks?.endWrite?.()
      }
    })
  }

  async settled() {
    if (this.queue) await this.queue.drain()
    return this.state()
  }

  async recover(log?: (msg: string) => void) {
    return recover(this.getTables(), log)
  }
}

const briefTask = (task: any) => ({
  id: task.id,
  title: String(task.title ?? '').slice(0, 200),
  list: task.list,
  project: task.project ?? null,
  done: Boolean(task.done),
  origin: task.origin?.url ? { title: task.origin.title ?? null, url: task.origin.url } : null,
  revision: Number.isSafeInteger(task.revision) ? Number(task.revision) : 0,
})
