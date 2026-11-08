/**
 * Export / import for the one-time move from per-device Standalone to a single Hub (issue §7).
 */

import { createHash } from 'node:crypto'
import { SAFE_KEY } from './protocol.ts'
import { TABLES, type TableAccessor } from './store.ts'

const nowIso = (): string => new Date().toISOString()

export const EXPORT_VERSION = 1

export const EXPORTED_TABLES: string[] = [
  TABLES.boards,
  TABLES.widgets,
  TABLES.layouts,
  TABLES.tasks,
  TABLES.notes,
  TABLES.readlater,
  TABLES.settings,
  TABLES.read,
  TABLES.agentInbox,
]

export const BACKUP_TABLES: string[] = [
  TABLES.boards,
  TABLES.widgets,
  TABLES.layouts,
  TABLES.tasks,
  TABLES.notes,
  TABLES.readlater,
  TABLES.settings,
  TABLES.read,
  TABLES.agentInbox,
  TABLES.agentReviews,
  TABLES.items,
  TABLES.sources,
  TABLES.operations,
  TABLES.journal,
]

export function computeExportChecksum(tablesObj: Record<string, any>, referencedItems: any[] | undefined = undefined): string {
  const payload = referencedItems !== undefined
    ? { tables: tablesObj, referencedItems }
    : { tables: tablesObj }
  return `sha256:${createHash('sha256').update(stableStringify(payload)).digest('hex')}`
}

function collectReferencedItems(tables: TableAccessor): Array<{ key: string; value: any }> {
  const wanted = new Set<string>()
  const fallbackSnapshots = new Map<string, any>()
  for (const [key, value] of tables(TABLES.readlater).entries()) {
    const id = String(value?.itemId ?? key ?? '')
    if (!id) continue
    wanted.add(id)
    if (value?.snapshot && typeof value.snapshot === 'object') {
      fallbackSnapshots.set(id, value.snapshot)
    }
  }
  for (const [key, value] of tables(TABLES.read).entries()) {
    if (value?.starred && key) {
      const id = String(key)
      wanted.add(id)
      if (value?.snapshot && typeof value.snapshot === 'object' && !fallbackSnapshots.has(id)) {
        fallbackSnapshots.set(id, value.snapshot)
      }
    }
  }
  for (const [, value] of tables(TABLES.tasks).entries()) {
    if (value?.origin?.itemId) wanted.add(String(value.origin.itemId))
  }
  for (const [, value] of tables(TABLES.notes).entries()) {
    if (value?.origin?.itemId) wanted.add(String(value.origin.itemId))
  }
  const rows: Array<{ key: string; value: any }> = []
  const itemsTable = tables(TABLES.items)
  for (const itemId of wanted) {
    const item = itemsTable?.get(itemId) ?? fallbackSnapshots.get(itemId)
    if (item && typeof item === 'object') {
      rows.push({ key: itemId, value: JSON.parse(JSON.stringify(item)) })
    }
  }
  rows.sort((a, b) => String(a.key).localeCompare(String(b.key)))
  return rows
}

export function exportDomain(
  tables: TableAccessor,
  options: { mode?: string; device?: string; role?: string; dataRevision?: number | null } = {},
) {
  const mode = options.mode === 'backup' ? 'backup' : 'portable'
  const targetTables = mode === 'backup' ? BACKUP_TABLES : EXPORTED_TABLES
  const tablesOut: Record<string, Array<{ key: string; value: any }>> = {}
  const counts: Record<string, number> = {}
  for (const name of targetTables) {
    const rows: Array<{ key: string; value: any }> = []
    for (const [key, value] of tables(name).entries()) {
      rows.push({ key, value: JSON.parse(JSON.stringify(value)) })
    }
    rows.sort((a, b) => String(a.key).localeCompare(String(b.key)))
    tablesOut[name] = rows
    counts[name] = rows.length
  }
  const referencedItems = mode === 'portable' ? collectReferencedItems(tables) : undefined
  const checksum = computeExportChecksum(tablesOut, referencedItems)

  return {
    kind: 'sooyo-export',
    exportVersion: EXPORT_VERSION,
    mode,
    checksum,
    generatedAt: nowIso(),
    source: {
      device: options.device ?? 'unknown',
      role: options.role ?? 'unknown',
      dataRevision: options.dataRevision ?? null,
      domainVersion: 1,
    },
    counts,
    tables: tablesOut,
    ...(referencedItems !== undefined ? { referencedItems } : {}),
  }
}

