/**
 * Export / import for the one-time move from per-device Standalone to a single Hub (issue §7).
 *
 * The design rules come straight from the issue, and each one prevents a specific way of
 * losing data:
 *
 * - **A dry run is mandatory and free.** `plan()` computes the conflict report without writing
 *   anything, so the user can see "12 tasks, 3 of them would be overwritten" before committing.
 * - **An import never deletes.** A record that already exists with the same content is skipped;
 *   one that differs is *reported*, not overwritten, unless the plan was made with `overwrite`.
 * - **The default Boards are not concatenated.** Two devices that both ran a first install have
 *   `home/work/life/read` with identical ids; importing both would either duplicate every Widget
 *   or overwrite one with the other. The plan names those collisions explicitly.
 * - **The export carries the source identity.** A record's origin device and the export's
 *   `dataRevision` are recorded, so a later reader can tell which device a record came from.
 *
 * The JSON shape is versioned and self-describing, because a backup read by a future version is
 * the only thing standing between a user and a re-created dataset.
 */

import { createHash } from 'node:crypto'
import { SAFE_KEY } from './protocol.js'
import { TABLES } from './store.js'

const nowIso = () => new Date().toISOString()

/** The export format's own version, independent of the domain's and the sync protocol's. */
export const EXPORT_VERSION = 1

/**
 * The tables a Portable Export (`mode: 'portable'`) carries.
 *
 * `items` is excluded from `tables` so bulk feed items are not shipped into portable bundles;
 * instead, the subset of `items` referenced by `readlater`, starred `read`, or Task/Note
 * `origin` is attached under `referencedItems` so saved articles never become dangling IDs.
 */
