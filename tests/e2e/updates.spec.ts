import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeExportChecksum } from '../../src/host/index.ts'
import { activateSooyoPanel, startDshInstance, openSooyoInDsh, cleanupPackedTarball, type DshInstance } from './dsh-fixture.js'
import { startUpdateRegistry } from './update-registry.js'

const shots = resolve('test-results/screenshots')
mkdirSync(shots, { recursive: true })

async function seed(dsh: DshInstance) {
  const saved = await fetch(`${dsh.origin}/sooyo/action`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'task.add', body: { title: '升级后必须保留的任务' }, operationId: 'upgrade-fixture-task' }),
  })
  expect(saved.ok).toBeTruthy()
  const document = await (await fetch(`${dsh.origin}/sooyo/export?mode=backup`)).json()
  document.tables.items.push({ key: 'aihot-upgrade-fixture', value: {
    id: 'aihot-upgrade-fixture', sourceId: 'aihot', title: '升级验证内容', itemKind: 'article',
    url: 'https://example.com/upgrade-fixture', discoveredAt: new Date().toISOString(),
  } })
  document.counts.items = document.tables.items.length
  document.checksum = computeExportChecksum(document.tables, document.referencedItems)
  const imported = await fetch(`${dsh.origin}/sooyo/import`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document, apply: true }),
  })
  const importedResult = await imported.json()
  expect(importedResult, JSON.stringify(importedResult)).toMatchObject({ ok: true })
}

async function runtime(dsh: DshInstance) {
  try { const answer = await fetch(`${dsh.origin}/sooyo/runtime`); return answer.ok ? await answer.json() : null } catch { return null }
}

async function checkAndOpen(page: Page, version: string) {
  await page.getByRole('button', { name: '插件更新', exact: true }).click()
  await page.getByRole('button', { name: '检查更新', exact: true }).click()
  await expect(page.getByRole('button', { name: `升级到 ${version}`, exact: true })).toBeEnabled({ timeout: 120_000 })
}

test.afterAll(() => cleanupPackedTarball())

