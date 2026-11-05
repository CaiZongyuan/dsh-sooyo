/**
 * The Sooyo Context Bridge: a small, fresh digest injected when a **real** human turn starts.
 *
 * Why `agent/pre-step` and not the system prompt (issue §5.3):
 *
 * - A persona may declare `complete: true`, which replaces the system prompt wholesale, so a
 *   section registered there can vanish. `pre-step` rides the message list instead.
 * - OpenViking's memory plugin already appends its profile and recall at `pre-step`, prepended
 *   so it runs *after* the other waterfall listeners. This listener appends after that, so the
 *   two never overwrite each other.
 * - A batch made only of tool results or plugin messages must not re-inject, or every tool call
 *   would add another copy of the same context and inflate the prompt (issue §5.3).
 *
 * The budget is intentionally small: a summary plus pointers, never the database.
 */

import { randomUUID } from 'node:crypto'

/** Identifies our injected message, so a re-entry can be recognised and skipped. */
export const PLUGIN_SOURCE = 'sooyo'
export const PLUGIN_KIND = `plugin:${PLUGIN_SOURCE}`

/** A Hub that has not answered in this long is treated as unavailable for this turn. */
const CONTEXT_TIMEOUT_MS = 2000
/** Never hold a turn open longer than this, whatever the service does. */
const HARD_TIMEOUT_MS = 2500

/**
 * Is this message produced by a plugin rather than typed by the person?
 *
 * Three shapes must be recognised: our own `plugin:sooyo`, OpenViking's
 * `plugin:openviking-memory`, and the first-party context producers that DSH 0.2 gives their
 * own kinds (`time-context`, …). Missing any of them makes the "human turn" test leak, and a
 * leaked test re-injects context into every tool round-trip.
 */
export function isSynthetic(message) {
  const kind = message?.source?.kind
  if (typeof kind !== 'string') return false
  if (kind === 'user') return false
  return kind === 'plugin' || kind.startsWith('plugin:') || kind !== 'tool'
}

/** True when the batch contains at least one message an actual person wrote. */
export function hasHumanInput(messages) {
  return (messages ?? []).some((message) => message?.role === 'user' && message?.source?.kind === 'user')
}

/**
 * Wrap the digest in a message DSH treats as plugin-authored, not as user speech.
 *
 * The shape is DSH's own `UserMessage`: `{ id, role: 'user', content, source }`. It is built
 * here from `node:crypto` rather than by importing `@deepseek-ai/dsh-llm`'s `createUserMessage`,
 * because this bundle is pnpm-linked and must not import from `node_modules` (AGENTS.md
 * rule 1). `source.kind` is what keeps it out of OpenViking's capture and out of the
 * human-input test above; `source.form` is what distinguishes it from a recall digest.
 */
export function contextMessage(content) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content: Object.freeze([{ type: 'text', text: content }]),
    source: Object.freeze({ kind: PLUGIN_KIND, plugin: PLUGIN_SOURCE, form: 'context' }),
  })
}

/**
 * Read the digest, bounded in time.
 *
 * A failure is not an error the Agent sees: the turn proceeds without Sooyo context, because a
 * Hub that is briefly unreachable must not block a conversation (issue §5.3, AC-10).
 */
async function fetchContext(service, signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONTEXT_TIMEOUT_MS)
  const hardTimer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener?.('abort', onAbort, { once: true })
  try {
    const context = await service.context({ limit: 6 }, { signal: controller.signal })
    return { context, stale: Boolean(context?.stale), error: null }
  } catch (error) {
    return { context: null, stale: false, error: String(error?.message ?? error) }
  } finally {
    clearTimeout(timer)
    clearTimeout(hardTimer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}

/**
 * Install the bridge.
 *
 * Returns a disposer, so the plugin's `ctx.effect` can unregister cleanly. The handler is a
 * waterfall listener that **appends** to the decision rather than rebuilding it: the goal-round
 * driver marks entries with `startsRequestSeries`, and a rebuilt object would drop that flag.
 */
export function attachAgentContext(ctx, deps) {
  const { service, role, render, enabled } = deps
  /**
   * One digest per Agent turn, so a multi-step turn does not re-fetch on every step.
   *
   * Keyed on the session id rather than the Agent object: DSH reuses one Agent per session, but
   * a `WeakMap` keyed on the object would treat a re-created wrapper as a new conversation and
   * inject a second copy into the same turn.
   */
  const delivered = new Map()

  // A Host context always has `on`; a reduced embedding (and the offline self-test's fake
  // context) may not. Degrading to "no bridge" is right: a plugin must never fail `apply()`
  // because one optional surface is absent.
  if (typeof ctx?.on !== 'function') {
    deps.log?.('sooyo: no event surface; Sooyo Context Bridge disabled')
    return () => {}
  }

  /** The key that identifies "this turn of this conversation". */
  const turnKey = (agent, turn) => `${agent?.id ?? agent?.session?.id ?? 'unknown'}#${turn}`

  const listener = async (payload, next) => {
    const decision = await next()
    if (!enabled()) return decision
    if (decision.kind !== 'enter') return decision
    const { agent, messages, signal, turn } = payload ?? {}
    if (!agent) return decision
    // Only a human message starts a conversation; a tool round-trip or a scheduled delivery
    // must not pull in Sooyo context (issue §5.3, §6.1).
    if (!hasHumanInput(decision.messages ?? messages)) return decision
    const key = turnKey(agent, turn)
    if (delivered.has(key)) return decision
    if (signal?.aborted) return decision

    const { context, stale, error } = await fetchContext(service, signal)
    if (signal?.aborted) return decision
    if (!context?.ready) {
      // Record the attempt so a hub outage costs one timeout per turn, not one per step.
      delivered.set(key, true)
      if (error) deps.log?.(`sooyo: agent context unavailable (${role()}): ${error}`)
      return decision
    }

    const block = render(context, { stale })
    if (!block) return decision
    delivered.set(key, true)
    // The map is bounded by pruning the oldest entries; a long-lived Host would otherwise keep
    // one string per turn forever.
    if (delivered.size > 200) {
      const oldest = delivered.keys().next().value
      delivered.delete(oldest)
    }
    return { ...decision, messages: [...decision.messages, contextMessage(block)] }
  }

  ctx.on('agent/pre-step', listener, { prepend: true })
  return () => {
    ctx.off?.('agent/pre-step', listener)
  }
}