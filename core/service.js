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
import { recover, revisionState } from './store.js'
import { newOperationId, execute as executeCommand } from './commands.js'
import { ERRORS, SyncError } from './protocol.js'
import { readAgentInbox } from '../agent/inbox.js'

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
    return {
      ready: true,
      ...snapshot,
      focus: daily.resolveFocus(snapshot.focus),
      // The Agent Inbox travels with the dashboard so every device sees the same proposals
      // and the badge count is derived from one source of truth (issue §6.2).
      agentInbox: readAgentInbox(this.tables),
      dataRevision: state.revision,
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

  /**
   * The single write. The funnel journals it, bumps the revision and records the operation,
   * so every caller — local UI, remote Client, Agent tool — gets the same guarantees.
   */
  async execute(command, actor) {
    if (!this.ready) throw new SyncError(ERRORS.notReady, '存储域尚未就绪')
    if (actor?.access && actor.access !== 'write') {
      throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    }
    const operationId = command?.operationId ?? newOperationId(actor?.device ?? this.device)
    // The queue is what makes two concurrent commands from two devices serialize instead of
    // interleaving inside one command's multi-step body (issue §4.3).
    return this.queue.run(async () => {
      // Reserve the revision the records this command writes will carry. It is opened and
      // closed around the whole command so a business function that writes three records
      // stamps all three identically — and it is cleared in `finally` so a refusal does not
      // leak a reserved number into the next command.
      this.hooks?.beginWrite?.()
      try {
        return await executeCommand(this.tables, {
          operationId,
          name: command?.name,
          body: command?.body,
          actor,
          precondition: command?.precondition,
        })
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