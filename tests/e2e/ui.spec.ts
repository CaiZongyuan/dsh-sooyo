import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeExportChecksum, normalizeWidget } from '../../src/host/index.ts'
import { cleanupPackedTarball, openSooyoInDsh, startDshInstance, type DshInstance } from './dsh-fixture.ts'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCREENSHOT_DIR = process.env.SOOYO_SCREENSHOT_DIR || join(REPO_ROOT, 'test-results', 'screenshots')
mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function postJson<T = Record<string, any>>(origin: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(res.ok).toBeTruthy()
  return (await res.json()) as T
}

async function seedRichFixtures(origin: string): Promise<void> {
  const dailyRes = await fetch(`${origin}/sooyo/daily`)
  const daily = (await dailyRes.json()) as Record<string, any>
  const now = new Date().toISOString()

  const items = [
    {
      key: 'aihot-item-1',
      value: {
        id: 'aihot-item-1',
        sourceId: 'aihot',
        sourceLabel: 'AI 今日热榜',
        nativeId: '1',
        itemKind: 'article',
        title: 'DeepSeek-V3.2 架构解析：多头潜在注意力与低成本长上下文推理',
        summary: '深入拆解 MLA 在推理显存与吞吐上的优势，以及如何在本地工作站部署高并发 Agent 服务。',
        reason: '入选今日精选：工程落地详实',
        url: 'https://example.com/deepseek-mla',
        publishedAt: now,
        discoveredAt: now,
        score: 96,
        category: 'tech',
        origin: 'AIHOT',
        tags: ['LLM', 'Inference', 'Agent'],
      },
    },
    {
      key: 'aihot-item-2',
      value: {
        id: 'aihot-item-2',
        sourceId: 'aihot',
        sourceLabel: 'AI 今日热榜',
        nativeId: '2',
        itemKind: 'article',
        title: 'Local-First 软件设计：基于两阶段意图日志与单写者队列的状态同步',
        summary: '结合 SQLite/JSON 存储域与幂等键，在不引入 CRDT 复杂度的前提下实现多端强一致同步。',
        url: 'https://example.com/local-first-sync',
        publishedAt: now,
        discoveredAt: now,
        score: 91,
        category: 'engineering',
        origin: 'HackerNews',
        tags: ['Sync', 'Architecture'],
      },
    },
    {
      key: 'hf-paper-1',
      value: {
        id: 'hf-paper-1',
        sourceId: 'hf-papers',
        sourceLabel: 'HuggingFace 每日论文',
        nativeId: '2611.01234',
        itemKind: 'article',
        title: 'Reversible Agent Proposals: Safe Human-in-the-Loop Workspace Evolution',
        summary: 'We present a formal dry-run diff and inverse-step rollback protocol for autonomous workspace agents.',
        tldr: '通过干跑预览与逆操作步骤实现可一键回滚的 Agent 提案机制。',
        url: 'https://huggingface.co/papers/2611.01234',
        publishedAt: now,
        discoveredAt: now,
        score: 88,
        category: 'paper',
        origin: 'HuggingFace',
        tags: ['Agents', 'HCI'],
        metrics: { upvotes: 142, comments: 19, stars: 680 },
      },
    },
  ]

  const prunedItemId = 'aihot-pruned-999'
  const readlater = [
    {
      key: prunedItemId,
      value: {
        itemId: prunedItemId,
        addedAt: now,
        snapshot: {
          id: prunedItemId,
          sourceId: 'aihot',
          sourceLabel: 'AI 今日热榜',
          title: '【离线快照】即使原条目被清理也能完整显示的深度长文：分布式存储引擎设计',
          summary: '验证 Slice 3 自包含快照（readLaterEntries）：原 items 表已无此记录，但阅读看板仍能正常渲染标题与来源。',
          url: 'https://example.com/pruned-article',
          origin: 'AIHOT Archive',
          publishedAt: now,
        },
      },
    },
  ]

  const unknownWidget = normalizeWidget({
    id: 'w-future-01',
    type: 'timeline2028',
    boardId: 'home',
    size: 'M',
    title: '未来时间线 (v2028)',
    settings: { futureMode: 'quantum', zoom: 3 },
  })

  const home12 = daily.layouts?.home?.[12] ?? []
  const home6 = daily.layouts?.home?.[6] ?? home12
  const home4 = daily.layouts?.home?.[4] ?? home12

  const withFuture = (order: Array<{ id: string; size: string }>) => {
    const filtered = order.filter((entry) => entry.id !== 'w-future-01')
    return [...filtered.slice(0, 4), { id: 'w-future-01', size: 'M' }, ...filtered.slice(4)]
  }

  const tables = {
    items,
    readlater,
    widgets: [{ key: 'w-future-01', value: unknownWidget }],
    layouts: [
      { key: 'home-12', value: { boardId: 'home', cols: 12, order: withFuture(home12) } },
      { key: 'home-6', value: { boardId: 'home', cols: 6, order: withFuture(home6) } },
      { key: 'home-4', value: { boardId: 'home', cols: 4, order: withFuture(home4) } },
    ],
  }

  const document = {
    kind: 'sooyo-export',
    exportVersion: 1,
    mode: 'backup',
    checksum: computeExportChecksum(tables),
    generatedAt: now,
    source: { device: 'e2e-seed', role: 'standalone', dataRevision: 1, domainVersion: 1 },
    tables,
  }

  const importRes = await postJson(origin, '/sooyo/import', {
    document,
    apply: true,
    overwrite: true,
  })
  expect(importRes.ok).toBe(true)

  const resizeRes = await postJson(origin, '/sooyo/action', {
    name: 'widget.resize',
    body: { boardId: 'home', cols: 12, id: 'w-home-inbox', size: 'M' },
  })
  expect(resizeRes.ok).toBe(true)

  const propRes = await postJson(origin, '/sooyo/action', {
    name: 'proposal.create',
    body: {
      reason: '创建「架构演进」看板并添加跟进任务（点击批准后可测试一键撤销）',
      evidenceRefs: ['note:n-1'],
      operations: [
        { name: 'board.create', body: { name: '架构演进', icon: 'spark' } },
        { name: 'task.add', body: { title: '整理架构演进路线图', list: 'today' } },
      ],
    },
  })
  expect(propRes.ok).toBe(true)
}