export function validateExport(document: any): { ok: boolean; error?: string } {
  if (document?.kind !== 'sooyo-export') return { ok: false, error: '这不是 sooyo 导出的文件' }
  if (!Number.isSafeInteger(document?.exportVersion)) return { ok: false, error: '缺少 exportVersion' }
  if (document.exportVersion > EXPORT_VERSION) {
    return { ok: false, error: `这个导出文件的版本是 ${document.exportVersion}，当前插件只读到 ${EXPORT_VERSION}` }
  }
  if (!document?.tables || typeof document.tables !== 'object') return { ok: false, error: '导出文件里没有 tables' }
  if (typeof document.checksum === 'string') {
    const expected = computeExportChecksum(
      document.tables,
      Array.isArray(document.referencedItems) ? document.referencedItems : undefined,
    )
    if (document.checksum !== expected) {
      return { ok: false, error: '导出文件校验和（checksum）不匹配，文件可能已损坏' }
    }
  }
  return { ok: true }
}

export interface TableImportSummary {
  incoming: number
  create: number
  identical: number
  update: number
  conflict: number
  rejected: number
}

export function planImport(tables: TableAccessor, document: any, options: { overwrite?: boolean } = {}) {
  const validated = validateExport(document)
  if (!validated.ok) return { ok: false, error: validated.error }
  const overwrite = options.overwrite === true

  const operations: Array<{ op: 'create' | 'update'; table: string; key: string; value: any }> = []
  const rejected: Array<{ table: string; key: string; reason: string; current?: any; incoming?: any }> = []
  const summary = { create: 0, identical: 0, update: 0, conflict: 0, rejected: 0 }
  const perTable: Record<string, TableImportSummary> = {}

  const tableNames = document.mode === 'backup'
    ? BACKUP_TABLES
    : [...new Set([...EXPORTED_TABLES, ...Object.keys(document.tables).filter((t) => BACKUP_TABLES.includes(t))])]

  for (const name of tableNames) {
    const rows = Array.isArray(document.tables[name]) ? document.tables[name] : []
    const tableStats: TableImportSummary = {
      incoming: rows.length,
      create: 0,
      identical: 0,
      update: 0,
      conflict: 0,
      rejected: 0,
    }
    perTable[name] = tableStats
    for (const row of rows) {
      const key = String(row?.key ?? '')
      if (!SAFE_KEY.test(key)) {
        summary.rejected += 1
        tableStats.rejected += 1
        rejected.push({ table: name, key, reason: 'unsafe-key' })
        continue
      }
      if (row?.value === undefined || row.value === null || typeof row.value !== 'object') {
        summary.rejected += 1
        tableStats.rejected += 1
        rejected.push({ table: name, key, reason: 'not-an-object' })
        continue
      }
      const current = tables(name).get(key)
      if (current === undefined) {
        operations.push({ op: 'create', table: name, key, value: row.value })
        summary.create += 1
        tableStats.create += 1
        continue
      }
      if (sameJson(current, row.value)) {
        summary.identical += 1
        tableStats.identical += 1
        continue
      }
      if (overwrite) {
        operations.push({ op: 'update', table: name, key, value: row.value })
        summary.update += 1
        tableStats.update += 1
      } else {
        summary.conflict += 1
        tableStats.conflict += 1
        rejected.push({ table: name, key, reason: 'differs', current, incoming: row.value })
      }
    }
  }

  if (Array.isArray(document.referencedItems) && document.referencedItems.length > 0 && !('items' in document.tables)) {
    const name = TABLES.items
    const tableStats: TableImportSummary = perTable[name] ?? {
      incoming: document.referencedItems.length,
      create: 0,
      identical: 0,
      update: 0,
      conflict: 0,
      rejected: 0,
    }
    perTable[name] = tableStats
    for (const row of document.referencedItems) {
      const key = String(row?.key ?? '')
      if (!SAFE_KEY.test(key) || !row?.value || typeof row.value !== 'object') {
        summary.rejected += 1
        tableStats.rejected += 1
        rejected.push({ table: name, key, reason: !SAFE_KEY.test(key) ? 'unsafe-key' : 'not-an-object' })
        continue
      }
      const current = tables(name).get(key)
      const fallbackCurrent = current === undefined ? tables(TABLES.readlater)?.get?.(key)?.snapshot : undefined
      if (current === undefined && fallbackCurrent !== undefined && sameJson(fallbackCurrent, row.value)) {
        summary.identical += 1
        tableStats.identical += 1
      } else if (current === undefined) {
        operations.push({ op: 'create', table: name, key, value: row.value })
        summary.create += 1
        tableStats.create += 1
      } else if (sameJson(current, row.value)) {
        summary.identical += 1
        tableStats.identical += 1
      } else if (overwrite) {
        operations.push({ op: 'update', table: name, key, value: row.value })
        summary.update += 1
        tableStats.update += 1
      } else {
        summary.identical += 1
        tableStats.identical += 1
      }
    }
  }

  return {
    ok: true,
    dryRun: true,
    overwrite,
    source: document.source ?? null,
    generatedAt: document.generatedAt ?? null,
    summary,
    perTable,
    operations,
    conflicts: rejected.filter((entry) => entry.reason === 'differs'),
    rejected,
    wouldWrite: operations.length,
  }
}

