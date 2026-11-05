/**
 * The Hub's private sync API: `/sooyo/sync/v1/*`.
 *
 * This is the only route family a remote device may reach, and authentication happens
 * **before** any read or write — including before the request body is parsed. The legacy
 * local routes keep their own `isLoopback` guard in `index.js`; dropping that guard is what
 * would turn the whole DSH management UI into a public write surface (issue §4.4).
 *
 * The API is deliberately small and shallow: five endpoints, one command funnel, no
 * client-controlled SQL, no arbitrary table names.
 *
 * | method + path | purpose |
 * |---|---|
 * | `GET  /health`    | version, readiness, the Hub's role — no data |
 * | `GET  /snapshot`  | the dashboard, conditional via `ETag` |
 * | `GET  /items`     | one bounded Item page |
 * | `GET  /context`   | the bounded Agent digest |
 * | `POST /command`   | the single write funnel |
 */

import { PROTOCOL_VERSION, ERRORS, LOCAL_ONLY, SYNC_PREFIX, SyncError, STATUS_OF } from '../core/protocol.js'
import { checkPrecondition } from '../core/commands.js'
import { readRevision } from '../core/store.js'

/** The routes a Client may call. Anything else under the prefix is a 404. */
const ROUTES = new Set(['/health', '/snapshot', '/items', '/context', '/command'])

/** A simple token-bucket limiter, one per device, so one broken Client cannot starve others. */
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 240

/**
 * Build the sync route handler.
 *
 * @param {object} options
 * @param {object} options.service   the authoritative `LocalSooyoService`
 * @param {(res: object, status: number, value: unknown, headers?: object) => void} options.send
 * @param {(req: object) => Promise<unknown>} options.readJson
 * @param {object} options.tokens    `{ token, device, access }[]` from `resolveSyncConfig`
 * @param {boolean} options.allowLoopbackOnly  refuse non-loopback peers (the safe default)
 * @param {(message: string, data?: object) => void} options.log
 */
