import { AsyncLocalStorage } from 'node:async_hooks'
import { ERRORS, SyncError } from './protocol.js'
import type { RuntimePhase } from '../../shared/updates.js'

/** Admission and completion belong together: accepted work may finish while new work is refused. */
export class RuntimeLifecycle {
  private context = new AsyncLocalStorage<{ active: boolean }>()
  private pending = new Set<Promise<unknown>>()
  private controller = new AbortController()
  private closing: Promise<void> | null = null
  phase: RuntimePhase = 'running'

  get accepting(): boolean { return this.phase === 'running' }
  get signal(): AbortSignal { return this.controller.signal }

  run<T>(operation: () => T): T {
    if (!this.accepting && !this.context.getStore()?.active) {
      throw new SyncError(ERRORS.notReady, '插件正在升级或关闭，请稍后重试')
    }
    const scope = { active: true }
    let value: T
    try { value = this.context.run(scope, operation) } catch (error) {
      scope.active = false
      throw error
    }
    if (!value || typeof (value as unknown as PromiseLike<unknown>).then !== 'function') {
      scope.active = false
      return value
    }
    const tracked = Promise.resolve(value).finally(() => {
      scope.active = false
      this.pending.delete(tracked)
    })
    this.pending.add(tracked)
    return tracked as T
  }

  /** Preserve synchronous service methods and `instanceof`, and track nested fire-and-forget writes. */
  guard<T extends object>(target: T): T {
    const bound = new Map<PropertyKey, unknown>()
    return new Proxy(target, {
      get: (object, key) => {
        const value = Reflect.get(object, key, object)
        if (typeof value !== 'function') return value
        if (!bound.has(key)) bound.set(key, (...args: unknown[]) => this.run(() => value.apply(object, args)))
        return bound.get(key)
      },
    })
  }

  async drain(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending])
  }

  async pause(): Promise<void> {
    if (this.phase !== 'running') throw new SyncError(ERRORS.notReady, '已有升级正在准备或执行')
    this.phase = 'pausing'
    this.controller.abort(new Error('sooyo is pausing'))
    await this.drain()
    if (this.phase === 'pausing') this.phase = 'paused'
  }

  resume(): void {
    if (this.phase === 'closing' || this.phase === 'closed') return
    this.controller = new AbortController()
    this.phase = 'running'
  }

  close(release: () => Promise<void>): Promise<void> {
    if (this.closing) return this.closing
    this.phase = 'closing'
    this.controller.abort(new Error('sooyo is closing'))
    this.closing = (async () => {
      await this.drain()
      await release()
      this.phase = 'closed'
    })()
    return this.closing
  }
}
