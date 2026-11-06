/**
 * `SooyoService`: the one interface the routes and Agent tools are allowed to call.
 *
 * Two implementations satisfy it, and the caller never learns which one it holds:
 *
 * - `LocalSooyoService` (this file) — the authoritative store, used by `standalone` and `hub`.
 * - `RemoteSooyoService` (`../sync/remote.js`) — a Client's Host-side proxy to a Hub.
 *
 * The interface is deliberately small. `snapshot` / `items` / `meta` are reads; `execute` is
 * the *only* write, and it always carries a `TrustedActor` — an identity the Host established,
 * never one the request body claimed (issue §4.4). Because `execute` is the only write path,
 * the "who may write what" question has exactly one place to answer.
 */

import * as daily from '../daily.js'
import { bumpRevision, readRevision, recordOperation, recover, replayOperation, revisionState, TABLES } from './store.js'
import { checkPrecondition, newOperationId, execute as executeCommand } from './commands.js'
import { ERRORS, SyncError } from './protocol.js'
import { applyProposal, readAgentInbox, rollbackProposal, settleProposal } from '../agent/inbox.js'
import { applyImport } from './migrate.js'

const nowIso = () => new Date().toISOString()

/** Bound what one `/items` response can cost, whatever the caller asks for. */
export const MAX_ITEMS = 500
export const DEFAULT_ITEMS = 60

/**
 * An actor the Host established.
 *
 * `device` is a Hub-issued client identity, `sessionId` the Agent session, or `'local'` for
 * the browser in front of this Host. `access` is `read` or `write`, decided by the Hub's
 * token table — never by anything inside the request body.
 */
export const localActor = (extra = {}) => ({ kind: 'local', device: 'local', access: 'write', ...extra })

/**
 * The authoritative implementation.
 *
 * It holds no cache: reads go straight to the tables, which are synchronous and in memory, so
 * a snapshot is always the state the last durable write left behind. The write queue and the
 * revision live in `core/store.js`; this class only wires them to the command funnel.
 */
export class LocalSooyoService {
  /**
   * @param {{ tables: () => ((name: string) => object), sources: () => object[], queue: object, role: string, device?: string, readers: object }} options
   *   `tables` returns the tables *accessor* (a function of table name), not a table.
   */
  constructor(options) {
    this.getTables = options.tables
    this.getSources = options.sources ?? (() => [])
    this.queue = options.queue
    this.role = options.role ?? 'standalone'
    this.device = options.device ?? 'local'
    /**
     * `items(searchParams)` and `meta()` belong to the Host composition (they read the item
     * store and the Source registry), so `index.js` supplies them instead of this class
     * reaching back into it.
     */
    this.readers = options.readers ?? { items: () => ({ items: [], total: 0, matched: 0 }), meta: () => ({ ready: false }) }
    /**
     * `beginWrite` / `endWrite` bracket a command so every record it writes carries one
     * revision. They live in `index.js` because the stamper needs the open domain.
     */
    this.hooks = options.hooks ?? {}
    /** Set by `index.js` once the domain is open; the funnel refuses writes while it is false. */
    this.ready = false
  }

  get tables() {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    return this.getTables()
  }

  /** The revision a reader may use as an ETag, and the time it was written. */
  state() {
    return this.ready ? revisionState(this.tables) : { revision: 0, changedAt: null, writer: null }
  }

  /**
   * Everything the panel draws, in one response — the model `/sooyo/daily` has always
   * returned, plus the revision fields a Client needs to decide whether it may cache it.
   */
  snapshot() {
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
      // The Agent Inbox travels with the dashboard so every device sees the same proposals
      // and the badge count is derived from one source of truth (issue §6.2).
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

  /** The Agent-facing digest: bounded, with a freshness stamp. See `agent/context.js`. */
  context(query = {}) {
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
    const proposals = boards.agentInbox ?? []
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

  /** One page of Items, whatever the caller asked for — the bounds are applied here. */
  items(query = {}) {
    if (!this.ready) return { items: [], total: 0, matched: 0, pending: true, error: '存储域尚未就绪' }
    const params = new URLSearchParams()
    params.set('limit', String(Math.min(Math.max(Number(query.limit) || DEFAULT_ITEMS, 1), MAX_ITEMS)))
    if (query.kind === 'all') params.set('kind', 'all')
    if (query.source) params.set('source', String(query.source).slice(0, 60))
    if (query.unread === true || query.unread === '1') params.set('unread', '1')
    if (query.starred === true || query.starred === '1') params.set('starred', '1')
    if (query.q) params.set('q', String(query.q).slice(0, 200))
    // The Item listing belongs to the Host composition (it reads the item store and the
    // Source registry), so `index.js` installs the reader rather than the service owning it.
    return this.readers.items(params)
  }

  /** The Source registry with health, as `/sooyo/meta` has always reported it. */
  meta() {
    return this.readers.meta()
  }

  async _executeUnlocked(command, actor) {
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

  /**
   * The single write. The funnel journals it, bumps the revision and records the operation,
   * so every caller — local UI, remote Client, Agent tool — gets the same guarantees.
   */
  async execute(command, actor) {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    if (actor?.access && actor.access !== 'write') {
      throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    }
    // The queue is what makes two concurrent commands from two devices serialize instead of
    // interleaving inside one command's multi-step body (issue §4.3).
    return this.queue.run(() => this._executeUnlocked(command, actor))
  }

  /**
   * Decide and optionally apply an Agent Inbox Proposal atomically inside the write queue.
   *
   * Used by both the local `/sooyo/agent-inbox/decide` route and the Hub's authenticated
   * `POST /sooyo/sync/v1/inbox/decide` endpoint so Client devices can approve/reject Proposals
   * without exposing `proposal.decide` on the generic `/command` funnel or Agent tools.
   */
  async decideProposal(request = {}, actor = localActor({ device: this.device })) {
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
        let rolled
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

      let finalOutcome = { ...decided }
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
            let settled
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
            this.hooks?.beginWrite?.()
            let settled
            try {
              settled = await settleProposal(this.tables, proposal.id, 'failed', String(error?.message ?? error))
              await bumpRevision(this.tables, `proposal:${writer}`)
            } finally {
              this.hooks?.endWrite?.()
            }
            finalOutcome = {
              ok: false,
              proposal: settled ?? proposal,
              error: String(error?.message ?? error),
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

  /**
   * Expire stale pending Proposals inside the write queue with revision stamping.
   */
  async expireProposals(ids = []) {
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

  /**
   * Apply a validated import plan inside the write queue with revision stamping.
   */
  async applyImportPlan(plan, options = {}, actor = localActor({ device: this.device })) {
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

  /** Wait for in-flight writes, so a reader can report the revision it actually sees. */
  async settled() {
    if (this.queue) await this.queue.drain()
    return this.state()
  }

  /**
   * Trim the operations log and finish any journal a crash left behind.
   *
   * It runs *before* `ready` flips to true, so it deliberately bypasses the readiness gate:
   * recovery is what makes the store ready, and gating it on readiness would deadlock startup.
   */
  async recover(log) {
    return recover(this.getTables(), log)
  }
}

/** A Task cut down to what an Agent needs to act on it, with no invented detail. */
const briefTask = (task) => ({
  id: task.id,
  title: String(task.title ?? '').slice(0, 200),
  list: task.list,
  project: task.project ?? null,
  done: Boolean(task.done),
  origin: task.origin?.url ? { title: task.origin.title ?? null, url: task.origin.url } : null,
  revision: Number.isSafeInteger(task.revision) ? task.revision : 0,
})