export async function applyImport(
  tables: TableAccessor,
  plan: any,
  options: { onWrite?: (op: any) => void } = {},
) {
  if (!plan?.ok) return { ok: false, error: plan?.error ?? '计划无效' }
  const written: Record<'create' | 'update', number> = { create: 0, update: 0 }
  const failed: Array<{ table: string; key: string; error: string }> = []
  for (const operation of plan.operations ?? []) {
    try {
      await tables(operation.table).put(operation.key, operation.value)
      const opKind: 'create' | 'update' = operation.op === 'update' ? 'update' : 'create'
      written[opKind] += 1
      options.onWrite?.(operation)
    } catch (error) {
      const errObj = error as { message?: string } | undefined
      failed.push({ table: operation.table, key: operation.key, error: String(errObj?.message ?? error) })
    }
  }
  return { ok: failed.length === 0, written, failed, plan: { summary: plan.summary } }
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return stableStringify(a) === stableStringify(b)
  } catch {
    return false
  }
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',')}]`
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

export function describePlan(plan: any): string[] {
  if (!plan?.ok) return [`导入计划失败：${plan?.error ?? '未知原因'}`]
  const lines: string[] = []
  const source = plan.source
  if (source) {
    lines.push(`来源设备：${source.device}（角色 ${source.role}，revision ${source.dataRevision ?? '?'}）`)
  }
  lines.push(`导出时间：${plan.generatedAt ?? '未知'}`)
  for (const [name, counts] of Object.entries((plan.perTable ?? {}) as Record<string, TableImportSummary>)) {
    if (counts.incoming === 0) continue
    lines.push(
      `  ${name.padEnd(12)} 共 ${counts.incoming}：新建 ${counts.create}、相同 ${counts.identical}、`
      + `覆盖 ${counts.update}、冲突 ${counts.conflict}、拒绝 ${counts.rejected}`,
    )
  }
  const s = plan.summary
  lines.push(`合计：新建 ${s.create}、相同 ${s.identical}、覆盖 ${s.update}、冲突 ${s.conflict}、拒绝 ${s.rejected}`)
  if ((plan.conflicts ?? []).length > 0) {
    lines.push('冲突记录（不会覆盖）：')
    for (const conflict of plan.conflicts.slice(0, 20)) {
      lines.push(`  ${conflict.table}/${conflict.key}`)
    }
    if (plan.conflicts.length > 20) lines.push(`  …… 还有 ${plan.conflicts.length - 20} 条`)
  }
  if (s.create === 0 && s.update === 0) lines.push('这个导入不会写入任何记录。')
  return lines
}
