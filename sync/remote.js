/**
 * The Client role: a Host-side proxy to a Hub.
 *
 * Two rules shape this file, both from issue §4.4:
 *
 * 1. **The token never leaves the Host.** It is read from the Loader config or an environment
 *    variable, kept in this module, and sent only on a Host-initiated `fetch`. No route
 *    returns it, no Client field carries it, and it is never embedded in a URL.
 * 2. **A Client holds no authoritative data.** Every read is a Hub read and every write is a
 *    Hub command. What little it caches is a *display* cache with an explicit freshness
 *    stamp, so the UI can say "未同步" instead of showing stale data as if it were current.
 *
 * A request that fails is not silently turned into an empty result: `snapshot()` throws with
 * the Hub's code, and the local route translates that into a 503 the panel renders as an
 * offline state (AC-05).
 */

import {
  DATA_SCHEMA_VERSION,
  ERRORS,
  PROTOCOL_VERSION,
  SYNC_PREFIX,
  SyncError,
} from '../core/protocol.js'
import { deriveEntityId } from '../personal.js'

/** Bound every Hub call: a hung Hub must not hold a page load open. */
const DEFAULT_TIMEOUT_MS = 6000
/** A snapshot is the largest response; anything bigger is a Hub bug, not a big dataset. */
const MAX_BODY_BYTES = 4 * 1024 * 1024
/** How long a snapshot may be served from the display cache before a refetch. */
const DEFAULT_CACHE_MS = 15_000

const nowIso = () => new Date().toISOString()

/**
 * Resolve the `sync` config into a role and, for a Client, a usable endpoint + token.
 *
 * The three constraints the issue names as non-negotiable are enforced here, at startup:
 * a `client` without an endpoint or without a token is an error the operator sees, not a
 * plugin that quietly runs on an empty local store.
 */
export function resolveSyncConfig(config = {}, ctx) {
  const raw = config?.sync ?? {}
  const requested = typeof raw?.role === 'string' ? raw.role : 'standalone'
  const role = ['standalone', 'hub', 'client'].includes(requested) ? requested : 'standalone'
  const device = typeof raw?.device === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(raw.device) ? raw.device : null
  const cacheMs = Number.isFinite(raw?.cacheMs) && raw.cacheMs >= 0 ? raw.cacheMs : DEFAULT_CACHE_MS
  const timeoutMs = Number.isFinite(raw?.timeoutMs) && raw.timeoutMs > 0 ? raw.timeoutMs : DEFAULT_TIMEOUT_MS

  if (role === 'client') {
    const endpoint = normaliseEndpoint(raw?.endpoint)
    const token = resolveToken(raw, ctx)
    if (!endpoint) {
      // Loud, not silent: this string becomes the error every data route reports.
      return {
        role,
        device,
        cacheMs,
        timeoutMs,
        endpoint: null,
        token: null,
        error: 'sync.role=client 需要 sync.endpoint（例如 https://sooyo.example.com）',
      }
    }
    if (!token) {
      return {
        role,
        device,
        cacheMs,
        timeoutMs,
        endpoint,
        token: null,
        error: 'sync.role=client 需要一个令牌：设置 sync.token 或环境变量 SOOYO_SYNC_TOKEN',
      }
    }
    return { role, device, cacheMs, timeoutMs, endpoint, token, error: null }
  }

  if (role === 'hub') {
    /** `tokens` is the Hub's own device table; a Client presents one of these. */
    const tokens = resolveHubTokens(raw, ctx)
    const allowLoopbackOnly = raw?.allowLoopbackOnly !== false
    return { role, device, cacheMs, timeoutMs, tokens, allowLoopbackOnly, error: null }
  }

  return { role: 'standalone', device, cacheMs, timeoutMs, error: null }
}

