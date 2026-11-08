import { randomUUID } from 'node:crypto'
import { sameBuild } from '../../shared/build.js'
import {
  PACKAGE_NAME, UPDATE_CONTRACT, compatibleContract, compareStableVersions, stableVersion,
  type LocalRuntime, type PanelPresence, type PluginUpdateStatus, type PreparedUpdate, type ReleaseCandidate,
} from '../../shared/updates.js'
import type { RuntimeLifecycle } from '../core/lifecycle.js'
import { ERRORS, SyncError } from '../core/protocol.js'

interface PluginManager {
  listBundles(): Promise<Array<Record<string, any>>>
  listVersions?: (name: string, options: Record<string, unknown>, signal?: AbortSignal) => Promise<Record<string, any>>
  updateBundle?: (...args: any[]) => unknown
}

interface Dependencies {
  manager: () => PluginManager | undefined
  runtime: () => LocalRuntime
  lifecycle: RuntimeLifecycle
  shape: string
  development: { check(signal?: AbortSignal, force?: boolean): Promise<any> }
  checkHub?: () => Promise<Record<string, any>>
  ttlMs?: number
  registry?: string
  fetch?: typeof fetch
}

/** Registry URLs are returned to the browser; credentials never belong in them. */
export function registryUrl(value: string): string {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    || url.username || url.password || url.search || url.hash) throw new Error('更新 registry 地址无效')
  return url.href.replace(/\/$/, '')
}

/** Official releases use a minimum Node version. Unrecognised ranges require a manual upgrade. */
function supportsNode(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const minimum = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(value)
  if (!minimum) return false
  const current = process.versions.node.split('.').map(Number)
  const required = minimum.slice(1).map((part) => Number(part ?? 0))
  for (let i = 0; i < 3; i++) {
    if (current[i] !== required[i]) return (current[i] ?? 0) > (required[i] ?? 0)
  }
  return true
}