async function measureBentoLayout(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.sy-root')
    const pageEl = document.querySelector('.sy-page')
    const frame = document.querySelector('.sy-frame')
    const cols = frame ? Number(frame.getAttribute('data-cols') || 0) : 0
    const cards = Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map((el) => {
      const body = el.querySelector('.sy-w-b')
      const titleEl = el.querySelector('.sy-w-t b')
      const title = titleEl?.textContent || el.getAttribute('data-id') || '?'
      const ovY = body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0
      const ovX = body ? Math.max(0, body.scrollWidth - body.clientWidth) : 0
      return {
        id: el.getAttribute('data-id'),
        title: title.trim(),
        ovY,
        ovX,
      }
    })
    const maxOvY = cards.reduce((m, c) => Math.max(m, c.ovY), 0)
    const offenders = cards.filter((c) => c.ovY > 1).map((c) => `${c.title}(${c.id}):ov=${c.ovY}`)
    const horizOverflow = pageEl ? Math.max(0, pageEl.scrollWidth - pageEl.clientWidth) : 0
    return {
      theme: root?.getAttribute('data-theme') || 'unknown',
      cols,
      cardCount: cards.length,
      maxOvY,
      offenders,
      horizOverflow,
      cards,
    }
  })
}

test.describe('Sooyo Real DSH + Playwright E2E & Visual Verification', () => {
  let dsh: DshInstance | null = null

  test.beforeAll(async () => {
    dsh = await startDshInstance({ label: 'ui-standalone' })
    await seedRichFixtures(dsh.origin)
  })

  test.afterAll(async () => {
    if (dsh) await dsh.stop()
    cleanupPackedTarball()
  })

  test('E2E-1, E2E-2, E2E-3, E2E-5: Real DSH install, UI interactions, Proposal rollback, persistence across restart, and Desktop/Mobile visual checks', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme: 'light' })
    await openSooyoInDsh(page, dsh!)
    await page.waitForTimeout(350)

    const tabs = await page.locator('.sy-seg-boards [data-act="board"]').allInnerTexts()
    expect(tabs.map((t) => t.trim())).toEqual(expect.arrayContaining(['总览', '工作', '生活', '阅读']))

    const unknownCardText = await page.locator('.sy-w[data-id="w-future-01"]').innerText()
    expect(unknownCardText).toContain('暂不支持的组件类型')
    expect(unknownCardText).toContain('timeline2028')

    const desktopLight = await measureBentoLayout(page)
    expect(desktopLight.cols).toBe(12)
    expect(desktopLight.maxOvY, `Desktop 1440 light offenders: ${desktopLight.offenders.join(', ')}`).toBeLessThanOrEqual(
      1,
    )
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-desktop-1440-light.png') })

    const captureInput = page.locator('.sy-w[data-id="w-home-capture"] input[name="t"]')
    await captureInput.fill('真实 DSH E2E 创建的待办事项')
    await captureInput.press('Enter')
    await expect(page.locator('.sy-w[data-id="w-home-capture"]')).toContainText('收件箱 1')

    await captureInput.fill('#note 真实 DSH E2E 随手记内容')
    await captureInput.press('Enter')
    await expect(page.locator('.sy-w[data-id="w-home-capture"]')).toContainText('真实 DSH E2E 随手记内容')

    await page.locator('.sy-seg-boards [data-act="board"][data-board="work"]').click()
    const workTaskCard = page.locator('.sy-w[data-id="w-work-task"]')
    await expect(workTaskCard).toContainText('真实 DSH E2E 创建的待办事项')
    await workTaskCard.locator('[data-act="task-today"]').first().click()
    await page.locator('.sy-seg-boards [data-act="board"][data-board="home"]').click()
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('真实 DSH E2E 创建的待办事项')

    const inboxCard = page.locator('.sy-w[data-id="w-home-inbox"]')
    await expect(inboxCard).toContainText('创建「架构演进」看板并添加跟进任务')
    await expect(inboxCard).toContainText('处变更')

    await inboxCard.locator('[data-act="proposal-approve"]').click()
    await expect(page.locator('.sy-seg-boards')).toContainText('架构演进')

    await page.locator('.sy-seg-boards [data-act="board"][data-board="home"]').click()
    await expect(inboxCard).toContainText('已执行')
    await expect(inboxCard.locator('[data-act="proposal-rollback"]')).toBeVisible()
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-desktop-1440-after-approve.png') })

    await inboxCard.locator('[data-act="proposal-rollback"]').click()
    await expect(inboxCard).toContainText('已撤销')
    const tabsAfterRollback = await page.locator('.sy-seg-boards [data-act="board"]').allInnerTexts()
    expect(tabsAfterRollback.map((t) => t.trim())).not.toContain('架构演进')

    await page.locator('.sy-seg-boards [data-act="board"][data-board="read"]').click()
    await expect(page.locator('.sy-w[data-id="w-read-later"]')).toContainText('即使原条目被清理也能完整显示的深度长文')
    const readLayout = await measureBentoLayout(page)
    expect(readLayout.maxOvY, `Read board offenders: ${readLayout.offenders.join(', ')}`).toBeLessThanOrEqual(1)

    await page.locator('.sy-seg-boards [data-act="board"][data-board="home"]').click()
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('真实 DSH E2E 创建的待办事项')

    // Test Hero quick-capture of a GitHub Star URL into Collection
    const heroInput = page.locator('form[data-form="hero-capture"] input[name="hero-q"]')
    await heroInput.fill('https://github.com/woniuniuniu/dsh-media-desk')
    await heroInput.press('Enter')
    await expect(page.locator('.sy-home-dock')).toContainText('灵感与收藏墙')

    // Navigate to 内容 (Content View)
    await page.locator('.sy-app-nav [data-act="app-view"][data-view="content"]').click()
    await expect(page.locator('div[data-view="content"]')).toBeVisible()
    await expect(page.locator('div[data-view="content"]')).toContainText('dsh-media-desk')
    await expect(page.locator('div[data-view="content"]')).toContainText('真实 DSH E2E 随手记内容')
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-desktop-1440-content.png') })

    // Navigate to 排期 (Schedule View)
    await page.locator('.sy-app-nav [data-act="app-view"][data-view="schedule"]').click()
    await expect(page.locator('div[data-view="schedule"]')).toBeVisible()
    await expect(page.locator('div[data-view="schedule"]')).toContainText('真实 DSH E2E 创建的待办事项')
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-desktop-1440-schedule.png') })

    // Navigate to 复盘 (Retro View) and save a personal reflection
    await page.locator('.sy-app-nav [data-act="app-view"][data-view="retro"]').click()
    await expect(page.locator('div[data-view="retro"]')).toBeVisible()
    await page.locator('textarea[name="retro-highlights"]').fill('完成了灵感墙、收藏库、排期日历与个人复盘四大视图')
    await page.locator('button[data-act="retro-save"]').click()
    await expect(page.locator('.sy-toast')).toContainText('个人复盘')
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-desktop-1440-retro.png') })

    // Return to 首页 (Home View)
    await page.locator('.sy-app-nav [data-act="app-view"][data-view="home"]').click()
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('真实 DSH E2E 创建的待办事项')
    await page.evaluate(() => {
      document.querySelector('.sy-topbar')?.scrollIntoView({ block: 'start' })
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollTop > 0) el.scrollTop = 0
      }
      window.scrollTo(0, 0)
    })

    await page.locator('button[aria-label="切换浅色或深色"]').click()
    await page.waitForTimeout(250)
    const desktopDark = await measureBentoLayout(page)
    expect(desktopDark.maxOvY, `Desktop 1440 dark offenders: ${desktopDark.offenders.join(', ')}`).toBeLessThanOrEqual(
      1,
    )
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-desktop-1440-dark.png') })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(350)
    const mobileDark = await measureBentoLayout(page)
    expect(mobileDark.cols).toBe(4)
    expect(mobileDark.maxOvY, `Mobile 390 dark offenders: ${mobileDark.offenders.join(', ')}`).toBeLessThanOrEqual(1)
    expect(mobileDark.horizOverflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-mobile-390-dark.png') })

    await page.locator('button[aria-label="切换浅色或深色"]').click()
    await page.waitForTimeout(250)
    const mobileLight = await measureBentoLayout(page)
    expect(mobileLight.cols).toBe(4)
    expect(mobileLight.maxOvY, `Mobile 390 light offenders: ${mobileLight.offenders.join(', ')}`).toBeLessThanOrEqual(1)
    expect(mobileLight.horizOverflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dsh-mobile-390-light.png') })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openSooyoInDsh(page, dsh!)
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('真实 DSH E2E 创建的待办事项')

    await dsh!.restart()
    await openSooyoInDsh(page, dsh!)
    await expect(page.locator('.sy-w[data-id="w-home-task"]')).toContainText('真实 DSH E2E 创建的待办事项')
    await expect(page.locator('.sy-w[data-id="w-home-capture"]')).toContainText('真实 DSH E2E 随手记内容')

    expect(pageErrors).toEqual([])
  })
})
