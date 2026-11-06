/**
 * The durable Agent Inbox: proposals awaiting a human decision.
 *
 * The issue is emphatic about two things here (issue §6.2):
 *
 * - **A model may not approve its own proposal.** `proposal.decide` is reachable only from a
 *   local, user-driven route — the Agent tool surface has no approve, and the sync API
 *   requires a `write` token that a model never holds.
 * - **Approval is not the same as application.** The record keeps `status` and `appliedAt`
 *   separate, so a failed application is visible as `failed` rather than silently `approved`.
 *
 * Proposals are stored one record per proposal in the `agentInbox` table, which is a synced
 * table: a proposal created by the schedule on the Hub appears on every device.
 */

import { SyncError, ERRORS, SAFE_KEY } from '../core/protocol.js'
import { TABLES, revisionOf } from '../core/store.js'
import { newId } from '../personal.js'

/** The physical table these proposals live in (`^[a-z][a-z0-9_]*$` is all the backend allows). */
const INBOX_TABLE = TABLES.agentInbox

const nowIso = () => new Date().toISOString()

/** The only operations a proposal may carry. Destructive deletes are never allowed. */
export const PROPOSAL_OPERATIONS = new Set([
  'task.add',
  'task.update',
  'note.add',
  'readlater.set',
  'board.create',
  'widget.add',
  'widget.update',
  'layout.set',
])

export const PROPOSAL_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'applied', 'failed', 'rolled_back']

/** How long a pending proposal stays actionable before it is treated as expired. */
const PROPOSAL_TTL_MS = 14 * 24 * 3600 * 1000

/** Every proposal, newest first — the shape `snapshot()` returns under `agentInbox`. */
export function readAgentInbox(tables) {
  const rows = []
  for (const [, value] of tables(INBOX_TABLE).entries()) {
    if (!value?.id) continue
    rows.push(value)
  }
  rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  return rows
}

/** The pending subset, which is what the badge and the Agent context count. */
export function pendingProposals(tables) {
  return readAgentInbox(tables).filter((entry) => entry.status === 'pending')
}

/** Create one proposal. Called by `proposal.create` and by the reviewer. */
export async function createProposal(tables, body) {
  const reason = String(body?.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'proposal 需要一个理由' }
  const operations = Array.isArray(body?.operations) ? body.operations : []
  if (operations.length === 0) return { ok: false, error: 'proposal 至少需要一个操作' }
  for (const operation of operations) {
    if (!PROPOSAL_OPERATIONS.has(operation?.name)) {
      return { ok: false, error: `proposal 里不允许 ${String(operation?.name)}` }
    }
  }
  const id = newId('p')
  const existing = tables(INBOX_TABLE).get(id)
  if (existing) return { ok: true, proposal: existing }
  const proposal = {
    id,
    createdAt: nowIso(),
    createdBySessionId: typeof body?.createdBySessionId === 'string' ? body.createdBySessionId : null,
    reason: reason.slice(0, 500),
    evidenceRefs: Array.isArray(body?.evidenceRefs) ? body.evidenceRefs.map(String).slice(0, 10) : [],
    operations: operations.slice(0, 10).map((operation) => ({
      name: operation.name,
      body: sanitiseOperationBody(operation.body),
    })),
    ...(body?.preview ? { preview: body.preview } : {}),
    ...(Array.isArray(body?.basePreconditions) ? { basePreconditions: body.basePreconditions } : {}),
    status: 'pending',
    appliedAt: null,
  }
  await tables(INBOX_TABLE).put(id, proposal)
  return { ok: true, proposal }
}

/**
 * Keep only plain, bounded JSON in an operation body.
 *
 * A proposal is data that later gets executed, so it must not carry a function, a huge string,
 * or a nested structure the applier would have to interpret.
 */