test('real native update freezes windows, preserves data, switches both builds, and restores a broken release', async ({ page, context }) => {
  test.setTimeout(240_000)
  const registry = await startUpdateRegistry([
    { version: '0.3.0' }, { version: '0.3.1' }, { version: '0.3.2', broken: true },
  ])
  let dsh: DshInstance | undefined
  try {
    dsh = await startDshInstance({ label: 'updates', pluginSpec: 'dsh-sooyo@0.3.0', registry: registry.origin, bundleManaged: true })
    await seed(dsh)
    const before = await runtime(dsh)
    await openSooyoInDsh(page, dsh)
    const second = await context.newPage()
    await openSooyoInDsh(second, dsh)
    registry.publish('0.3.1')
    await checkAndOpen(page, '0.3.1')
    await page.screenshot({ path: resolve(shots, 'updates-desktop.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('button[aria-label="sooyo daily"]').first()).not.toBeVisible()
    await activateSooyoPanel(page)
    if (!(await page.getByRole('dialog', { name: 'sooyo 更新' }).isVisible())) await page.getByRole('button', { name: '插件更新', exact: true }).click()
    await page.screenshot({ path: resolve(shots, 'updates-mobile.png') })
    const bounds = await page.getByRole('dialog', { name: 'sooyo 更新' }).boundingBox()
    expect(bounds!.width).toBeLessThanOrEqual(390)
    expect(bounds!.height).toBeLessThanOrEqual(844)
    await page.setViewportSize({ width: 1440, height: 900 })

    await second.locator('.sy-hero-capture input').fill('尚未提交的内容')
    await expect.poll(() => second.evaluate(() => Reflect.get(window, '__sooyoUpdateSession').snapshot().dirty)).toBe(true)
    await page.getByRole('button', { name: '升级到 0.3.1', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '未提交内容' })).toBeVisible({ timeout: 45_000 })
    expect((await runtime(dsh)).build.version).toBe('0.3.0')
    await expect(second.locator('.sy-root')).toHaveJSProperty('inert', false)
    await second.locator('.sy-hero-capture input').fill('')
    await expect.poll(() => second.evaluate(() => Reflect.get(window, '__sooyoUpdateSession').snapshot().dirty)).toBe(false)
    await page.getByRole('button', { name: '升级到 0.3.1', exact: true }).click()
    await expect.poll(async () => (await runtime(dsh!))?.build.version, { timeout: 90_000 }).toBe('0.3.1')
    await expect.poll(() => page.evaluate(() => {
      const state = Reflect.get(window, '__sooyoUpdateSession').snapshot()
      return state.receipt?.outcome === 'applied' && state.message?.includes('均已就绪')
    }), { timeout: 60_000 }).toBe(true)
    const after = await runtime(dsh)
    expect(after.instanceId).not.toBe(before.instanceId)
    await expect.poll(() => second.evaluate(() => Reflect.get(window, '__sooyoUpdateSession').snapshot().build.version)).toBe('0.3.1')
    const data = await (await fetch(`${dsh.origin}/sooyo/daily`)).json()
    expect(data.tasks.filter((entry: any) => entry.title === '升级后必须保留的任务')).toHaveLength(1)

    registry.publish('0.3.2')
    await checkAndOpen(page, '0.3.2')
    await page.getByRole('button', { name: '升级到 0.3.2', exact: true }).click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__sooyoUpdateSession').snapshot().receipt?.outcome), { timeout: 90_000 }).toBe('failed')
    await expect.poll(async () => (await runtime(dsh!))?.build.version, { timeout: 30_000 }).toBe('0.3.1')
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__sooyoUpdateSession').snapshot().receipt?.detail)).toContain('旧插件已恢复')
    expect((await (await fetch(`${dsh.origin}/sooyo/daily`)).json()).tasks.filter((entry: any) => entry.title === '升级后必须保留的任务')).toHaveLength(1)
    await second.close()
  } finally {
    await dsh?.stop()
    await registry.close()
  }
})

test('native restoration failure remains visible after Sooyo itself disappears', async ({ page }) => {
  test.setTimeout(180_000)
  const registry = await startUpdateRegistry([{ version: '0.3.0', failOnRestore: true }, { version: '0.3.1', broken: true }])
  let dsh: DshInstance | undefined
  try {
    dsh = await startDshInstance({ label: 'restore-failure', pluginSpec: 'dsh-sooyo@0.3.0', registry: registry.origin, bundleManaged: true })
    await seed(dsh)
    await openSooyoInDsh(page, dsh)
    registry.publish('0.3.1')
    await checkAndOpen(page, '0.3.1')
    await page.getByRole('button', { name: '升级到 0.3.1', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: '旧插件恢复也失败' })).toBeVisible({ timeout: 90_000 })
    await page.screenshot({ path: resolve(shots, 'updates-recovery-failed.png') })
    expect(await runtime(dsh)).toBeNull()
  } finally {
    await dsh?.stop()
    await registry.close()
  }
})

test('a host without HMR keeps the running version until the user restarts it', async ({ page }) => {
  test.setTimeout(180_000)
  const registry = await startUpdateRegistry([{ version: '0.3.0' }, { version: '0.3.1' }])
  let dsh: DshInstance | undefined
  try {
    dsh = await startDshInstance({ label: 'pending-restart', pluginSpec: 'dsh-sooyo@0.3.0', registry: registry.origin, bundleManaged: true, hmr: false })
    await seed(dsh)
    await openSooyoInDsh(page, dsh)
    registry.publish('0.3.1')
    await checkAndOpen(page, '0.3.1')
    await page.getByRole('button', { name: '升级到 0.3.1', exact: true }).click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__sooyoUpdateSession').snapshot().receipt?.outcome), { timeout: 90_000 }).toBe('restart-required')
    expect((await runtime(dsh)).build.version).toBe('0.3.0')
    expect((await runtime(dsh)).phase).toBe('running')
    await dsh.restart()
    expect((await runtime(dsh)).build.version).toBe('0.3.1')
    expect((await (await fetch(`${dsh.origin}/sooyo/daily`)).json()).tasks.filter((entry: any) => entry.title === '升级后必须保留的任务')).toHaveLength(1)
  } finally {
    await dsh?.stop()
    await registry.close()
  }
})