export function createSyncHandler(options) {
  const { service, send, readJson, tokens, allowLoopbackOnly = true, log = () => {} } = options
  const buckets = new Map()

  const rateLimited = (device) => {
    const now = Date.now()
    const bucket = buckets.get(device)
    if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
      buckets.set(device, { start: now, count: 1 })
      return false
    }
    bucket.count += 1
    return bucket.count > RATE_LIMIT
  }

  /**
   * Establish the caller's identity from the request, never from its body.
   *
   * The comparison is a plain `===` on purpose: both sides are Host-owned strings of the same
   * length class, the token table is small, and a constant-time compare would be security
   * theatre that hides the real risk (a token in a URL, which this API never accepts).
   */
  const authenticate = (req) => {
    const header = String(req.headers?.authorization ?? '')
    const match = /^Bearer\s+(.+)$/i.exec(header)
    if (!match) throw new SyncError(ERRORS.unauthorized, '缺少 Authorization: Bearer 凭证')
    const presented = match[1].trim()
    const entry = tokens.find((candidate) => candidate.token === presented)
    if (!entry) throw new SyncError(ERRORS.unauthorized, '凭证无效或已撤销')
    if (rateLimited(entry.device)) throw new SyncError(ERRORS.rateLimited, '请求过于频繁，请稍后再试')
    return { kind: 'device', device: entry.device, access: entry.access }
  }

  const isLoopback = (req) => {
    const address = req.socket?.remoteAddress ?? ''
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
  }

  /** A body is a JSON object or nothing; anything else is a 400 before it reaches validation. */
  const bodyOf = async (req) => {
    let parsed
    try {
      parsed = await readJson(req)
    } catch (error) {
      throw new SyncError(ERRORS.badRequest, `请求体无法解析：${String(error?.message ?? error)}`)
    }
    if (parsed === null || parsed === undefined) return {}
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyncError(ERRORS.badRequest, '请求体必须是对象')
    return parsed
  }

  /**
   * The ETag for a snapshot.
   *
   * It is the revision alone. The revision moves exactly once per committed command and never
   * for a background write that has not landed, so two requests that name the same revision
   * necessarily name the same dashboard — which is what makes a 304 safe (issue §4.2).
   */
  const etagOf = (revision) => `"sooyo-${revision}"`

  const handleCommand = async (req, actor) => {
    if (actor.access !== 'write') throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    const body = await bodyOf(req)
    const protocolVersion = Number(body?.protocolVersion ?? PROTOCOL_VERSION)
    if (protocolVersion !== PROTOCOL_VERSION) {
      throw new SyncError(ERRORS.badRequest, `不支持的 protocolVersion：${protocolVersion}`, { expected: PROTOCOL_VERSION })
    }
    const operationId = body?.operationId
    if (typeof operationId !== 'string') throw new SyncError(ERRORS.badRequest, '缺少 operationId')
    if (!service.ready) throw new SyncError(ERRORS.notReady, 'Hub 存储域尚未就绪')
    // A decision on an Agent proposal must come from a human at the device, never from a
    // bearer token a model could hold (issue §6.2). This is enforced here, not by convention.
    if (LOCAL_ONLY.has(body?.name)) {
      throw new SyncError(ERRORS.forbidden, `${body.name} 只能在本机界面里执行，不能通过同步 API 调用`)
    }

    // The precondition travels into the funnel, which checks it inside the same queued turn
    // as the write — so another device's command cannot slip between the check and the write.
    return service.execute({
      operationId,
      name: body?.name,
      body: body?.body,
      precondition: body?.precondition,
    }, actor)
  }

  /**
   * One request. Throws a `SyncError` for every refusal, which `handle()` turns into a status.
   *
   * Kept as a separate function so `dev/selftest.mjs` can drive it with fake req/res objects
   * and assert the status and body, exactly as the route handler does in production.
   */
  async function handle(req, res, url) {
    // Transport policy first: the safe deployment is a private network, and a Hub that is
    // exposed publicly without asking must refuse rather than serve (issue §4.4).
    if (allowLoopbackOnly && !isLoopback(req)) {
      throw new SyncError(ERRORS.forbidden, 'sync API 只接受本机连接；请显式关闭 sync.allowLoopbackOnly 并置于 HTTPS 之后')
    }

    const route = url.pathname.slice(`${'/sooyo'}${SYNC_PREFIX}`.length) || '/'
    if (!ROUTES.has(route)) throw new SyncError(ERRORS.notFound, `未知的 sync 路由：${route}`)
    const method = req.method ?? 'GET'

    // Authentication precedes everything, including reading the body.
    const actor = authenticate(req)

    if (method === 'GET' && route === '/health') {
      const state = service.state()
      return {
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
        role: service.role,
        ready: service.ready,
        dataRevision: state.revision,
        generatedAt: new Date().toISOString(),
      }
    }

    if (method === 'GET' && route === '/snapshot') {
      if (!service.ready) throw new SyncError(ERRORS.notReady, 'Hub 存储域尚未就绪')
      await service.settled()
      const state = service.state()
      const etag = etagOf(state.revision)
      if (req.headers?.['if-none-match'] === etag) return { notModified: true, etag }
      const snapshot = service.snapshot()
      return { value: { ...snapshot, etag }, etag }
    }

    if (method === 'GET' && route === '/items') {
      if (!service.ready) throw new SyncError(ERRORS.notReady, 'Hub 存储域尚未就绪')
      const query = Object.fromEntries(url.searchParams.entries())
      return {
        value: service.items({
          limit: query.limit,
          kind: query.kind,
          source: query.source,
          unread: query.unread,
          starred: query.starred,
          q: query.q,
        }),
      }
    }

    if (method === 'GET' && route === '/context') {
      if (!service.ready) throw new SyncError(ERRORS.notReady, 'Hub 存储域尚未就绪')
      const query = Object.fromEntries(url.searchParams.entries())
      return { value: service.context({ scope: query.scope, limit: query.limit }) }
    }

    if (method === 'POST' && route === '/command') {
      return { value: await handleCommand(req, actor) }
    }

    throw new SyncError(ERRORS.notFound, `未知的 sync 路由：${method} ${route}`)
  }

  return { handle, authenticate, ROUTES, etagOf }
}

/**
 * Register the sync routes on the Host's web server.
 *
 * The route is registered as a `prefix` on `/sooyo/sync`, which is the longest-prefix winner
 * over the plugin's own `/sooyo` route, so `/sooyo/assets/*` and the legacy local routes keep
 * their existing handler untouched.
 */
export function buildSyncRoutes(deps) {
  const sync = createSyncHandler(deps)
  return {
    sync,
    route: {
      kind: 'prefix',
      path: '/sooyo/sync',
      handler: (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const reply = (status, value, extra = {}) => {
          const body = JSON.stringify(value ?? null)
          res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-program': 'sooyo-sync',
            'content-length': Buffer.byteLength(body),
            ...extra,
          })
          res.end(body)
        }
        // The returned promise is what lets the offline self-test await a response; `webServer`
        // ignores it, which is why the failure path is handled here rather than by a caller.
        return sync.handle(req, res, url)
          .then((outcome) => {
            if (outcome?.notModified) {
              res.writeHead(304, { etag: outcome.etag, 'cache-control': 'no-store', 'x-program': 'sooyo-sync' })
              res.end()
              return
            }
            reply(200, outcome?.value ?? outcome ?? null, outcome?.etag ? { etag: outcome.etag } : {})
          })
          .catch((error) => {
            if (error instanceof SyncError) {
              reply(error.status, error.toJSON(), { 'x-program': 'sooyo-sync' })
              return
            }
            deps.log?.(`sooyo sync: ${String(error?.message ?? error)}`)
            reply(STATUS_OF[ERRORS.badRequest] ?? 500, {
              ok: false,
              error: { code: 'internal', message: 'Hub 处理请求时出错' },
            }, { 'x-program': 'sooyo-sync' })
          })
      },
    },
  }
}

/** Kept next to the routes so the precondition contract is discoverable from one place. */
export { checkPrecondition, readRevision }