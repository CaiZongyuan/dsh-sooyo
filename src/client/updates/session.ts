import { BUILD, sameBuild, type BuildInfo } from '../../shared/build.js'
import { PACKAGE_NAME, type LocalRuntime, type PluginUpdateStatus, type PreparedUpdate } from '../../shared/updates.js'

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
interface Receipt {
  requestId: string
  target: string
  previous: string | null
  startedAt: number
  outcome: 'updating' | 'applied' | 'restart-required' | 'failed' | 'uncertain'
  detail: string
}

export interface UpdateViewState {
  status: PluginUpdateStatus | null
  receipt: Receipt | null
  busy: boolean
  message: string | null
  dirty: boolean
  native: boolean
  runtime: LocalRuntime | null
  build: BuildInfo
}

const RECEIPT_KEY = 'sooyo:update-receipt-v1'
const RECEIPT_EVENT = 'sooyo:update-receipt'

async function control<T>(path: string, body?: unknown, keepalive = false): Promise<T> {
  const response = await fetch(`/sooyo${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', keepalive,
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-sooyo-ui': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: keepalive ? undefined : AbortSignal.timeout(path === '/updates/prepare' ? 180_000 : path === '/updates/check' ? 120_000 : 20_000),
  })
  const answer = await response.json()
  if (!response.ok) throw new Error(answer.error ?? `HTTP ${response.status}`)
  return answer as T
}

/** This receiver lives outside the plugin's React/fiber lifetime until the native RPC settles. */
export class UpdateSession {
  readonly id = `panel-${crypto.randomUUID()}`
  private roots = new Set<HTMLElement>()
  private edits = new Map<Control, string>()
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private polling = false
  private writes = 0
  private freezeId: string | null = null
  private lastStatus = 0
  private manager: () => any = () => undefined
  private recovery: HTMLElement | null = null
  private binding = 0
  private events = new AbortController()
  private navigation: { begin: () => AbortSignal | undefined; open: () => void } | null = null
  private model: UpdateViewState = {
    status: null, receipt: null, busy: false, message: null,
    dirty: false, native: false, runtime: null, build: BUILD,
  }

  constructor() {
    if (!window.__sooyoUpdateJob) {
      let receipt: Receipt | null = null
      try {
        const saved = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) ?? 'null') as Receipt | null
        if (saved && typeof saved.target === 'string' && typeof saved.requestId === 'string') {
          receipt = { ...saved, outcome: saved.outcome === 'updating' ? 'uncertain' : saved.outcome }
        }
      } catch { /* Storage is optional; a missing receipt never implies success. */ }
      window.__sooyoUpdateJob = { receipt, busy: false }
    }
    this.model.receipt = window.__sooyoUpdateJob.receipt
    this.model.busy = window.__sooyoUpdateJob.busy
    this.listen()
  }

  private listen(): void {
    const signal = this.events.signal
    const remember = (event: Event) => {
      const element = event.target
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return
      if (!this.owns(element) || !element.closest('form') || element.name === 'cmd') return
      if (!this.edits.has(element)) this.edits.set(element, this.value(element))
    }
    document.addEventListener('focusin', remember, { capture: true, signal })
    document.addEventListener('beforeinput', remember, { capture: true, signal })
    document.addEventListener('input', () => { this.updateDirty(); this.emit() }, { capture: true, signal })
    document.addEventListener('sooyo:form-saved', (event) => {
      const form = (event as CustomEvent<HTMLFormElement>).detail
      for (const element of this.edits.keys()) if (form?.contains(element)) this.edits.set(element, this.value(element))
      this.updateDirty()
      this.emit()
    }, { signal })
    window.addEventListener('pagehide', () => {
      void control('/updates/presence', { id: this.id, leaving: true }, true).catch(() => {})
    }, { signal })
    window.addEventListener(RECEIPT_EVENT, () => {
      const job = window.__sooyoUpdateJob!
      this.model.receipt = job.receipt
      this.model.busy = job.busy
      this.model.message = job.receipt?.detail || this.model.message
      this.applyFreeze()
      this.verify()
      this.emit()
    }, { signal })
  }

  bind(build: BuildInfo, getManager: () => any): () => void {
    const binding = ++this.binding
    this.model.build = build
    this.manager = getManager
    this.model.native = typeof this.manager()?.updateBundle === 'function'
    this.emit()
    return () => {
      if (this.binding !== binding) return
      this.manager = () => undefined
      this.model.native = false
      this.emit()
    }
  }

  bindNavigation(navigation: { begin: () => AbortSignal | undefined; open: () => void }): () => void {
    this.navigation = navigation
    const job = window.__sooyoUpdateJob!
    if (job.returnToPanel) {
      job.returnToPanel = false
      const cancelled = job.navigationSignal?.aborted
      job.navigationSignal = undefined
      if (!cancelled) navigation.open()
    }
    return () => { if (this.navigation === navigation) this.navigation = null }
  }

  attach(root: HTMLElement): () => void {
    if (this.events.signal.aborted) { this.events = new AbortController(); this.listen() }
    this.roots.add(root)
    this.recovery?.remove()
    this.recovery = null
    this.applyFreeze()
    if (!this.timer) this.timer = setInterval(() => void this.poll(), 2500)
    void this.poll()
    return () => {
      this.roots.delete(root)
      if (!this.roots.size) this.stop()
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  snapshot(): UpdateViewState { return { ...this.model } }

  private owns(element: Element): boolean { return [...this.roots].some((root) => root.contains(element)) }
  private value(element: Control): string {
    return element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
      ? String(element.checked) : element.value
  }

  private updateDirty(): void {
    for (const element of this.edits.keys()) if (!element.isConnected || !this.owns(element)) this.edits.delete(element)
    this.model.dirty = [...this.edits].some(([element, original]) => this.value(element) !== original)
  }

  private applyFreeze(): void {
    const installing = window.__sooyoUpdateJob?.busy && window.__sooyoUpdateJob.receipt?.outcome === 'updating'
    for (const root of this.roots) root.inert = Boolean(this.freezeId || installing) || !this.model.runtime
  }

  private emit(): void { for (const listener of this.listeners) listener() }
  private persist(): void {
    window.__sooyoUpdateJob!.receipt = this.model.receipt
    try { sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(this.model.receipt)) } catch { /* Verified runtime remains available. */ }
    window.dispatchEvent(new Event(RECEIPT_EVENT))
    this.emit()
  }

  private async heartbeat(): Promise<void> {
    this.updateDirty()
    const presence = () => control<{ freezeId: string | null; runtime: LocalRuntime }>('/updates/presence', {
      id: this.id, build: this.model.build, dirty: this.model.dirty, busy: this.writes > 0,
      freezeId: this.freezeId,
    })
    const answer = await presence()
    const changed = this.freezeId !== answer.freezeId
    this.freezeId = answer.freezeId
    this.model.runtime = answer.runtime
    const job = window.__sooyoUpdateJob!
    if (changed && this.freezeId && this.roots.size) {
      job.returnToPanel = true
      job.navigationSignal = this.navigation?.begin()
    } else if (!this.freezeId && this.roots.size && !job.busy) {
      job.returnToPanel = false
      job.navigationSignal = undefined
    }
    this.applyFreeze()
    // Acknowledge only after the editor is inert and the latest draft/busy state is known.
    if (changed && this.freezeId) await presence()
    this.verify()
  }

  async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      this.model.native = typeof this.manager()?.updateBundle === 'function'
      await this.heartbeat()
      if (Date.now() - this.lastStatus > 15_000) {
        this.model.status = await control<PluginUpdateStatus>('/updates')
        this.lastStatus = Date.now()
      }
    } catch (error) {
      if (this.model.busy || this.model.receipt?.outcome === 'updating') {
        this.model.message = '插件正在重新加载，等待本机服务恢复…'
      } else this.model.message = String((error as Error)?.message ?? error)
    } finally {
      this.polling = false
      this.emit()
    }
  }

  private verify(): void {
    const receipt = this.model.receipt
    const runtime = this.model.runtime
    if (!receipt || !runtime) return
    const healthy = runtime.ready && runtime.phase === 'running' && sameBuild(runtime.build, this.model.build)
    if (receipt.outcome === 'restart-required' && healthy && runtime.build.version === receipt.target) {
      receipt.outcome = 'applied'
      receipt.detail = '重启后新版本已生效。'
      this.persist()
    }
    if (receipt.outcome === 'applied') {
      this.model.message = healthy && runtime.build.version === receipt.target
        ? `已升级到 ${receipt.target}，本机服务和界面均已就绪`
        : '已安装新版本，正在等待本机服务和界面使用同一版本…'
    } else if (receipt.outcome === 'uncertain') {
      this.model.message = healthy && runtime.build.version === receipt.target
        ? `当前已运行 ${receipt.target}，但上次升级的完整回执未收到`
        : '上次升级结果尚未确认，请检查当前运行版本或打开 DSH 插件管理器'
    }
  }

  async check(): Promise<void> {
    if (this.model.busy) return
    this.model.busy = true
    this.model.message = '正在检查正式版本…'
    this.emit()
    try {
      this.model.status = await control<PluginUpdateStatus>('/updates/check', {})
      this.lastStatus = Date.now()
      this.model.message = this.model.status.error
        ?? (this.model.status.candidate ? `发现正式版本 ${this.model.status.candidate.version}` : '当前已是最新正式版本')
    } catch (error) { this.model.message = String((error as Error)?.message ?? error) }
    finally { this.model.busy = false; this.emit() }
  }

  async upgrade(): Promise<void> {
    if (this.model.busy) return
    this.updateDirty()
    if (this.model.dirty) { this.model.message = '请先保存或取消未提交内容，再升级'; this.emit(); return }
    const candidate = this.model.status?.candidate
    const manager = this.manager()
    if (!candidate || !this.model.status?.canUpdate || typeof manager?.updateBundle !== 'function') return
    this.model.busy = true
    window.__sooyoUpdateJob!.busy = true
    this.model.message = '正在检查兼容性并等待所有窗口保存…'
    this.emit()
    let prepared: PreparedUpdate | null = null
    try {
      await this.heartbeat()
      prepared = await control<PreparedUpdate>('/updates/prepare', { panelId: this.id, version: candidate.version })
      this.model.receipt = {
        requestId: prepared.requestId, target: prepared.version, previous: this.model.build.version,
        startedAt: Date.now(), outcome: 'updating', detail: '',
      }
      this.persist()
      this.model.message = '正在安装并重新加载插件…'
      this.emit()
      const answer = await manager.updateBundle(PACKAGE_NAME, prepared.version, {
        registry: prepared.registry, requestId: prepared.requestId,
      })
      if (!answer?.ok) throw new Error(answer?.error?.message ?? answer?.error?.diagnostic ?? '宿主更新调用失败')
      const value = answer.value
      const application = value?.result?.application
      const restore = value?.restore?.application
      const failed = application === 'failed' || application === 'cancelled'
      const detail = failed
        ? `升级失败：${value.result.error?.diagnostic ?? value.result.error?.code ?? application}。${restore === 'applied' ? '宿主报告旧插件已恢复。' : restore === 'restart-required' ? '旧插件恢复需要重启 DSH。' : restore ? '旧插件恢复也失败，请打开 DSH 插件管理器重新安装。' : '宿主未执行旧包恢复，请检查插件管理器。'}`
        : application === 'restart-required' ? '新版本已安装，等待你安排重启 DSH 后生效。'
        : application === 'applied' ? '宿主已激活插件，正在核对实际运行版本。'
        : '宿主没有返回可确认的激活结果，请检查 DSH 插件管理器。'
      this.model.receipt = {
        ...this.model.receipt!, outcome: failed ? 'failed' : application === 'applied' ? 'applied'
          : application === 'restart-required' ? 'restart-required' : 'uncertain', detail,
      }
      this.model.message = detail
      this.persist()
    } catch (error) {
      this.model.message = String((error as Error)?.message ?? error)
      if (this.model.receipt?.outcome === 'updating') {
        this.model.receipt = { ...this.model.receipt, outcome: 'uncertain', detail: this.model.message }
        this.persist()
      }
    } finally {
      if (prepared) await control('/updates/resume', { requestId: prepared.requestId }).catch(() => {})
      this.freezeId = null
      this.applyFreeze()
      this.model.busy = false
      window.__sooyoUpdateJob!.busy = false
      this.persist()
      this.lastStatus = 0
      if (this.roots.size) await this.poll()
      this.emit()
      if (!this.roots.size) { this.showRecovery(); this.stop() }
    }
  }

  beginWrite(): () => void {
    const runtime = this.model.runtime
    if (this.freezeId || (runtime && (!sameBuild(runtime.build, this.model.build) || runtime.phase !== 'running'))) {
      throw new Error('插件正在升级或界面版本不同，请等待服务和界面就绪')
    }
    this.writes++
    return () => { this.writes--; this.emit() }
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.events.abort()
    void control('/updates/presence', { id: this.id, leaving: true }).catch(() => {})
  }

  private showRecovery(): void {
    if (!this.model.receipt || this.model.receipt.outcome === 'applied') return
    const notice = document.createElement('div')
    notice.setAttribute('role', 'alert')
    notice.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:100000;max-width:min(440px,90vw);padding:20px;background:#252a28;color:#fff;border-radius:16px;font:14px/1.6 sans-serif;box-shadow:0 12px 40px #0005'
    notice.textContent = `sooyo 更新：${this.model.receipt.detail || this.model.message} 请打开「设置 → 插件」检查 dsh-sooyo。`
    const close = document.createElement('button')
    close.textContent = '知道了'
    close.style.cssText = 'display:block;margin-top:12px;padding:6px 12px;border-radius:6px;color:#111;background:#fff'
    close.onclick = () => notice.remove()
    notice.append(close)
    document.body.append(notice)
    this.recovery = notice
  }
}

declare global {
  interface Window {
    __sooyoUpdateSession?: UpdateSession
    __sooyoUpdateJob?: { receipt: Receipt | null; busy: boolean; returnToPanel?: boolean; navigationSignal?: AbortSignal }
  }
}

let localSession: UpdateSession | undefined

export function updateSession(): UpdateSession {
  if (!localSession) {
    localSession = new UpdateSession()
    window.__sooyoUpdateSession = localSession
  }
  return localSession
}