function sanitiseOperationBody(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const text = JSON.stringify(value)
  if (text.length > 4000) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

/**
 * Record a decision.
 *
 * Only a `pending` proposal may move, and only to `approved` or `rejected`: a second decision
 * on the same proposal is a conflict, which is what stops a double click from applying a
 * change twice.
 */
export async function decideProposal(tables, body) {
  const id = String(body?.id ?? '')
  if (!SAFE_KEY.test(id)) return { ok: false, error: 'proposal id 不合法' }
  const existing = tables(INBOX_TABLE).get(id)
  if (!existing) return { ok: false, error: '没有这条提议' }
  if (existing.status !== 'pending') {
    return { ok: false, error: `这条提议已经是 ${existing.status}，不能再决定` }
  }
  const decision = String(body?.decision ?? '')
  if (decision !== 'approve' && decision !== 'reject') return { ok: false, error: 'decision 只能是 approve 或 reject' }
  const next = {
    ...existing,
    status: decision === 'approve' ? 'approved' : 'rejected',
    decidedAt: nowIso(),
  }
  await tables(INBOX_TABLE).put(id, next)
  return { ok: true, proposal: next }
}

/** Mark a proposal applied (or failed) once the operations have been attempted. */
export async function settleProposal(tables, id, outcome, error, applied = undefined, inverseSteps = undefined) {
  const existing = tables(INBOX_TABLE).get(id)
  if (!existing) return null
  const next = {
    ...existing,
    status: outcome === 'applied' ? 'applied' : 'failed',
    appliedAt: nowIso(),
    ...(error ? { applyError: String(error).slice(0, 500) } : {}),
    ...(Array.isArray(applied) ? { appliedResults: applied } : {}),
    ...(Array.isArray(inverseSteps) ? { inverseSteps } : {}),
  }
  await tables(INBOX_TABLE).put(id, next)
  return next
}

/**
 * Apply an approved proposal's operations through the same funnel every other write uses.
 *
 * Verifies any `basePreconditions` recorded when the proposal was created so stale proposals
 * never overwrite newer user edits, and computes `inverseSteps` so an applied proposal can be
 * cleanly rolled back.
 */
export async function applyProposal(tables, proposal, execute) {
  if (proposal.status !== 'approved') {
    throw new SyncError(ERRORS.badRequest, `只有 approved 的提议可以应用，当前是 ${proposal.status}`)
  }
  for (const pre of proposal.basePreconditions ?? []) {
    const current = tables(pre.table)?.get?.(pre.key)
    const actual = revisionOf(current)
    if (!current || actual !== pre.expectedRevision) {
      throw new SyncError(
        ERRORS.conflict,
        `提议涉及的记录 ${pre.table}/${pre.key} 已被修改（期望 revision ${pre.expectedRevision}，当前 ${actual}）`,
        { table: pre.table, key: pre.key, expected: pre.expectedRevision, revision: actual },
      )
    }
  }
  const applied = []
  const inverseSteps = []
  for (const [index, operation] of (proposal.operations ?? []).entries()) {
    if (!PROPOSAL_OPERATIONS.has(operation?.name)) continue
    const beforeSnapshot = new Map()
    const keysBefore = new Map()
    for (const tableName of Object.values(TABLES)) {
      if (tableName === TABLES.journal || tableName === TABLES.operations || tableName === TABLES.settings) continue
      const entries = new Map()
      for (const [k, v] of tables(tableName).entries()) entries.set(k, v)
      beforeSnapshot.set(tableName, entries)
      keysBefore.set(tableName, new Set(entries.keys()))
    }

    const result = await execute({
      operationId: `p-${proposal.id}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120),
      name: operation.name,
      body: operation.body ?? {},
      actor: { kind: 'proposal', device: proposal.id, access: 'write' },
    })
    const ok = result?.ok !== false
    applied.push({ name: operation.name, ok, error: result?.error ?? null })

    if (ok) {
      for (const [tableName, beforeMap] of beforeSnapshot.entries()) {
        for (const [k, afterVal] of tables(tableName).entries()) {
          if (!beforeMap.has(k)) {
            inverseSteps.unshift({
              table: tableName,
              key: k,
              op: 'delete',
              expectedRevision: revisionOf(afterVal),
            })
          } else if (JSON.stringify(beforeMap.get(k)) !== JSON.stringify(afterVal)) {
            inverseSteps.unshift({
              table: tableName,
              key: k,
              op: 'put',
              value: beforeMap.get(k),
              expectedRevision: revisionOf(afterVal),
            })
          }
        }
      }
    }
  }
  applied.inverseSteps = inverseSteps
  return applied
}

/**
 * Roll back an `applied` proposal using its recorded `inverseSteps`, provided no target record
 * has been modified since the proposal was applied.
 */
export async function rollbackProposal(tables, id) {
  const safeId = String(id ?? '')
  if (!SAFE_KEY.test(safeId)) return { ok: false, error: 'proposal id 不合法' }
  const existing = tables(INBOX_TABLE).get(safeId)
  if (!existing) return { ok: false, error: '没有这条提议' }
  if (existing.status !== 'applied') {
    return { ok: false, error: `只有已应用（applied）的提议可以撤销，当前状态是 ${existing.status}` }
  }
  const steps = Array.isArray(existing.inverseSteps) ? existing.inverseSteps : []
  if (steps.length === 0) {
    return { ok: false, error: '这条提议没有可回滚的步骤记录' }
  }

  for (const step of steps) {
    const current = tables(step.table)?.get?.(step.key)
    if (Number.isSafeInteger(step.expectedRevision) && step.expectedRevision > 0 && current) {
      const actual = revisionOf(current)
      if (actual > step.expectedRevision) {
        return {
          ok: false,
          code: ERRORS.conflict,
          error: `记录 ${step.table}/${step.key} 在提议应用后又被修改过（revision ${actual} > ${step.expectedRevision}），无法自动撤销`,
        }
      }
    }
  }

  for (const step of steps) {
    if (step.op === 'delete') {
      if (tables(step.table).get(step.key) !== undefined) {
        await tables(step.table).delete(step.key)
      }
    } else if (step.op === 'put' && step.value !== undefined) {
      await tables(step.table).put(step.key, step.value)
    }
  }

  const next = {
    ...existing,
    status: 'rolled_back',
    rolledBackAt: nowIso(),
  }
  await tables(INBOX_TABLE).put(safeId, next)
  return { ok: true, proposal: next, rolledBackSteps: steps.length }
}

/** Expire proposals nobody decided in time, so the Inbox cannot grow forever. */
export function expireStale(tables) {
  const cutoff = Date.now() - PROPOSAL_TTL_MS
  const expired = []
  for (const entry of readAgentInbox(tables)) {
    if (entry.status !== 'pending') continue
    const at = Date.parse(entry.createdAt ?? '')
    if (Number.isFinite(at) && at < cutoff) expired.push(entry.id)
  }
  return expired
}