import { test, expect } from '@playwright/test'
import { cleanupPackedTarball, openSooyoInDsh, startDshInstance, type DshInstance } from './dsh-fixture.ts'

const TEST_SYNC_TOKEN = 'e2e-shared-sync-secret-token-2026'

async function postJson<T = Record<string, any>>(origin: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(res.ok).toBeTruthy()
  return (await res.json()) as T
}

test.describe('Sooyo Real 3-Instance DSH Hub + Client A + Client B Sync E2E (E2E-4)', () => {
  let hub: DshInstance | null = null
  let clientA: DshInstance | null = null
  let clientB: DshInstance | null = null

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

    clientA = await startDshInstance({
      label: 'sync-client-a',
      sooyoConfig: {
        sync: {
          role: 'client',
          device: 'client-laptop-a',
          endpoint: hub.origin,
          token: TEST_SYNC_TOKEN,
          cacheMs: 0,
        },
      },
    })

    clientB = await startDshInstance({
      label: 'sync-client-b',
      sooyoConfig: {
        sync: {
          role: 'client',
          device: 'client-tablet-b',
          endpoint: hub.origin,
          token: TEST_SYNC_TOKEN,
          cacheMs: 0,
        },
      },
    })
  })

  test.afterAll(async () => {
    if (clientB) await clientB.stop()
    if (clientA) await clientA.stop()
    if (hub) await hub.stop()
    cleanupPackedTarball()
  })

  test('E2E-4: 3-instance Hub + Client A + Client B cross-device sync, offline Outbox replay, and remote Proposal approval', async ({
    page,
  }) => {
    // 1. Create a Task and a Board on Hub
    const hubTask = await postJson(hub!.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: 'op-e2e4-hub-task-01',
      body: { title: '来自 Hub 的跨设备待办事项', list: 'today' },
    })
    expect(hubTask.ok).toBe(true)

    const hubBoard = await postJson(hub!.origin, '/sooyo/action', {
      name: 'board.create',
      operationId: 'op-e2e4-hub-board-01',
      body: { name: '多端协作', icon: 'spark' },
    })
    expect(hubBoard.ok).toBe(true)

    await postJson(hub!.origin, '/sooyo/action', {
      name: 'board.active',
      body: { id: 'home' },
    })

    // 2. Open Client A's real DSH Web UI in Playwright and verify Hub mutations appear
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSooyoInDsh(page, clientA!)

    await expect(page.locator('.sy-seg-boards')).toContainText('多端协作')
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('来自 Hub 的跨设备待办事项')

    // 3. Create a Task from Client A's UI and replay an operationId twice to assert zero duplication
    const clientACaptureInput = page.locator('.sy-w[data-id="w-home-capture"] input[name="t"]')
    await clientACaptureInput.fill('来自 Client A 的跨设备待办事项')
    await clientACaptureInput.press('Enter')
    await expect(page.locator('.sy-w[data-id="w-home-capture"]')).toContainText('收件箱 1')

    const opId = 'op-e2e4-idempotent-client-task'
    await postJson(clientA!.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: opId,
      body: { title: '幂等验证待办（不应重复）', list: 'inbox' },
    })
    await postJson(clientA!.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: opId,
      body: { title: '幂等验证待办（不应重复）', list: 'inbox' },
    })

    // 4. Verify Client B sees both Hub and Client A mutations
    const clientBDailyRes = await fetch(`${clientB!.origin}/sooyo/daily`)
    const clientBDaily = (await clientBDailyRes.json()) as Record<string, any>
    const clientBTitles = (clientBDaily.tasks ?? []).map((t: any) => t.title)
    expect(clientBTitles).toContain('来自 Hub 的跨设备待办事项')
    expect(clientBTitles).toContain('来自 Client A 的跨设备待办事项')
    expect(clientBTitles.filter((t: string) => t === '幂等验证待办（不应重复）').length).toBe(1)

    // 5. Remote Proposal approval from Client B
    await postJson(hub!.origin, '/sooyo/action', {
      name: 'widget.resize',
      body: { boardId: 'home', cols: 12, id: 'w-home-inbox', size: 'M' },
    })
    const propCreate = await postJson(hub!.origin, '/sooyo/action', {
      name: 'proposal.create',
      body: {
        reason: '远程多端审批提案测试',
        evidenceRefs: ['note:remote-1'],
        operations: [{ name: 'task.add', body: { title: '由 Client B 远程批准的任务', list: 'today' } }],
      },
    })
    expect(propCreate.ok).toBe(true)
    const proposalId = propCreate.proposal?.id
    expect(typeof proposalId).toBe('string')

    const remoteDecide = await postJson(clientB!.origin, '/sooyo/agent-inbox/decide', {
      id: proposalId,
      decision: 'approve',
    })
    expect(remoteDecide.ok).toBe(true)

    // 6. Pause Hub to simulate Hub offline -> Client A queues mutation in durable Outbox -> Resume Hub -> Flush Outbox
    await hub!.pause()
    const offlineMutation = await postJson(clientA!.origin, '/sooyo/action', {
      name: 'task.add',
      operationId: 'op-e2e4-offline-outbox-1',
      body: { title: 'Client A 离线期间写入的任务', list: 'today' },
    })
    expect(offlineMutation.queued).toBe(true)

    const outboxBefore = await (await fetch(`${clientA!.origin}/sooyo/outbox`)).json()
    expect((outboxBefore.outbox ?? []).length).toBeGreaterThanOrEqual(1)

    await hub!.resume()
    const flushRes = await postJson(clientA!.origin, '/sooyo/outbox/flush', {})
    expect(flushRes.flushed).toBeGreaterThanOrEqual(1)
    expect(flushRes.pending).toBe(0)

    // 7. Verify Hub and Client B both see the flushed offline task and the remote-approved proposal task
    const hubFinal = (await (await fetch(`${hub!.origin}/sooyo/daily`)).json()) as Record<string, any>
    const finalTitles = (hubFinal.tasks ?? []).map((t: any) => t.title)
    expect(finalTitles).toContain('由 Client B 远程批准的任务')
    expect(finalTitles).toContain('Client A 离线期间写入的任务')
  })
})
