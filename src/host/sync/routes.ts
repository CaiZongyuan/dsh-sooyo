/**
 * The Hub's private sync API: `/sooyo/sync/v1/*`.
 */

import {
  CAPABILITIES,
  DATA_SCHEMA_VERSION,
  ERRORS,
  LOCAL_ONLY,
  PROTOCOL_RANGE,
  PROTOCOL_VERSION,
  STATUS_OF,
  SYNC_PREFIX,
  SyncError,
} from '../core/protocol.ts'
import { checkPrecondition } from '../domain/commands.ts'
import { readRevision } from '../core/store.ts'

const ROUTES = new Set<string>(['/health', '/snapshot', '/items', '/context', '/command', '/inbox/decide'])

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 240

export interface SyncHandlerOptions {
  service: any
  send?: (res: any, status: number, value: unknown, headers?: Record<string, string>) => void
  readJson: (req: any) => Promise<unknown>
  tokens: Array<{ token: string; device: string; access: 'read' | 'write' }>
  allowLoopbackOnly?: boolean
  log?: (message: string, data?: Record<string, unknown>) => void
}

export function createSyncHandler(options: SyncHandlerOptions) {
  const { service, readJson, tokens, allowLoopbackOnly = true } = options
  const buckets = new Map<string, { start: number; count: number }>()

  const rateLimited = (device: string): boolean => {
    const now = Date.now()
    const bucket = buckets.get(device)
    if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
      buckets.set(device, { start: now, count: 1 })
      return false
    }
    bucket.count += 1
    return bucket.count > RATE_LIMIT
  }

  const authenticate = (req: any) => {
    const header = String(req.headers?.authorization ?? '')
    const match = /^Bearer\s+(.+)$/i.exec(header)
    if (!match?.[1]) throw new SyncError(ERRORS.unauthorized, '缺少 Authorization: Bearer 凭证')
    const presented = match[1].trim()
    const entry = tokens.find((candidate) => candidate.token === presented)
    if (!entry) throw new SyncError(ERRORS.unauthorized, '凭证无效或已撤销')
    if (rateLimited(entry.device)) throw new SyncError(ERRORS.rateLimited, '请求过于频繁，请稍后再试')
    return { kind: 'device', device: entry.device, access: entry.access }
  }

  const isLoopback = (req: any): boolean => {
    const address = req.socket?.remoteAddress ?? ''
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
  }

  const bodyOf = async (req: any): Promise<Record<string, any>> => {
    let parsed: unknown
    try {
      parsed = await readJson(req)
    } catch (error) {
      const errObj = error as { message?: string } | undefined
      throw new SyncError(ERRORS.badRequest, `请求体无法解析：${String(errObj?.message ?? error)}`)
    }
    if (parsed === null || parsed === undefined) return {}
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyncError(ERRORS.badRequest, '请求体必须是对象')
    return parsed as Record<string, any>
  }

  const etagOf = (stateOrRev: any): string => {
    if (typeof stateOrRev === 'object' && stateOrRev !== null) {
      const rev = stateOrRev.revision ?? 0
      const itemsRev = stateOrRev.itemsRevision ?? 0
      return itemsRev > 0 ? `"sooyo-i${itemsRev}-${rev}"` : `"sooyo-${rev}"`
    }
    return `"sooyo-${stateOrRev}"`
  }

  const handleInboxDecide = async (req: any, actor: { kind: string; device: string; access: string }) => {
    if (actor.access !== 'write') throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    const body = await bodyOf(req)
    const protocolVersion = Number(body?.protocolVersion ?? PROTOCOL_VERSION)
    if (protocolVersion !== PROTOCOL_VERSION) {
      throw new SyncError(ERRORS.badRequest, `不支持的 protocolVersion：${protocolVersion}`, { expected: PROTOCOL_VERSION })
    }
    const operationId = body?.operationId
    if (typeof operationId !== 'string') throw new SyncError(ERRORS.badRequest, '缺少 operationId')
    if (!service.ready) throw new SyncError(ERRORS.notReady, 'Hub 存储域尚未就绪')
    return service.decideProposal(
      {
        operationId,
        id: body?.id,
        decision: body?.decision,
        apply: body?.apply,
        precondition: body?.precondition,
      },
      actor,
    )
  }

  const handleCommand = async (req: any, actor: { kind: string; device: string; access: string }) => {
    if (actor.access !== 'write') throw new SyncError(ERRORS.forbidden, '这个凭证只有读权限')
    const body = await bodyOf(req)
    const protocolVersion = Number(body?.protocolVersion ?? PROTOCOL_VERSION)
    if (protocolVersion !== PROTOCOL_VERSION) {
      throw new SyncError(ERRORS.badRequest, `不支持的 protocolVersion：${protocolVersion}`, { expected: PROTOCOL_VERSION })
    }
    const operationId = body?.operationId
    if (typeof operationId !== 'string') throw new SyncError(ERRORS.badRequest, '缺少 operationId')
    if (!service.ready) throw new SyncError(ERRORS.notReady, 'Hub 存储域尚未就绪')
    if (LOCAL_ONLY.has(String(body?.name ?? ''))) {
      throw new SyncError(ERRORS.forbidden, `${body.name} 只能在本机界面里执行，不能通过同步 API 调用`)
    }

    return service.execute(
      {
        operationId,
        name: body?.name,
        body: body?.body,
        precondition: body?.precondition,
      },
      actor,
    )
  }

  async function handle(req: any, _res: any, url: URL): Promise<any> {
    if (allowLoopbackOnly && !isLoopback(req)) {
      throw new SyncError(ERRORS.forbidden, 'sync API 只接受本机连接；请显式关闭 sync.allowLoopbackOnly 并置于 HTTPS 之后')
    }

    const route = url.pathname.slice(`${'/sooyo'}${SYNC_PREFIX}`.length) || '/'
    if (!ROUTES.has(route)) throw new SyncError(ERRORS.notFound, `未知的 sync 路由：${route}`)
    const method = req.method ?? 'GET'

    const actor = authenticate(req)

    if (method === 'GET' && route === '/health') {
      const state = service.state()
      return {
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
        protocol: PROTOCOL_RANGE,
        protocolRange: PROTOCOL_RANGE,
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        capabilities: CAPABILITIES,
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
      const etag = etagOf(state)
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

    if (method === 'POST' && route === '/inbox/decide') {
      return { value: await handleInboxDecide(req, actor) }
    }

    throw new SyncError(ERRORS.notFound, `未知的 sync 路由：${method} ${route}`)
  }

  return { handle, authenticate, ROUTES, etagOf }
}

export function buildSyncRoutes(deps: SyncHandlerOptions) {
  const sync = createSyncHandler(deps)
  return {
    sync,
    route: {
      kind: 'prefix' as const,
      path: '/sooyo/sync',
      handler: (req: any, res: any) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const reply = (status: number, value: unknown, extra: Record<string, string> = {}) => {
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
        return sync
          .handle(req, res, url)
          .then((outcome) => {
            if (outcome?.notModified) {
              res.writeHead(304, { etag: outcome.etag, 'cache-control': 'no-store', 'x-program': 'sooyo-sync' })
              res.end()
              return
            }
            reply(200, outcome?.value ?? outcome ?? null, outcome?.etag ? { etag: outcome.etag } : {})
          })
          .catch((error: unknown) => {
            if (error instanceof SyncError) {
              reply(error.status, error.toJSON(), { 'x-program': 'sooyo-sync' })
              return
            }
            const errObj = error as { message?: string } | undefined
            deps.log?.(`sooyo sync: ${String(errObj?.message ?? error)}`)
            reply(
              STATUS_OF[ERRORS.badRequest] ?? 500,
              {
                ok: false,
                error: { code: 'internal', message: 'Hub 处理请求时出错' },
              },
              { 'x-program': 'sooyo-sync' },
            )
          })
      },
    },
  }
}

export { checkPrecondition, readRevision }
