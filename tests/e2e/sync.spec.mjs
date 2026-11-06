import { test, expect } from '@playwright/test'
import { cleanupPackedTarball, openSooyoInDsh, startDshInstance } from './dsh-fixture.mjs'

const TEST_SYNC_TOKEN = 'e2e-shared-sync-secret-token-2026'

async function postJson(origin, path, body) {
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(res.ok).toBeTruthy()
  return res.json()
}

test.describe('Sooyo Real DSH Hub + Client Sync E2E (E2E-4)', () => {
  let hub = null
  let client = null

  test.beforeAll(async () => {
    hub = await startDshInstance({
      label: 'sync-hub',
      sooyoConfig: {
        sync: {
          role: 'hub',
          device: 'hub-primary',
          tokens: [TEST_SYNC_TOKEN],
        },
      },
    })

    client = await startDshInstance({
      label: 'sync-client',
      sooyoConfig: {
        sync: {
          role: 'client',
          device: 'client-laptop',
          endpoint: hub.origin,
          token: TEST_SYNC_TOKEN,
          cacheMs: 0,
        },
      },
    })
  })

  test.afterAll(async () => {
    if (client) await client.stop()
    if (hub) await hub.stop()
    cleanupPackedTarball()
  })

  test('E2E-4: Mutations on Hub A are visible in Client B UI, and Client B mutations sync back to Hub A without duplicates', async ({ page }) => {
    // 1. Create a Task and a Board on Hub A
    const hubTask = await postJson(hub.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: 'op-e2e4-hub-task-01',
      body: { title: '来自 Hub A 的跨设备待办事项', list: 'today' },
    })
    expect(hubTask.ok).toBe(true)

    const hubBoard = await postJson(hub.origin, '/sooyo/action', {
      name: 'board.create',
      operationId: 'op-e2e4-hub-board-01',
      body: { name: '多端协作', icon: 'spark' },
    })
    expect(hubBoard.ok).toBe(true)

    // Switch Hub active board back to `home` so default view is `home`
    await postJson(hub.origin, '/sooyo/action', {
      name: 'board.active',
      body: { id: 'home' },
    })

    // 2. Open Client B's real DSH Web UI in Playwright and verify both Hub mutations appear
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSooyoInDsh(page, client)

    await expect(page.locator('.sy-seg-boards')).toContainText('多端协作')
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('来自 Hub A 的跨设备待办事项')

    // 3. Create a Task from Client B's UI and replay the same operationId to assert zero duplication
    const clientCaptureInput = page.locator('.sy-w[data-id="w-home-capture"] input[name="t"]')
    await clientCaptureInput.fill('来自 Client B 的跨设备待办事项')
    await clientCaptureInput.press('Enter')
    await expect(page.locator('.sy-w[data-id="w-home-capture"]')).toContainText('收件箱 1')

    // Replay an explicit operationId against Client B twice
    const opId = 'op-e2e4-idempotent-client-task'
    await postJson(client.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: opId,
      body: { title: '幂等验证待办（不应重复）', list: 'inbox' },
    })
    await postJson(client.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: opId,
      body: { title: '幂等验证待办（不应重复）', list: 'inbox' },
    })

    // 4. Verify Hub A has all tasks and exactly 1 copy of the idempotent task
    const hubDailyRes = await fetch(`${hub.origin}/sooyo/daily`)
    const hubDaily = await hubDailyRes.json()
    const titles = hubDaily.tasks.map((t) => t.title)
    expect(titles).toContain('来自 Hub A 的跨设备待办事项')
    expect(titles).toContain('来自 Client B 的跨设备待办事项')
    expect(titles.filter((t) => t === '幂等验证待办（不应重复）').length).toBe(1)
  })
})
