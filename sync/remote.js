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
  ERRORS,
  SYNC_PREFIX,
  SyncError,
} from '../core/protocol.js'

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
    this.health = { ok: false, checkedAt: null, error: this.error, hubRole: null, protocolVersion: null }
  }

  /** The freshness of what the panel is looking at, for the "未同步" badge. */
  get status() {
    return {
      role: 'client',
      endpoint: this.sync?.endpoint ?? null,
      device: this.sync?.device ?? null,
      configured: this.ready,
      error: this.error,
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
      this.health = {
        ok: Boolean(result.value?.ok),
        checkedAt: nowIso(),
        error: null,
        hubRole: result.value?.role ?? null,
        protocolVersion: result.value?.protocolVersion ?? null,
        revision: result.value?.dataRevision ?? null,
      }
      if (this.health.hubRole && this.health.hubRole !== 'hub' && this.health.hubRole !== 'standalone') {
        this.health.error = `Hub 报告的角色是 ${this.health.hubRole}`
      }
      return this.health
    } catch (error) {
      this.health = { ok: false, checkedAt: nowIso(), error: String(error?.message ?? error), hubRole: null, protocolVersion: null }
      return this.health
    }
  }

  /**
   * The dashboard, from the Hub.
   *
   * A cache hit inside `cacheMs` is returned with `fromCache: true` — the panel shows it
   * without a spinner, because it already has exactly this data. Beyond that the request is
   * conditional: a 304 refreshes the timestamp without touching the cache contents.
   *
   * When the Hub cannot be reached, a cached snapshot is returned with `stale: true` and the
   * failure attached, so the UI can say so instead of pretending (AC-05). With no cache at
   * all the error propagates: an empty dashboard would be a lie.
   */
  async snapshot(options = {}) {
    const now = Date.now()
    if (!options.force && this.cache.snapshot && now - this.cache.at < this.sync.cacheMs) {
      return { ...this.cache.snapshot, fromCache: true, stale: false, cacheAgeMs: now - this.cache.at }
    }
    try {
      const result = await this.request('GET', '/snapshot', { ifNoneMatch: this.cache.etag, signal: options.signal })
      if (result.notModified && this.cache.snapshot) {
        this.cache.at = now
        if (result.etag) this.cache.etag = result.etag
        return { ...this.cache.snapshot, fromCache: true, stale: false, cacheAgeMs: 0 }
      }
      if (!result.value) throw new SyncError(ERRORS.unavailable, 'Hub 返回了空快照')
      const snapshot = { ...result.value, role: 'client', fromCache: false, stale: false, cacheAgeMs: 0 }
      this.cache = { snapshot, etag: result.etag ?? null, at: now }
      this.health = { ...this.health, ok: true, checkedAt: nowIso(), error: null }
      return snapshot
    } catch (error) {
      this.health = { ...this.health, ok: false, checkedAt: nowIso(), error: String(error?.message ?? error) }
      if (this.cache.snapshot) {
        return {
          ...this.cache.snapshot,
          fromCache: true,
          stale: true,
          cacheAgeMs: now - this.cache.at,
          syncError: String(error?.message ?? error),
          syncErrorCode: error?.code ?? ERRORS.unavailable,
        }
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
    return {
      ready: this.ready,
      role: 'client',
      ownsData: false,
      sources: sources.map((source) => ({
        id: source.id,
        label: source.label,
        about: source.about ?? '',
        suggests: source.suggests ?? null,
        attribution: source.attribution ?? null,
        cadenceMinutes: source.cadenceMinutes ?? null,
        itemCount: 0,
        lastRunAt: null,
        lastResult: null,
        lastError: null,
        failStreak: 0,
        nextDueAt: null,
      })),
      // A Client holds no Items of its own; the Hub's counts arrive through `snapshot()`, which
      // carries a `meta` block for exactly this reason.
      itemCount: 0,
      articleCount: 0,
      unreadCount: 0,
      todayCount: 0,
      starredCount: 0,
      health: { total: sources.length, erroring: 0 },
      runtime: { role: 'client', running: false, lastTickAt: null, runs: 0 },
      sync: this.status,
      generatedAt: nowIso(),
    }
  }

  /** The Agent digest, from the Hub. No cache: freshness is the point of this call. */
  async context(query = {}, options = {}) {
    const params = new URLSearchParams()
    if (query.scope) params.set('scope', String(query.scope).slice(0, 40))
    if (query.limit) params.set('limit', String(Math.min(Math.max(Number(query.limit) || 8, 1), 20)))
    const result = await this.request('GET', `/context?${params.toString()}`, { signal: options.signal })
    return result.value
  }

  /**
   * The single write path.
   *
   * A Client never applies a command locally. The `operationId` is minted here and reused
   * verbatim if the caller retries, so the Hub's idempotency log can answer the second
   * attempt with the first attempt's result (AC-03).
   */
  async execute(command, actor) {
    if (!this.ready) throw new SyncError(ERRORS.unavailable, this.error ?? 'Hub 未配置')
    const operationId = command?.operationId ?? mintOperationId(this.sync.device ?? 'client')
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
      // A business refusal keeps the shape the local route returns, so the Client half did
      // not need two error paths: an `ok:false` result is a toast, not an exception.
      return { ...(value.result ?? {}), ok: false, error: value.error, dataRevision: value.dataRevision }
    }
    // A successful write invalidates the display cache: the next read must come from the Hub.
    this.cache = { snapshot: null, etag: null, at: 0 }
    void actor
    // Unwrap the envelope for the same reason `index.js` does: the browser expects the
    // business result (`{ ok, task }`), not `{ ok, operationId, result }`.
    if (value.result !== undefined) {
      return { ...value.result, dataRevision: value.dataRevision, operationId: value.operationId, ...(value.replayed ? { replayed: true } : {}) }
    }
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