async function readMetadata(url: string, signal: AbortSignal, request: typeof fetch): Promise<Record<string, any>> {
  const response = await request(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    headers: { accept: 'application/json', 'user-agent': 'dsh-sooyo/update-check' },
    redirect: 'error',
  })
  if (!response.ok) throw new Error(response.status === 404 ? '尚无可用的 npm 正式发布' : `版本检查返回 HTTP ${response.status}`)
  if (!response.body) throw new Error('版本检查返回空响应')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 2_000_000) throw new Error('版本元数据超过大小限制')
      chunks.push(next.value)
    }
  } finally {
    await reader.cancel()
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Owns checks and preparation, while DSH owns installation and survives this module's removal. */
export function createPluginUpdates(deps: Dependencies) {
  const request = deps.fetch ?? fetch
  const panels = new Map<string, PanelPresence & { at: number; freezeId: string | null }>()
  let cached: Omit<PluginUpdateStatus, 'runtime'> = {
    state: 'unchecked', checkedAt: null, installedVersion: null,
    source: deps.shape === 'checkout' ? 'checkout' : 'unknown',
    canUpdate: false, reason: '尚未检查更新', candidate: null, error: null, development: null,
  }
  let checkedAt = 0
  let inflight: Promise<PluginUpdateStatus> | null = null
  let lease: PreparedUpdate | null = null
  let leaseTimer: ReturnType<typeof setTimeout> | null = null

  const status = (): PluginUpdateStatus => ({ ...cached, runtime: deps.runtime() })

  async function check(force = false): Promise<PluginUpdateStatus> {
    if (inflight) return inflight
    if (!force && checkedAt && Date.now() - checkedAt < (deps.ttlMs ?? 3600_000)) return status()
    inflight = (async () => {
      const next: typeof cached = {
        ...cached, state: 'current', checkedAt: new Date().toISOString(), error: null,
        candidate: null, canUpdate: false, reason: null, development: null,
      }
      try {
        const manager = deps.manager()
        const bundles = manager ? await manager.listBundles() : []
        const installed = bundles.find((bundle) => bundle.name === PACKAGE_NAME)
        next.installedVersion = typeof installed?.version === 'string' ? installed.version : deps.runtime().build.version
        next.source = deps.shape === 'checkout' ? 'checkout' : installed?.updatable === true ? 'registry' : installed ? 'other' : 'unknown'
        const native = Boolean(manager?.listVersions && manager.updateBundle)
        next.reason = next.source === 'checkout' ? '源码副本仅检查更新，请在工作树中手动拉取和构建'
          : !native ? '当前 DSH 缺少原生更新接口，请在插件管理器中手动更新'
          : next.source !== 'registry' ? '当前安装方式不支持一键升级；请在 DSH 插件管理器切换为 npm 安装'
          : null

        if (next.source === 'checkout') {
          const dev = await deps.development.check(deps.lifecycle.signal, force)
          next.development = { installedCommit: dev.installedCommit, latestCommit: dev.latestCommit, changed: dev.updateAvailable }
          if (dev.error) next.reason += `；开发提交检查失败：${dev.error}`
        }

        let registry = registryUrl(deps.registry ?? 'https://registry.npmjs.org')
        let latest: Record<string, any> | undefined
        if (native && next.source === 'registry') {
          const listing = await manager!.listVersions!(PACKAGE_NAME, deps.registry ? { registry } : {},
            AbortSignal.any([deps.lifecycle.signal, AbortSignal.timeout(90_000)]))
          if (listing.status !== 'listed') throw new Error(String(listing.reason ?? '宿主无法读取发布版本'))
          registry = registryUrl(typeof listing.registry === 'string' ? listing.registry : registry)
          const versions: Array<Record<string, any>> = Array.isArray(listing.versions) ? listing.versions : []
          latest = versions.filter((item) => stableVersion(item.version) && !item.prerelease)
            .sort((a, b) => compareStableVersions(b.version, a.version))[0]
          if (!latest && listing.omitted > 0) throw new Error('宿主版本列表被截断，无法确认最新正式版本')
        } else {
          const metadata = await readMetadata(`${registry}/${PACKAGE_NAME}`, deps.lifecycle.signal, request)
          const versions = Object.keys(metadata.versions ?? {}).filter(stableVersion).sort((a, b) => compareStableVersions(b, a))
          const version = versions[0]
          if (!version) throw new Error('尚无可用的 npm 正式发布')
          if (!next.installedVersion || !stableVersion(next.installedVersion)
            || compareStableVersions(version, next.installedVersion) > 0) latest = { version, publishedAt: metadata.time?.[version] }
        }
        if (latest) {
          const manifest = await readMetadata(`${registry}/${PACKAGE_NAME}/${latest.version}`, deps.lifecycle.signal, request)
          if (manifest.name !== PACKAGE_NAME || manifest.version !== latest.version) throw new Error('发布元数据的名称或版本不匹配')
          const contract = manifest.sooyo?.updateContract
          const nodeCompatible = supportsNode(manifest.engines?.node)
          const compatible = compatibleContract(contract) && nodeCompatible && latest.bundle !== false && !latest.incompatible && !manifest.deprecated
          const candidate: ReleaseCandidate = {
            version: latest.version, publishedAt: latest.publishedAt ?? null, registry,
            notes: typeof manifest.sooyo?.releaseNotes === 'string' ? manifest.sooyo.releaseNotes.slice(0, 6000) : '此版本没有提供更新说明。',
            contract: compatibleContract(contract) ? contract : null, compatible,
            reason: latest.incompatible ? '目标版本与当前 DSH 不兼容'
              : manifest.deprecated ? '此版本已被撤回，不提供一键升级'
              : !nodeCompatible ? '目标 Node.js 要求不兼容或无法自动验证，请安排维护升级'
              : !compatibleContract(contract) ? '目标版本需要维护升级，或没有声明兼容的数据和同步协议' : null,
          }
          next.candidate = candidate
          next.state = 'available'
          next.canUpdate = native && next.source === 'registry' && compatible
          next.reason ??= candidate.reason
        }
      } catch (error) {
        next.state = 'error'
        next.error = String((error as Error)?.message ?? error)
        next.canUpdate = false
      }
      cached = next
      checkedAt = Date.now()
      return status()
    })()
    try { return await inflight } finally { inflight = null }
  }

  function presence(value: PanelPresence & { freezeId?: string; leaving?: boolean }) {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(value?.id ?? '')) throw new SyncError(ERRORS.badRequest, '面板标识无效')
    if (value.leaving) panels.delete(value.id)
    else {
      if (!panels.has(value.id) && panels.size >= 100) throw new SyncError(ERRORS.rateLimited, '打开的面板过多')
      panels.set(value.id, {
        id: value.id, build: value.build, dirty: value.dirty !== false, busy: value.busy !== false,
        freezeId: typeof value.freezeId === 'string' ? value.freezeId : null, at: Date.now(),
      })
    }
    return { freezeId: lease?.requestId ?? null, runtime: deps.runtime() }
  }

  function resume(requestId: string): void {
    if (!lease || lease.requestId !== requestId) return
    if (leaseTimer) clearTimeout(leaseTimer)
    leaseTimer = null
    lease = null
    deps.lifecycle.resume()
  }

  async function prepare(panelId: string, version: string): Promise<PreparedUpdate> {
    if (lease || !deps.lifecycle.accepting) throw new SyncError(ERRORS.notReady, '已有升级正在准备或执行')
    const runtime = deps.runtime()
    if (!runtime.ready) throw new SyncError(ERRORS.notReady, '本机存储尚未就绪')
    if (!panels.has(panelId)) throw new SyncError(ERRORS.badRequest, '当前面板尚未连接，请稍后重试')
    const pending: PreparedUpdate = { requestId: randomUUID(), version, registry: '', instanceId: runtime.instanceId }
    lease = pending
    try {
      const current = await check()
      const target = current.candidate
      if (!current.canUpdate || !target || target.version !== version) {
        throw new SyncError(ERRORS.badRequest, current.error ?? current.reason ?? '目标版本已改变，请重新检查')
      }
      pending.registry = target.registry
      if (deps.checkHub) {
        const health = await deps.checkHub()
        if (!health.ok || health.protocolVersion !== UPDATE_CONTRACT.protocolVersion
          || health.dataSchemaVersion !== UPDATE_CONTRACT.dataSchemaVersion) {
          throw new SyncError(ERRORS.unavailable, '暂时无法确认与 Hub 的兼容性，请恢复连接后重试')
        }
      }
      const deadline = Date.now() + 10_000
      while (true) {
        const connected = [...panels.values()]
        if (!panels.has(panelId)) throw new SyncError(ERRORS.badRequest, '发起升级的面板已经关闭')
        if (connected.some((panel) => Date.now() - panel.at > 15_000)) {
          throw new SyncError(ERRORS.notReady, '还有未响应的窗口，请重新打开或关闭该窗口后再升级')
        }
        // Cached draft/build state may predate a save in another window. Inspect this freeze's acknowledgements.
        if (connected.every((panel) => panel.freezeId === pending.requestId)) {
          if (connected.some((panel) => panel.dirty)) throw new SyncError(ERRORS.notReady, '请先保存或取消所有窗口中的未提交内容')
          if (connected.some((panel) => !panel.build || !sameBuild(panel.build, runtime.build))) {
            throw new SyncError(ERRORS.notReady, '还有窗口运行不同的界面版本，请重新打开这些面板后再升级')
          }
          if (connected.every((panel) => !panel.busy)) break
        }
        if (Date.now() > deadline) throw new SyncError(ERRORS.notReady, '等待其他窗口或正在保存的内容超时，请稍后重试')
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          deps.lifecycle.pause(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('等待在途工作结束超时，请稍后重试')), 30_000) }),
        ])
      } finally { if (timer) clearTimeout(timer) }
      leaseTimer = setTimeout(() => resume(pending.requestId), 5 * 60_000)
      leaseTimer.unref?.()
      return pending
    } catch (error) {
      resume(pending.requestId)
      throw error
    }
  }

  return {
    status, check, presence, prepare, resume,
    freezeId: () => lease?.requestId ?? null,
    dispose: () => { if (leaseTimer) clearTimeout(leaseTimer); leaseTimer = null },
    describe: () => {
      const value = status()
      return value.error ? `Update check failed: ${value.error}`
        : value.candidate ? `Update: sooyo ${value.runtime.build.version ?? 'unknown'} → ${value.candidate.version}; a human can review it in the sooyo update panel.` : null
    },
  }
}
