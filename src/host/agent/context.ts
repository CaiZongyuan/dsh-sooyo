/**
 * The Sooyo Context Bridge: a small, fresh digest injected when a **real** human turn starts.
 */

import { randomUUID } from 'node:crypto'

export const PLUGIN_SOURCE = 'sooyo'
export const PLUGIN_KIND = `plugin:${PLUGIN_SOURCE}`

const CONTEXT_TIMEOUT_MS = 2000
const HARD_TIMEOUT_MS = 2500

export function isSynthetic(message: any): boolean {
  const kind = message?.source?.kind
  if (typeof kind !== 'string') return false
  if (kind === 'user') return false
  return kind === 'plugin' || kind.startsWith('plugin:') || kind !== 'tool'
}

export function hasHumanInput(messages: any[] | undefined): boolean {
  return (messages ?? []).some((message) => message?.role === 'user' && message?.source?.kind === 'user')
}

export function contextMessage(content: string) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user' as const,
    content: Object.freeze([{ type: 'text' as const, text: content }]),
    source: Object.freeze({ kind: PLUGIN_KIND, plugin: PLUGIN_SOURCE, form: 'context' as const }),
  })
}

async function fetchContext(service: any, signal?: AbortSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONTEXT_TIMEOUT_MS)
  const hardTimer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener?.('abort', onAbort, { once: true })
  try {
    const context = await service.context({ limit: 6 }, { signal: controller.signal })
    return { context, stale: Boolean(context?.stale), error: null }
  } catch (error) {
    const errObj = error as { message?: string } | undefined
    return { context: null, stale: false, error: String(errObj?.message ?? error) }
  } finally {
    clearTimeout(timer)
    clearTimeout(hardTimer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}

export function attachAgentContext(
  ctx: any,
  deps: {
    service: any
    role: () => string
    render: (context: any, options?: { stale?: boolean }) => string | null
    enabled: () => boolean
    log?: (msg: string) => void
  },
): () => void {
  const { service, role, render, enabled } = deps
  const delivered = new Map<string, boolean>()

  if (typeof ctx?.on !== 'function') {
    deps.log?.('sooyo: no event surface; Sooyo Context Bridge disabled')
    return () => {}
  }

  const turnKey = (agent: any, turn: unknown): string =>
    `${agent?.id ?? agent?.session?.id ?? 'unknown'}#${String(turn)}`

  const listener = async (payload: any, next: () => Promise<any>) => {
    const decision = await next()
    if (!enabled()) return decision
    if (decision.kind !== 'enter') return decision
    const { agent, messages, signal, turn } = payload ?? {}
    if (!agent) return decision
    if (!hasHumanInput(decision.messages ?? messages)) return decision
    const key = turnKey(agent, turn)
    if (delivered.has(key)) return decision
    if (signal?.aborted) return decision

    const { context, stale, error } = await fetchContext(service, signal)
    if (signal?.aborted) return decision
    if (!context?.ready) {
      delivered.set(key, true)
      if (error) deps.log?.(`sooyo: agent context unavailable (${role()}): ${error}`)
      return decision
    }

    const block = render(context, { stale })
    if (!block) return decision
    delivered.set(key, true)
    if (delivered.size > 200) {
      const oldest = delivered.keys().next().value
      if (oldest !== undefined) delivered.delete(oldest)
    }
    return { ...decision, messages: [...decision.messages, contextMessage(block)] }
  }

  ctx.on('agent/pre-step', listener, { prepend: true })
  return () => {
    ctx.off?.('agent/pre-step', listener)
  }
}
