/**
 * The durable Agent Inbox: proposals awaiting a human decision.
 */

import { SyncError, ERRORS, SAFE_KEY } from '../core/protocol.ts'
import { TABLES, revisionOf, type TableAccessor } from '../core/store.ts'
import { newId } from '../domain/personal.ts'

const INBOX_TABLE = TABLES.agentInbox

const nowIso = (): string => new Date().toISOString()

/** The only operations a proposal may carry. Destructive deletes are never allowed. */
export const PROPOSAL_OPERATIONS = new Set<string>([
  'task.add',
  'task.update',
  'note.add',
  'note.update',
  'readlater.set',
  'collection.save',
  'retro.save',
  'board.create',
  'widget.add',
  'widget.update',
  'layout.set',
])

export const PROPOSAL_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'applied', 'failed', 'rolled_back'] as const

const PROPOSAL_TTL_MS = 14 * 24 * 3600 * 1000

/** Every proposal, newest first — the shape `snapshot()` returns under `agentInbox`. */
export function readAgentInbox(tables: TableAccessor): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = []
  for (const [, value] of tables(INBOX_TABLE).entries()) {
    if (!value?.id) continue
    rows.push(value)
  }
  rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  return rows
}

/** The pending subset, which is what the badge and the Agent context count. */
export function pendingProposals(tables: TableAccessor): Array<Record<string, any>> {
  return readAgentInbox(tables).filter((entry) => entry.status === 'pending')
}

/** Create one proposal. Called by `proposal.create` and by the reviewer. */
export async function createProposal(tables: TableAccessor, body: any) {
  const reason = String(body?.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'proposal 需要一个理由' }
  const operations = Array.isArray(body?.operations) ? body.operations : []
  if (operations.length === 0) return { ok: false, error: 'proposal 至少需要一个操作' }
  for (const operation of operations) {
    if (!PROPOSAL_OPERATIONS.has(String(operation?.name ?? ''))) {
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
    operations: operations.slice(0, 10).map((operation: any) => ({
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

function sanitiseOperationBody(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const text = JSON.stringify(value)
  if (text.length > 4000) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function decideProposal(tables: TableAccessor, body: any) {
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

export async function settleProposal(
  tables: TableAccessor,
  id: string,
  outcome: string,
  error: unknown,
  applied: any[] | undefined = undefined,
  inverseSteps: any[] | undefined = undefined,
) {
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

export interface AppliedOperationResult {
  name: string
  ok: boolean
  error: any
}

export type AppliedProposalArray = AppliedOperationResult[] & {
  inverseSteps?: Array<{
    table: string
    key: string
    op: 'put' | 'delete'
    value?: any
    expectedRevision: number
  }>
}

export async function applyProposal(
  tables: TableAccessor,
  proposal: Record<string, any>,
  execute: (cmd: any) => Promise<any>,
): Promise<AppliedProposalArray> {
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
  const applied: AppliedProposalArray = []
  const inverseSteps: NonNullable<AppliedProposalArray['inverseSteps']> = []
  for (const [index, operation] of (proposal.operations ?? []).entries()) {
    if (!PROPOSAL_OPERATIONS.has(String(operation?.name ?? ''))) continue
    const beforeSnapshot = new Map<string, Map<string, any>>()
    for (const tableName of Object.values(TABLES)) {
      if (tableName === TABLES.journal || tableName === TABLES.operations || tableName === TABLES.settings) continue
      const entries = new Map<string, any>()
      for (const [k, v] of tables(tableName).entries()) entries.set(k, v)
      beforeSnapshot.set(tableName, entries)
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

export async function rollbackProposal(tables: TableAccessor, id: unknown) {
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
export function expireStale(tables: TableAccessor): string[] {
  const cutoff = Date.now() - PROPOSAL_TTL_MS
  const expired: string[] = []
  for (const entry of readAgentInbox(tables)) {
    if (entry.status !== 'pending') continue
    const at = Date.parse(entry.createdAt ?? '')
    if (Number.isFinite(at) && at < cutoff) expired.push(String(entry.id))
  }
  return expired
}