export const EXPORTED_TABLES = [
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

/**
 * All authoritative tables included in an Operational Backup (`mode: 'backup'`).
 */
export const BACKUP_TABLES = [
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

export function computeExportChecksum(tablesObj, referencedItems = undefined) {
  const payload = referencedItems !== undefined
    ? { tables: tablesObj, referencedItems }
    : { tables: tablesObj }
  return `sha256:${createHash('sha256').update(stableStringify(payload)).digest('hex')}`
}

function collectReferencedItems(tables) {
  const wanted = new Set()
  const fallbackSnapshots = new Map()
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
  const rows = []
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

/**
 * Build the export document.
 *
 * Supports two modes:
 * - `mode: 'portable'` (default): exports `EXPORTED_TABLES` plus `referencedItems` and SHA-256 `checksum`.
 * - `mode: 'backup'`: exports all `BACKUP_TABLES` for full point-in-time operational restore.
 */
export function exportDomain(tables, options = {}) {
  const mode = options.mode === 'backup' ? 'backup' : 'portable'
  const targetTables = mode === 'backup' ? BACKUP_TABLES : EXPORTED_TABLES
  const tablesOut = {}
  const counts = {}
  for (const name of targetTables) {
    const rows = []
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

/** Refuse a document that is not ours, has a corrupted checksum, or is from a future format. */
export function validateExport(document) {
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

/**
 * Work out what an import would do, without doing it.
 *
 * Four outcomes per record, and the plan reports all four so a dry run is genuinely informative:
 *
 * | outcome | meaning |
 * |---|---|
 * | `create`    | the key is absent here |
 * | `identical` | the key exists with byte-identical JSON — nothing to do |
 * | `update`    | the key exists and differs; applied only when `overwrite` is set |
 * | `conflict`  | the key exists and differs; reported and left alone otherwise |
 *
 * Ids that are not path-safe are rejected rather than sanitised: a sanitised id would silently
 * point at a different record.
 */
export function planImport(tables, document, options = {}) {
  const validated = validateExport(document)
  if (!validated.ok) return { ok: false, error: validated.error }
  const overwrite = options.overwrite === true

  const operations = []
  const rejected = []
  const summary = { create: 0, identical: 0, update: 0, conflict: 0, rejected: 0 }
  const perTable = {}

  const tableNames = document.mode === 'backup'
    ? BACKUP_TABLES
    : [...new Set([...EXPORTED_TABLES, ...Object.keys(document.tables).filter((t) => BACKUP_TABLES.includes(t))])]

  for (const name of tableNames) {
    const rows = Array.isArray(document.tables[name]) ? document.tables[name] : []
    perTable[name] = { incoming: rows.length, create: 0, identical: 0, update: 0, conflict: 0, rejected: 0 }
    for (const row of rows) {
      const key = String(row?.key ?? '')
      if (!SAFE_KEY.test(key)) {
        summary.rejected += 1
        perTable[name].rejected += 1
        rejected.push({ table: name, key, reason: 'unsafe-key' })
        continue
      }
      if (row?.value === undefined || row.value === null || typeof row.value !== 'object') {
        summary.rejected += 1
        perTable[name].rejected += 1
        rejected.push({ table: name, key, reason: 'not-an-object' })
        continue
      }
      const current = tables(name).get(key)
      if (current === undefined) {
        operations.push({ op: 'create', table: name, key, value: row.value })
        summary.create += 1
        perTable[name].create += 1
        continue
      }
      if (sameJson(current, row.value)) {
        summary.identical += 1
        perTable[name].identical += 1
        continue
      }
      if (overwrite) {
        operations.push({ op: 'update', table: name, key, value: row.value })
        summary.update += 1
        perTable[name].update += 1
      } else {
        summary.conflict += 1
        perTable[name].conflict += 1
        rejected.push({ table: name, key, reason: 'differs', current: current, incoming: row.value })
      }
    }
  }

  if (Array.isArray(document.referencedItems) && document.referencedItems.length > 0 && !('items' in document.tables)) {
    const name = TABLES.items
    perTable[name] = perTable[name] ?? { incoming: document.referencedItems.length, create: 0, identical: 0, update: 0, conflict: 0, rejected: 0 }
    for (const row of document.referencedItems) {
      const key = String(row?.key ?? '')
      if (!SAFE_KEY.test(key) || !row?.value || typeof row.value !== 'object') {
        summary.rejected += 1
        perTable[name].rejected += 1
        rejected.push({ table: name, key, reason: !SAFE_KEY.test(key) ? 'unsafe-key' : 'not-an-object' })
        continue
      }
      const current = tables(name).get(key)
      if (current === undefined) {
        operations.push({ op: 'create', table: name, key, value: row.value })
        summary.create += 1
        perTable[name].create += 1
      } else if (sameJson(current, row.value)) {
        summary.identical += 1
        perTable[name].identical += 1
      } else if (overwrite) {
        operations.push({ op: 'update', table: name, key, value: row.value })
        summary.update += 1
        perTable[name].update += 1
      } else {
        summary.identical += 1
        perTable[name].identical += 1
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
    // A caller that plans without writing still learns the exact count it would write.
    wouldWrite: operations.length,
  }
}

/**
 * Apply a plan produced by `planImport`.
 *
 * Writes are per-record `put`s in a stable order, so an interrupted import is resumable: running
 * the same plan again produces `identical` for everything that already landed, which is the
 * "失败可重试且不产生重复实体" requirement (§7.1 step 5).
 */
export async function applyImport(tables, plan, options = {}) {
  if (!plan?.ok) return { ok: false, error: plan?.error ?? '计划无效' }
  const written = { create: 0, update: 0 }
  const failed = []
  for (const operation of plan.operations) {
    try {
      await tables(operation.table).put(operation.key, operation.value)
      written[operation.op] += 1
      options.onWrite?.(operation)
    } catch (error) {
      failed.push({ table: operation.table, key: operation.key, error: String(error?.message ?? error) })
    }
  }
  return { ok: failed.length === 0, written, failed, plan: { summary: plan.summary } }
}

/** Structural equality for stored JSON, insensitive to key order. */
function sameJson(a, b) {
  try {
    return stableStringify(a) === stableStringify(b)
  } catch {
    return false
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

/**
 * A one-line-per-table human summary, which is what a dry run actually prints.
 *
 * Kept here rather than in the route so the CLI-ish output and the HTTP response cannot drift.
 */
export function describePlan(plan) {
  if (!plan?.ok) return [`导入计划失败：${plan?.error ?? '未知原因'}`]
  const lines = []
  const source = plan.source
  if (source) {
    lines.push(`来源设备：${source.device}（角色 ${source.role}，revision ${source.dataRevision ?? '?'}）`)
  }
  lines.push(`导出时间：${plan.generatedAt ?? '未知'}`)
  for (const [name, counts] of Object.entries(plan.perTable)) {
    if (counts.incoming === 0) continue
    lines.push(
      `  ${name.padEnd(12)} 共 ${counts.incoming}：新建 ${counts.create}、相同 ${counts.identical}、`
      + `覆盖 ${counts.update}、冲突 ${counts.conflict}、拒绝 ${counts.rejected}`,
    )
  }
  const s = plan.summary
  lines.push(`合计：新建 ${s.create}、相同 ${s.identical}、覆盖 ${s.update}、冲突 ${s.conflict}、拒绝 ${s.rejected}`)
  if (plan.conflicts.length > 0) {
    lines.push('冲突记录（不会覆盖）：')
    for (const conflict of plan.conflicts.slice(0, 20)) {
      lines.push(`  ${conflict.table}/${conflict.key}`)
    }
    if (plan.conflicts.length > 20) lines.push(`  …… 还有 ${plan.conflicts.length - 20} 条`)
  }
  if (s.create === 0 && s.update === 0) lines.push('这个导入不会写入任何记录。')
  return lines
}