/** A Hub origin with no trailing slash and no path: every call appends `/sooyo/sync/v1/...`. */
function normaliseEndpoint(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  let parsed
  try {
    parsed = new URL(value.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(parsed.protocol)) return null
  // A path here would produce `/path/sooyo/sync/v1`, which no route serves.
  return `${parsed.protocol}//${parsed.host}`
}

/**
 * The Client's token: config first, then `SOOYO_SYNC_TOKEN`.
 *
 * Config is checked before the environment so a profile can pin one device's credential
 * without every other Host in the same shell inheriting it.
 */
function resolveToken(raw, ctx) {
  if (typeof raw?.token === 'string' && raw.token.trim()) return raw.token.trim()
  const fromEnv = typeof process !== 'undefined' ? process.env?.SOOYO_SYNC_TOKEN : undefined
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  void ctx
  return null
}

/**
 * The Hub's accepted device tokens.
 *
 * Accepted shapes: an array of `{ token, device, access }` objects, an array of bare strings
 * (treated as full-access tokens whose device name is derived), or a single string. A token
 * shorter than 16 characters is refused because a guessable one is worse than none.
 *
 * `access` is `read` or `write`; a read-only token is how a phone gets the dashboard without
 * being able to change every task.
 */
function resolveHubTokens(raw, ctx) {
  const source = raw?.tokens ?? (typeof process !== 'undefined' ? process.env?.SOOYO_SYNC_TOKENS : undefined)
  const list = []
  const push = (token, entry = {}) => {
    if (typeof token !== 'string') return
    const value = token.trim()
    if (value.length < 16) {
      ctx?.logger?.warn?.(`sooyo: ignoring a sync token shorter than 16 characters (${entry.device ?? 'unnamed'})`)
      return
    }
    list.push({
      token: value,
      device: String(entry.device ?? `device-${list.length + 1}`).slice(0, 64),
      access: entry.access === 'read' ? 'read' : 'write',
    })
  }

  if (typeof source === 'string') {
    // A single string may be one token or a comma-separated list, which is what an env var
    // can hold without ceremony.
    for (const part of source.split(',')) push(part, {})
  } else if (Array.isArray(source)) {
    for (const entry of source) {
      if (typeof entry === 'string') push(entry, {})
      else push(entry?.token, entry ?? {})
    }
  }
  return list
}

/**
 * A Client's view of the Hub.
 *
 * The display cache exists so a 2-second poll and a page focus do not each cost a round trip,
 * and so a brief Hub outage shows the last known dashboard with a `stale` flag rather than an
 * empty page. It is explicitly *not* an authoritative store: it is never written to disk and
 * it never answers a write.
 */
export class RemoteSooyoService {
  constructor(sync, options = {}) {
    this.sync = sync
    this.sources = options.sources ?? (() => [])
    this.log = options.log ?? (() => {})
    /** Set true by `index.js` once `resolveSyncConfig` produced a usable endpoint + token. */
    this.ready = Boolean(sync?.endpoint && sync?.token)
    this.role = 'client'
    this.error = sync?.error ?? (this.ready ? null : 'Hub 配置不完整')
    this.cache = { snapshot: null, etag: null, at: 0 }
    this.cacheTables = options.cacheTables ?? null
    this.health = {
      ok: false,
      checkedAt: null,
      error: this.error,
      hubRole: null,
      protocolVersion: null,
      protocol: null,
      dataSchemaVersion: null,
      capabilities: [],
      schemaCompat: 'unknown',
    }
    if (this.cacheTables) {
      this._hydrateFromCacheTables()
    }
  }

  /**
   * Attach the Client's non-authoritative `sooyo_client_cache` tables (`snapshots`, `outbox`,
   * `conflicts`, `ui_preferences`). Never opens or touches the authoritative `sooyo` domain.
   */
  attachCacheTables(cacheTables) {
    this.cacheTables = cacheTables
    this._hydrateFromCacheTables()
  }

  _hydrateFromCacheTables() {
    if (!this.cacheTables) return
    try {
      const latest = this.cacheTables('snapshots')?.get?.('latest')
      if (latest?.snapshot && !this.cache.snapshot) {
        this.cache = {
          snapshot: latest.snapshot,
          etag: latest.etag ?? null,
          at: Number(latest.at) || Date.now(),
        }
      }
    } catch {
      // Ignore cache hydration failures and rely on live Hub fetch.
    }
  }

  outboxList() {
    if (!this.cacheTables) return []
    const rows = []
    try {
      for (const [, entry] of this.cacheTables('outbox').entries()) {
        if (entry?.operationId && (entry.status === 'local_pending' || entry.status === 'sending')) {
          rows.push(entry)
        }
      }
    } catch {
      return []
    }
    rows.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
    return rows
  }

  conflictList() {
    if (!this.cacheTables) return []
    const rows = []
    try {
      for (const [, entry] of this.cacheTables('conflicts').entries()) {
        if (entry?.operationId) rows.push(entry)
      }
    } catch {
      return []
    }
    rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    return rows
  }

  /** The freshness of what the panel is looking at, for the "未同步" badge. */
  get status() {
    const outbox = this.outboxList()
    const conflicts = this.conflictList()
    return {
      role: 'client',
      endpoint: this.sync?.endpoint ?? null,
      device: this.sync?.device ?? null,
      configured: this.ready,
      error: this.error,
      pendingCount: outbox.length,
      conflictCount: conflicts.length,
      cache: {
        have: this.cache.snapshot !== null,
        fetchedAt: this.cache.at ? new Date(this.cache.at).toISOString() : null,
        ageMs: this.cache.at ? Date.now() - this.cache.at : null,
      },
      health: this.health,
    }
  }

  /**
   * One authenticated request to the Hub.
   *
   * `ifNoneMatch` turns a read into a conditional one: the Hub answers 304 and no body, which
   * is the whole reason a visible page can poll every 15 seconds without re-downloading the
   * dashboard (issue §4.2).
   */
  async request(method, path, { body, ifNoneMatch, signal, timeoutMs } = {}) {
    if (!this.ready) throw new SyncError(ERRORS.unavailable, this.error ?? 'Hub 未配置')
    // `endpoint` is a bare origin (`https://hub.example.com`); the plugin's route prefix and the
    // protocol's own version path complete it. Both are added here so a config can never point
    // at `/sooyo/sync/v1` twice or at the wrong prefix.
    const url = `${this.sync.endpoint}/sooyo${SYNC_PREFIX}${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.sync.timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener?.('abort', onAbort, { once: true })

    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${this.sync.token}`,
      'x-sooyo-protocol': '1',
    }
    if (ifNoneMatch) headers['if-none-match'] = ifNoneMatch
    if (body !== undefined) headers['content-type'] = 'application/json'

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: 'error',
      })
      if (response.status === 304) return { notModified: true, etag: response.headers.get('etag') }
      const text = await readBounded(response)
      const parsed = text ? safeParse(text) : null
      if (!response.ok) {
        const code = parsed?.error?.code ?? ERRORS.badRequest
        throw new SyncError(
          Object.values(ERRORS).includes(code) ? code : ERRORS.badRequest,
          parsed?.error?.message ?? `Hub 返回 HTTP ${response.status}`,
          parsed?.error?.details,
        )
      }
      return { value: parsed, etag: response.headers.get('etag') }
    } catch (error) {
      if (error instanceof SyncError) throw error
      // A network failure is a 503-shaped condition, not a bug in the caller's arguments.
      throw new SyncError(
        ERRORS.unavailable,
        `连不上 Hub：${String(error?.message ?? error)}`,
        { endpoint: this.sync.endpoint },
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    }
  }

  /** Health first, so a misconfigured role or a version mismatch is named precisely. */
  async checkHealth(signal) {
    try {
      const result = await this.request('GET', '/health', { signal })
      const val = result.value ?? {}
      const minProto = Number(val?.protocol?.min ?? val?.protocolVersion ?? 1)
      const hubSchema = Number(val?.dataSchemaVersion ?? 1)
      let schemaCompat = 'compatible'
      if (minProto > PROTOCOL_VERSION) schemaCompat = 'incompatible_protocol'
      else if (hubSchema > DATA_SCHEMA_VERSION) schemaCompat = 'newer_hub_schema'

      this.health = {
        ok: Boolean(val?.ok),
        checkedAt: nowIso(),
        error: null,
        hubRole: val?.role ?? null,
        protocolVersion: val?.protocolVersion ?? null,
        protocol: val?.protocol ?? { min: val?.protocolVersion ?? 1, max: val?.protocolVersion ?? 1 },
        dataSchemaVersion: hubSchema,
        capabilities: Array.isArray(val?.capabilities) ? val.capabilities : [],
        schemaCompat,
        revision: val?.dataRevision ?? null,
      }
      if (this.health.hubRole && this.health.hubRole !== 'hub' && this.health.hubRole !== 'standalone') {
        this.health.error = `Hub 报告的角色是 ${this.health.hubRole}`
      }
      return this.health
    } catch (error) {
      this.health = {
        ok: false,
        checkedAt: nowIso(),
        error: String(error?.message ?? error),
        hubRole: null,
        protocolVersion: null,
        protocol: null,
        dataSchemaVersion: null,
        capabilities: [],
        schemaCompat: 'unknown',
      }
      return this.health
    }
  }

  /**
   * Replay any durable Outbox entries in FIFO order against the Hub.
   *
   * A `409 conflict` quarantines that specific entry into `conflicts` and continues flushing
   * subsequent independent entries so a single stale edit never blocks the entire queue.
   */
  async flushOutbox() {
    if (!this.cacheTables || !this.ready) return { flushed: 0, conflicts: 0, pending: 0 }
    const outboxTable = this.cacheTables('outbox')
    const conflictsTable = this.cacheTables('conflicts')
    const queue = this.outboxList()
    let flushed = 0
    let conflicts = 0

    for (const entry of queue) {
      await outboxTable.put(entry.operationId, { ...entry, status: 'sending', lastAttemptAt: nowIso() })
      try {
        const result = await this.request('POST', '/command', {
          body: {
            protocolVersion: 1,
            operationId: entry.operationId,
            name: entry.name,
            body: entry.body ?? {},
            ...(entry.precondition ? { precondition: entry.precondition } : {}),
          },
        })
        const value = result.value ?? {}
        await outboxTable.delete(entry.operationId)
        if (value.ok === false) {
          await conflictsTable.put(entry.operationId, {
            ...entry,
            status: 'conflict',
            error: value.error ?? '命令被 Hub 拒绝',
            failedAt: nowIso(),
          })
          conflicts += 1
        } else {
          flushed += 1
        }
      } catch (error) {
        if (error instanceof SyncError && error.code === ERRORS.conflict) {
          await outboxTable.delete(entry.operationId)
          await conflictsTable.put(entry.operationId, {
            ...entry,
            status: 'conflict',
            error: error.message,
            details: error.details ?? null,
            failedAt: nowIso(),
          })
          conflicts += 1
          continue
        }
        await outboxTable.put(entry.operationId, {
          ...entry,
          status: 'local_pending',
          attempts: (entry.attempts ?? 1) + 1,
          lastError: String(error?.message ?? error),
        })
        break
      }
    }
    if (flushed > 0) {
      this.cache = { ...this.cache, etag: null, at: 0 }
    }
    return { flushed, conflicts, pending: this.outboxList().length }
  }

  /**
   * Resolve a quarantined conflict in `sooyo_client_cache/conflicts`.
   * - `action === 'discard'`: delete the conflict record.
   * - `action === 'retry'`: re-enqueue into `outbox` with updated expected revision and flush.
   */
  async resolveConflict(input, actionArg = 'discard') {
    if (!this.cacheTables) return { ok: false, error: '未启用本地缓存域' }
    const operationId = typeof input === 'object' && input !== null ? input.operationId : input
    const action = typeof input === 'object' && input !== null ? (input.action ?? actionArg) : actionArg
    const conflictsTable = this.cacheTables('conflicts')
    const entry = conflictsTable.get(String(operationId ?? ''))
    if (!entry) return { ok: false, error: '没有找到这条冲突记录' }
    await conflictsTable.delete(entry.operationId)
    if (action === 'retry') {
      const updatedPrecondition = entry.precondition && Number.isSafeInteger(entry.details?.revision)
        ? { ...entry.precondition, revision: entry.details.revision }
        : entry.precondition
      await this.cacheTables('outbox').put(entry.operationId, {
        ...entry,
        precondition: updatedPrecondition,
        status: 'local_pending',
        attempts: (entry.attempts ?? 1) + 1,
      })
      const flushResult = await this.flushOutbox()
      return { ok: true, action: 'retry', ...flushResult }
    }
    return { ok: true, action: 'discard', operationId: entry.operationId }
  }

  _withSyncState(snap, extra = {}) {
    const pendingCount = this.outboxList().length
    const conflicts = this.conflictList()
    return {
      ...snap,
      ...extra,
      pendingCount,
      conflictCount: conflicts.length,
      ...(conflicts.length > 0 ? { conflicts } : {}),
    }
  }

  /**
   * The dashboard, from the Hub (with durable Replica & Outbox support when `cacheTables` is attached).
   */
  async snapshot(options = {}) {
    const now = Date.now()
    if (!options.force && this.cache.snapshot && now - this.cache.at < this.sync.cacheMs && this.outboxList().length === 0) {
      return this._withSyncState(this.cache.snapshot, { fromCache: true, stale: false, cacheAgeMs: now - this.cache.at })
    }
    try {
      if (this.outboxList().length > 0) {
        await this.flushOutbox()
      }
      const result = await this.request('GET', '/snapshot', { ifNoneMatch: this.cache.etag, signal: options.signal })
      if (result.notModified && this.cache.snapshot) {
        this.cache.at = now
        if (result.etag) this.cache.etag = result.etag
        if (this.cacheTables) {
          await this.cacheTables('snapshots').put('latest', {
            id: 'latest',
            snapshot: this.cache.snapshot,
            etag: this.cache.etag,
            at: now,
          })
        }
        return this._withSyncState(this.cache.snapshot, { fromCache: true, stale: false, cacheAgeMs: 0 })
      }
      if (!result.value) throw new SyncError(ERRORS.unavailable, 'Hub 返回了空快照')
      const snapshot = { ...result.value, role: 'client', fromCache: false, stale: false, cacheAgeMs: 0 }
      this.cache = { snapshot, etag: result.etag ?? null, at: now }
      if (this.cacheTables) {
        await this.cacheTables('snapshots').put('latest', {
          id: 'latest',
          snapshot,
          etag: this.cache.etag,
          at: now,
        })
      }
      this.health = { ...this.health, ok: true, checkedAt: nowIso(), error: null }
      return this._withSyncState(snapshot)
    } catch (error) {
      this.health = { ...this.health, ok: false, checkedAt: nowIso(), error: String(error?.message ?? error) }
      if (this.cache.snapshot) {
        return this._withSyncState(this.cache.snapshot, {
          fromCache: true,
          stale: true,
          cacheAgeMs: now - this.cache.at,
          syncError: String(error?.message ?? error),
          syncErrorCode: error?.code ?? ERRORS.unavailable,
        })
      }
      throw error
    }
  }

  /** A bounded Item page, always fetched: only the dashboard is worth caching. */
  async items(query = {}, options = {}) {
    if (!this.ready) {
      return { items: [], total: 0, matched: 0, pending: true, error: this.error, stale: true }
    }
    const params = new URLSearchParams()
    params.set('limit', String(Math.min(Math.max(Number(query.limit) || 60, 1), 500)))
    if (query.kind === 'all') params.set('kind', 'all')
    if (query.source) params.set('source', String(query.source).slice(0, 60))
    if (query.unread === true || query.unread === '1') params.set('unread', '1')
    if (query.starred === true || query.starred === '1') params.set('starred', '1')
    if (query.q) params.set('q', String(query.q).slice(0, 200))
    try {
      const result = await this.request('GET', `/items?${params.toString()}`, { signal: options.signal })
      return result.value ?? { items: [], total: 0, matched: 0 }
    } catch (error) {
      return {
        items: [],
        total: 0,
        matched: 0,
        stale: true,
        error: String(error?.message ?? error),
        errorCode: error?.code ?? ERRORS.unavailable,
      }
    }
  }

  /**
   * The Source registry a Client shows.
   *
   * It names the same Sources but fetches none, so every health/count field is either `0` or
   * `null` — with `ownsData: false` saying why. Returning `undefined` for `itemCount` (the first
   * version did) made the panel's "no Items here" state indistinguishable from a broken read.
   */
  meta() {
    const sources = this.sources()
    const cachedSnap = this.cache.snapshot
    const snapSourcesById = new Map((cachedSnap?.sources ?? []).map((entry) => [entry.id, entry]))
    const snapMeta = cachedSnap?.meta ?? null
    const mergedSources = sources.map((source) => {
      const fromHub = snapSourcesById.get(source.id)
      return {
        id: source.id,
        label: source.label,
        about: source.about ?? '',
        suggests: source.suggests ?? null,
        attribution: source.attribution ?? null,
        cadenceMinutes: source.cadenceMinutes ?? null,
        itemCount: fromHub?.itemCount ?? 0,
        lastRunAt: fromHub?.lastRunAt ?? null,
        lastResult: fromHub?.lastResult ?? null,
        lastError: fromHub?.lastError ?? null,
        failStreak: fromHub?.failStreak ?? 0,
        nextDueAt: fromHub?.nextDueAt ?? null,
      }
    })
    const erroring = snapMeta?.health?.erroring ?? mergedSources.filter((entry) => Boolean(entry.lastError)).length
    return {
      ready: this.ready,
      role: 'client',
      ownsData: false,
      sources: mergedSources,
      // A Client owns 0 local Items (`AC-10`); Hub item counts travel under `hubMeta` and `snapshot().meta`.
      itemCount: 0,
      articleCount: 0,
      unreadCount: 0,
      todayCount: 0,
      starredCount: 0,
      ...(snapMeta ? { hubMeta: snapMeta } : {}),
      health: { total: mergedSources.length, erroring },
      runtime: { role: 'client', running: false, lastTickAt: null, runs: 0 },
      sync: this.status,
      generatedAt: nowIso(),
    }
  }

  /** The Agent digest, from the Hub (falling back to a stale summary if offline with a Replica). */
  async context(query = {}, options = {}) {
    const params = new URLSearchParams()
    if (query.scope) params.set('scope', String(query.scope).slice(0, 40))
    if (query.limit) params.set('limit', String(Math.min(Math.max(Number(query.limit) || 8, 1), 20)))
    try {
      const result = await this.request('GET', `/context?${params.toString()}`, { signal: options.signal })
      return {
        ...result.value,
        stale: false,
        pendingCount: this.outboxList().length,
        conflictCount: this.conflictList().length,
      }
    } catch (error) {
      if (this.cache.snapshot) {
        const snap = this.cache.snapshot
        const open = (snap.tasks ?? []).filter((t) => !t.done)
        return {
          ready: true,
          stale: true,
          pendingCount: this.outboxList().length,
          conflictCount: this.conflictList().length,
          dataRevision: snap.dataRevision ?? 0,
          generatedAt: snap.generatedAt ?? nowIso(),
          role: 'client',
          counts: {
            tasks: (snap.tasks ?? []).length,
            open: open.length,
            today: open.filter((t) => t.list === 'today').length,
            inbox: open.filter((t) => t.list === 'inbox').length,
            later: open.filter((t) => t.list === 'later').length,
            done: (snap.tasks ?? []).filter((t) => t.done).length,
            notes: (snap.notes ?? []).length,
            readLater: (snap.readLater ?? []).length,
            boards: (snap.boards ?? []).length,
            proposals: (snap.agentInbox ?? []).filter((p) => p.status === 'pending').length,
          },
          today: open.filter((t) => t.list === 'today').slice(0, 8),
          inbox: open.filter((t) => t.list === 'inbox').slice(0, 8),
          later: open.filter((t) => t.list === 'later').slice(0, 8),
          recentNotes: (snap.notes ?? []).slice(0, 5),
        }
      }
      throw error
    }
  }

  _applyOptimisticOutboxProjection(name, body, operationId) {
    if (!this.cache.snapshot) return null
    const snap = JSON.parse(JSON.stringify(this.cache.snapshot))
    let optimisticResult = null
    if (name === 'task.add' || (name === 'capture' && !/^#note\s*/i.test(String(body?.text ?? '')))) {
      const title = String(body?.title ?? body?.text ?? '').trim()
      const id = deriveEntityId('t', operationId, 0)
      const task = {
        id,
        title,
        list: body?.list ?? 'inbox',
        project: body?.project ?? null,
        done: false,
        createdAt: nowIso(),
        pendingSync: true,
      }
      snap.tasks = [...(snap.tasks ?? []).filter((t) => t.id !== id), task]
      optimisticResult = { ok: true, task }
    } else if (name === 'note.add' || (name === 'capture' && /^#note\s*/i.test(String(body?.text ?? '')))) {
      const text = String(body?.text ?? '').replace(/^#note\s*/i, '').trim()
      const id = deriveEntityId('n', operationId, 0)
      const note = { id, text, createdAt: nowIso(), pendingSync: true }
      snap.notes = [note, ...(snap.notes ?? []).filter((n) => n.id !== id)]
      optimisticResult = { ok: true, note }
    } else if (name === 'task.update' && body?.id) {
      snap.tasks = (snap.tasks ?? []).map((t) => (t.id === body.id ? { ...t, ...body, pendingSync: true } : t))
      const updated = (snap.tasks ?? []).find((t) => t.id === body.id)
      optimisticResult = { ok: true, task: updated }
    }
    this.cache.snapshot = snap
    if (this.cacheTables) {
      void this.cacheTables('snapshots').put('latest', {
        id: 'latest',
        snapshot: snap,
        etag: this.cache.etag,
        at: this.cache.at || Date.now(),
      })
    }
    return optimisticResult
  }

  /**
   * The single write path.
   *
   * When `this.cacheTables` is attached (`sooyo_client_cache`) and the Hub is temporarily
   * unreachable (`ERRORS.unavailable`), the write is persisted in `outbox` with its stable
   * `operationId` and replayed in FIFO order when connectivity returns.
   */
  async execute(command, actor) {
    if (!this.ready) throw new SyncError(ERRORS.unavailable, this.error ?? 'Hub 未配置')
    const operationId = command?.operationId ?? mintOperationId(this.sync.device ?? 'client')
    if (this.cacheTables && this.outboxList().length > 0) {
      await this.flushOutbox()
    }
    try {
      const result = await this.request('POST', '/command', {
        body: {
          protocolVersion: 1,
          operationId,
          name: command?.name,
          body: command?.body ?? {},
          ...(command?.precondition ? { precondition: command.precondition } : {}),
        },
        signal: command?.signal,
      })
      const value = result.value ?? {}
      if (value.ok === false) {
        return { ...(value.result ?? {}), ok: false, error: value.error, dataRevision: value.dataRevision }
      }
      if (this.cacheTables && this.cacheTables('outbox').get(operationId)) {
        await this.cacheTables('outbox').delete(operationId)
      }
      // A successful write invalidates the display cache: the next read must come from the Hub.
      this.cache = { snapshot: null, etag: null, at: 0 }
      void actor
      if (value.result !== undefined) {
        return { ...value.result, dataRevision: value.dataRevision, operationId: value.operationId, ...(value.replayed ? { replayed: true } : {}) }
      }
      return value
    } catch (error) {
      if (error instanceof SyncError && error.code === ERRORS.conflict && this.cacheTables) {
        await this.cacheTables('conflicts').put(operationId, {
          id: operationId,
          operationId,
          name: command?.name,
          body: command?.body ?? {},
          precondition: command?.precondition ?? null,
          status: 'conflict',
          error: error.message,
          details: error.details ?? null,
          createdAt: nowIso(),
        })
      }
      if (
        error instanceof SyncError &&
        error.code === ERRORS.unavailable &&
        this.cacheTables &&
        command?.queueOffline !== false
      ) {
        const entry = {
          id: operationId,
          operationId,
          name: command?.name,
          body: command?.body ?? {},
          precondition: command?.precondition ?? null,
          status: 'local_pending',
          createdAt: nowIso(),
          attempts: 1,
          lastError: error.message,
        }
        await this.cacheTables('outbox').put(operationId, entry)
        const optimistic = this._applyOptimisticOutboxProjection(command?.name, command?.body ?? {}, operationId)
        return {
          ok: true,
          queued: true,
          status: 'local_pending',
          operationId,
          dataRevision: this.cache.snapshot?.dataRevision ?? 0,
          ...(optimistic ?? {}),
        }
      }
      throw error
    }
  }

  /**
   * Forward a human decision on an Agent Inbox Proposal to the Hub's dedicated `/inbox/decide`
   * endpoint so Client devices can approve/reject Proposals without exposing `proposal.decide`
   * on the generic `/command` funnel.
   */
  async decideProposal(request = {}, actor) {
    if (!this.ready) throw new SyncError(ERRORS.unavailable, this.error ?? 'Hub 未配置')
    const operationId = request?.operationId ?? mintOperationId(this.sync.device ?? 'client')
    const result = await this.request('POST', '/inbox/decide', {
      body: {
        protocolVersion: 1,
        operationId,
        id: request?.id,
        decision: request?.decision,
        apply: request?.apply,
        ...(request?.precondition ? { precondition: request.precondition } : {}),
      },
      signal: request?.signal,
    })
    const value = result.value ?? {}
    if (value.ok !== false) {
      this.cache = { snapshot: null, etag: null, at: 0 }
    }
    void actor
    return value
  }

  /** A Client has nothing to recover: it owns no journal. Present for interface symmetry. */
  async recover() {
    return { checked: 0, completed: 0, abandoned: 0, pruned: 0, errors: [] }
  }

  async settled() {
    return { revision: this.cache.snapshot?.dataRevision ?? 0, changedAt: null, writer: null }
  }
}

/** Mint an operation id the Hub will accept: path-safe, unique per attempt. */
export function mintOperationId(device = 'client') {
  const stamp = Date.now().toString(36)
  const noise = Math.random().toString(36).slice(2, 10)
  return `${String(device).replace(/[^a-zA-Z0-9_-]/g, '-')}-${stamp}${noise}`.slice(0, 120)
}

/** Read a response body with a hard ceiling, so a hostile or broken Hub cannot exhaust memory. */
async function readBounded(response) {
  const reader = response.body?.getReader?.()
  if (!reader) return response.text()
  const decoder = new TextDecoder()
  let text = ''
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {})
        throw new SyncError(ERRORS.tooLarge, 'Hub 响应过大')
      }
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return text + decoder.decode()
}

const safeParse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}