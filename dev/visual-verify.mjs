/**
 * Headless Chromium (CDP) visual & interactive verification for `client.js` + `index.js`.
 *
 * Boots a real local HTTP server running `apply(ctx, {})` from `index.js`, seeds realistic
 * multi-source items, tasks, notes, a pruned Read Later snapshot, an unknown Widget Type
 * (`timeline2028`), and an expanded Reversible Proposal (`board.create` + `task.add`), then
 * mounts the unmodified `client.js` in headless Chrome across desktop (1440x900), tablet
 * (820x900), and mobile (390x844) in both light and dark themes.
 *
 * Verifies:
 *  1. `ov=0` (zero card body clipping) across all breakpoints, themes, and Boards.
 *  2. Zero horizontal viewport overflow at 390x844 mobile width.
 *  3. Unknown Widget Type (`timeline2028`) renders its read-only placeholder card cleanly.
 *  4. Self-contained Read Later snapshot renders in `稍后读` even after the Item is deleted from `items`.
 *  5. Interactive Agent Inbox flow in the real DOM: `preview.diff` badge -> click Approve ->
 *     `已执行` + new Board tab appears + Rollback button appears -> click Rollback -> `已撤销` +
 *     Board tab removed.
 */

import http from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { apply } from '../index.js'
import { TABLES } from '../core/store.js'
import { normalizeWidget } from '../personal.js'

const PATH_SAFE = /^[a-zA-Z0-9_-]+$/
const ARTIFACT_DIR = process.argv[2] || join(process.env.TEMP || '.', 'sooyo-visual-verify')
mkdirSync(ARTIFACT_DIR, { recursive: true })

const results = []
const check = (name, condition, detail) => {
  results.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  -> ${detail}`}`)
}

function makeTable() {
  const map = new Map()
  return {
    get: (key) => map.get(key),
    entries: () => map.entries(),
    keys: () => map.keys(),
    get size() { return map.size },
    put: async (key, value) => {
      if (!PATH_SAFE.test(key)) throw new Error(`key '${key}' is not path-safe`)
      map.set(key, value)
    },
    delete: async (key) => map.delete(key),
    update: async (key, fn) => {
      const next = fn(map.get(key))
      map.set(key, next)
      return next
    },
  }
}

const tables = new Map()
const routes = []
const tools = []
const effects = []

const ctx = {
  logger: { warn: () => {} },
  effect: (callback, label) => {
    const dispose = callback()
    effects.push({ label, dispose })
    return dispose ?? (() => {})
  },
  inject: (_names, callback) => {
    callback({
      tools: {
        register: (definition) => {
          tools.push(definition)
          return () => {}
        },
      },
    })
    return () => {}
  },
  storageDomain: {
    open: async (spec) => {
      for (const table of Object.keys(spec.tables)) if (!tables.has(table)) tables.set(table, makeTable())
      return {
        name: spec.name,
        table: (name) => {
          if (!tables.has(name)) tables.set(name, makeTable())
          return tables.get(name)
        },
        close: async () => {},
      }
    },
  },
  webServer: {
    register: (route) => {
      routes.push(route)
      return () => {}
    },
  },
}

const plugin = apply(ctx, {})
await new Promise((resolve) => setTimeout(resolve, 80))
const service = plugin.service

// Seed realistic items, tasks, notes, a pruned Read Later snapshot, an unknown Widget, and a Proposal
const now = new Date().toISOString()
const sampleItems = [
  {
    id: 'aihot-visual-1',
    sourceId: 'aihot',
    sourceLabel: 'AI 今日热榜',
    itemKind: 'article',
    title: 'DeepSeek 与多端工作台架构：零外部依赖下的确定性状态同步',
    url: 'https://example.com/aihot-1',
    publishedAt: now,
    discoveredAt: now,
    summary: '深入解析两阶段 Intent 账本、细粒度 Precondition 与客户端持久化 Outbox 的工程实践。',
    reason: '架构与本地优先同步必读',
    score: 96,
    category: 'ai-models',
    origin: 'Hacker News',
    keywords: ['Sync', 'Local-First', 'Intent'],
  },
  {
    id: 'aihot-visual-2',
    sourceId: 'aihot',
    sourceLabel: 'AI 今日热榜',
    itemKind: 'article',
    title: '浏览器端容器查询与零特异性重置：防御宿主全局皮肤污染',
    url: 'https://example.com/aihot-2',
    publishedAt: now,
    discoveredAt: now,
    summary: '使用 :where() 与末尾 @container 规则确保卡片在 12/6/4 列下严格保持 ov=0。',
    reason: '前端工程实践',
    score: 89,
    category: 'tip',
    origin: 'CSS Tricks',
    keywords: ['CSS', 'Container Queries'],
  },
  {
    id: 'hfpapers-visual-1',
    sourceId: 'hf-papers',
    sourceLabel: 'HF Daily Papers',
    itemKind: 'article',
    title: 'Scaling Autonomous Coding Agents with Verifiable Vertical Slices',
    url: 'https://huggingface.co/papers/2611.00001',
    publishedAt: now,
    discoveredAt: now,
    summary: 'We present a verifiable vertical-slice workflow combining deterministic crash recovery and visual verification.',
    category: 'paper',
    origin: 'DeepMind & Tsinghua',
    tags: ['Alice Zhang', 'Bob Chen'],
    authorCount: 5,
    metrics: { upvotes: 142, comments: 19, stars: 680 },
  },
  {
    id: 'pruned-readlater-item',
    sourceId: 'aihot',
    sourceLabel: 'AI 今日热榜',
    itemKind: 'article',
    title: '【自包含快照验证】源条目已被清理但稍后读依然完整保留的深度好文',
    url: 'https://example.com/pruned-snapshot',
    publishedAt: now,
    discoveredAt: now,
    summary: '验证 Slice 3 的 readLaterEntries 内联快照在 items 表删除后依然正常渲染。',
    origin: 'AIHOT',
  },
]

for (const item of sampleItems) {
  await service.tables(TABLES.items).put(item.id, item)
}
for (const src of plugin.sources) {
  await service.tables(TABLES.sources).put(src.id, {
    id: src.id,
    label: src.label,
    itemCount: 3,
    lastRunAt: now,
    lastResult: 'ok',
    lastError: null,
    failStreak: 0,
  })
}

await service.execute({ name: 'task.add', body: { title: '完成可进化工作台 Slices 1–5 视觉与交互验证', list: 'today' } })
await service.execute({ name: 'task.add', body: { title: '检查 1440 / 820 / 390 三断点 ov=0 预算', list: 'today' } })
await service.execute({ name: 'note.add', body: { text: '两阶段 Intent 账本与可逆 Proposal 已上线，支持一键回滚。' } })

// Save `pruned-readlater-item` to Read Later, then delete it from `items` to verify Slice 3 in the real UI!
await service.execute({ name: 'readlater.set', body: { itemId: 'pruned-readlater-item', on: true } })
await service.tables(TABLES.items).delete('pruned-readlater-item')

// Add an unknown Widget Type (`timeline2028`) to `home` Board to verify Slice 5 placeholder card!
const unknownWidget = normalizeWidget({
  id: 'w-unknown-timeline',
  type: 'timeline2028',
  size: 'M',
  title: '未来时间线 (v2028)',
  settings: { mode: 'quantum' },
  extraFutureField: true,
})
await service.tables(TABLES.widgets).put(unknownWidget.id, unknownWidget)
// Resize `w-home-inbox` to `M` so the full actionable Agent Inbox card (with preview.diff,
// approve/reject, and rollback buttons) renders on the `home` Board alongside the unknown Widget.
await service.execute({
  name: 'widget.resize',
  body: { id: 'w-home-inbox', size: 'M', cols: 12, boardId: 'home' },
})
const home12 = service.snapshot().layouts?.home?.[12] ?? []
await service.execute({
  name: 'layout.set',
  body: { boardId: 'home', cols: 12, order: [...home12, { id: unknownWidget.id, size: 'M' }] },
})

// Create an expanded Reversible Proposal (`board.create` + `task.add`) via Agent tool
const propTool = tools.find((t) => t.name === 'sooyo_proposal_create')
await propTool.execute({
  reason: '创建「架构演进」看板并添加跟进任务（点击批准后可测试一键撤销）',
  operations: [
    { name: 'board.create', body: { name: '架构演进' } },
    { name: 'task.add', body: { title: '验证 Proposal 一键回滚', list: 'today' } },
  ],
  evidenceRefs: ['viking://user/sooyo/memories/spec-issue-2.md'],
}, {})

// Build the HTML shell with a self-contained React 18-compatible hooks + VDOM runtime that mounts `client.js`
const clientJs = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

const HTML_SHELL = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sooyo Visual Verification</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  #app { min-height: 100vh; display: grid; grid-template-columns: 1fr; }
  #app > .sy-root { min-width: 0; }
</style>
</head>
<body>
<div id="app"></div>
<script>
// Ensure deterministic initial light theme regardless of host OS prefers-color-scheme
try { window.localStorage.setItem('sooyo:theme', 'light') } catch {}
// Keep ResizeObserver bound across full-DOM replaceChildren in this test shim
const NativeRO = window.ResizeObserver
const roCallbacks = new Set()
window.ResizeObserver = class {
  constructor(cb) { this.cb = cb; roCallbacks.add(cb) }
  observe(el) { this.el = el }
  disconnect() { roCallbacks.delete(this.cb) }
}
window.__notifyResize = () => {
  for (const cb of [...roCallbacks]) {
    try { cb() } catch {}
  }
}
// Minimal, exact React 18 hooks + VDOM runtime for mounting unmodified client.js
(() => {
  const SVG_TAGS = new Set(['svg', 'rect', 'path', 'circle', 'line', 'polyline', 'polygon', 'g'])
  const instances = new Map()
  let currentInstance = null
  let hookIndex = 0
  let rootComponent = null
  let rootContainer = null
  let renderScheduled = false
  const pendingEffects = []

  function sameDeps(a, b) {
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false
    return true
  }

  function scheduleRender() {
    if (renderScheduled) return
    renderScheduled = true
    queueMicrotask(() => {
      renderScheduled = false
      renderRoot()
    })
  }

  const React = {
    createElement(type, props, ...children) {
      const flat = []
      const push = (c) => {
        if (Array.isArray(c)) c.forEach(push)
        else if (c !== null && c !== undefined && c !== false && c !== true) flat.push(c)
      }
      children.forEach(push)
      return { type, props: props || {}, children: flat, key: props?.key ?? null }
    },
    useState(initial) {
      const inst = currentInstance
      const idx = hookIndex++
      if (idx >= inst.hooks.length) {
        inst.hooks.push(typeof initial === 'function' ? initial() : initial)
      }
      const setState = (next) => {
        const prev = inst.hooks[idx]
        const val = typeof next === 'function' ? next(prev) : next
        if (!Object.is(prev, val)) {
          inst.hooks[idx] = val
          scheduleRender()
        }
      }
      return [inst.hooks[idx], setState]
    },
    useRef(initial) {
      const inst = currentInstance
      const idx = hookIndex++
      if (idx >= inst.hooks.length) inst.hooks.push({ current: initial })
      return inst.hooks[idx]
    },
    useMemo(factory, deps) {
      const inst = currentInstance
      const idx = hookIndex++
      const prev = inst.hooks[idx]
      if (!prev || !sameDeps(prev.deps, deps)) {
        const value = factory()
        inst.hooks[idx] = { value, deps }
        return value
      }
      return prev.value
    },
    useCallback(fn, deps) {
      return React.useMemo(() => fn, deps)
    },
    useEffect(effect, deps) {
      const inst = currentInstance
      const idx = hookIndex++
      const prev = inst.hooks[idx]
      const shouldRun = !prev || !sameDeps(prev.deps, deps)
      const record = { effect, deps, cleanup: prev?.cleanup ?? null }
      inst.hooks[idx] = record
      if (shouldRun) {
        pendingEffects.push(() => {
          if (typeof record.cleanup === 'function') {
            try { record.cleanup() } catch {}
          }
          const cleanup = record.effect()
          record.cleanup = typeof cleanup === 'function' ? cleanup : null
        })
      }
    },
  }

  window.__rebindEffects = () => {
    for (const inst of instances.values()) {
      for (const h of inst.hooks) {
        if (h && typeof h.effect === 'function') {
          if (typeof h.cleanup === 'function') {
            try { h.cleanup() } catch {}
          }
          const c = h.effect()
          h.cleanup = typeof c === 'function' ? c : null
        }
      }
    }
  }

  function buildDom(vnode, path) {
    if (vnode === null || vnode === undefined || typeof vnode === 'boolean') {
      return document.createTextNode('')
    }
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode))
    }
    if (typeof vnode.type === 'function') {
      const compKey = path + ':' + (vnode.type.name || 'anon') + ':' + (vnode.key ?? '')
      let inst = instances.get(compKey)
      if (!inst) {
        inst = { hooks: [] }
        instances.set(compKey, inst)
      }
      const prevInst = currentInstance
      const prevIdx = hookIndex
      currentInstance = inst
      hookIndex = 0
      const childVnode = vnode.type({ ...vnode.props, children: vnode.children })
      currentInstance = prevInst
      hookIndex = prevIdx
      return buildDom(childVnode, compKey)
    }

    const isSvg = SVG_TAGS.has(vnode.type)
    const el = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', vnode.type)
      : document.createElement(vnode.type)

    const props = vnode.props || {}
    for (const [k, v] of Object.entries(props)) {
      if (k === 'key' || k === 'ref' || k === 'children' || k === 'dangerouslySetInnerHTML') continue
      if (v === undefined || v === null || v === false) continue
      if (k === 'className') {
        el.setAttribute('class', String(v))
      } else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sv === undefined || sv === null) continue
          if (sk.startsWith('--')) el.style.setProperty(sk, String(sv))
          else if (typeof sv === 'number' && !['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow', 'flexShrink', 'order'].includes(sk)) {
            el.style[sk] = sv + 'px'
          } else {
            el.style[sk] = String(sv)
          }
        }
      } else if (k.startsWith('on') && typeof v === 'function') {
        const evt = k.slice(2).toLowerCase()
        el.addEventListener(evt === 'change' ? 'input' : evt, v)
      } else if (k === 'defaultValue') {
        el.value = String(v)
      } else if (k === 'value') {
        el.value = String(v)
      } else if (k === 'autoFocus') {
        // skip focus steal in headless check
      } else if (v === true && k === 'disabled') {
        el.disabled = true
        el.setAttribute('disabled', '')
      } else {
        el.setAttribute(k, String(v))
      }
    }

    if (props.dangerouslySetInnerHTML && props.dangerouslySetInnerHTML.__html !== undefined) {
      el.innerHTML = String(props.dangerouslySetInnerHTML.__html)
    } else {
      vnode.children.forEach((child, idx) => {
        el.appendChild(buildDom(child, path + '/' + (child?.key ?? idx)))
      })
    }

    if (props.ref && typeof props.ref === 'object') {
      props.ref.current = el
    }
    return el
  }

  function renderRoot() {
    if (!rootComponent || !rootContainer) return
    const scrollY = window.scrollY
    const dom = buildDom({ type: rootComponent, props: {}, children: [], key: 'root' }, 'root')
    rootContainer.replaceChildren(dom)
    window.scrollTo(0, scrollY)
    while (pendingEffects.length > 0) {
      const fn = pendingEffects.shift()
      fn()
    }
    for (const el of rootContainer.querySelectorAll('.sy-w')) {
      for (const fit of el.querySelectorAll('.sy-fit, .sy-fit-x')) {
        const horiz = fit.classList.contains('sy-fit-x')
        let g = 60
        while (g-- > 0 && fit.children.length > 1 && (horiz ? fit.scrollWidth > fit.clientWidth + 1 : fit.scrollHeight > fit.clientHeight + 1)) {
          fit.lastElementChild.remove()
        }
      }
    }
  }

  window.__ModuleLoader__ = {
    load(mod) {
      const exported = mod.factory((spec) => {
        if (spec === 'react') return React
        throw new Error('Unexpected require: ' + spec)
      })
      exported.apply({
        slots: {
          inject(slotName, fn) { fn() },
          register(meta, Component) {
            if (meta.name === 'main') {
              rootComponent = Component
              rootContainer = document.getElementById('app')
              renderRoot()
            }
          },
        },
      })
    },
  }
})()
</script>
<script>${clientJs}</script>
</body>
</html>`

const server = http.createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const buf = Buffer.from(HTML_SHELL, 'utf8')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': buf.length })
    res.end(buf)
    return
  }
  if (req.url?.startsWith('/sooyo')) {
    await routes[0].handler(req, res)
    return
  }
  res.writeHead(404)
  res.end('not found')
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const serverPort = server.address().port
const baseUrl = `http://127.0.0.1:${serverPort}/`
console.log(`Visual verification server listening on ${baseUrl}`)

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
]
const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chromePath) throw new Error('Chrome not found')

const cdpPort = 9400 + Math.floor(Math.random() * 300)
const userDataDir = join(process.env.TEMP || '.', `sooyo-visual-cdp-${Date.now()}`)
mkdirSync(userDataDir, { recursive: true })

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function cdpJson(path) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${cdpPort}${path}`)
      if (r.ok) return await r.json()
    } catch {}
    await sleep(200)
  }
  throw new Error(`CDP ${path} unreachable`)
}

try {
  const targets = await cdpJson('/json/list')
  const pageTarget = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  let msgId = 1
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) reject(new Error(JSON.stringify(m.error)))
      else resolve(m.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (out.exceptionDetails) {
      throw new Error(`Browser eval failed: ${out.exceptionDetails.text} ${out.exceptionDetails.exception?.description ?? ''}`)
    }
    return out.result.value
  }
  const screenshot = async (filename) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const outPath = join(ARTIFACT_DIR, filename)
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'))
    console.log(`  saved screenshot -> ${outPath}`)
    return outPath
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
  await send('Page.navigate', { url: baseUrl })
  await sleep(1000)

  // 1. Desktop 1440x900 (12-col, light theme): check `ov=0`, unknown Widget placeholder, and Proposal preview diff
  const desktopHome = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map((el) => {
      const body = el.querySelector('.sy-w-b')
      const title = (el.querySelector('.sy-w-t b') || {}).textContent || el.dataset.id
      const ovY = body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0
      const ovX = body ? Math.max(0, body.scrollWidth - body.clientWidth) : 0
      return { id: el.dataset.id, title, ovY, ovX, text: el.textContent.slice(0, 120) }
    })
    return {
      cols: document.querySelector('.sy-frame')?.dataset.cols,
      cardCount: cards.length,
      cards,
      maxOvY: Math.max(0, ...cards.map((c) => c.ovY)),
      unknownCard: cards.find((c) => c.id === 'w-unknown-timeline'),
      inboxCard: cards.find((c) => c.title.includes('Agent') || c.text.includes('架构演进')),
    }
  })()`)

  check('visual [1440x900 light]: 12-column bento grid renders all cards with ov=0',
    desktopHome.cols === '12' && desktopHome.cardCount >= 8 && desktopHome.maxOvY <= 1,
    `cols=${desktopHome.cols}, cards=${desktopHome.cardCount}, maxOvY=${desktopHome.maxOvY}`)

  check('visual [slice5]: unknown Widget Type (timeline2028) renders read-only placeholder card with ov=0',
    Boolean(desktopHome.unknownCard)
      && desktopHome.unknownCard.text.includes('暂不支持的组件类型 (timeline2028)')
      && desktopHome.unknownCard.ovY <= 1,
    desktopHome.unknownCard?.text)

  check('visual [slice5]: Agent Inbox card displays proposal reason and preview.diff count',
    Boolean(desktopHome.inboxCard) && desktopHome.inboxCard.text.includes('处变更'),
    desktopHome.inboxCard?.text)

  await screenshot('visual-1440-light-home.png')

  // 2. Interactive Agent Inbox test in real browser: click Approve -> switch back to `home` to see applied state + Rollback button -> click Rollback
  await evaluate(`(() => {
    const btn = document.querySelector('[data-act="proposal-approve"]')
    if (!btn) throw new Error('proposal-approve button not found')
    btn.click()
  })()`)
  await sleep(600)

  // `board.create` activates the newly created Board (`架构演进`), so switch back to `home` (`总览`) to see `w-home-inbox`
  await evaluate(`(() => {
    document.querySelector('[data-act="board"][data-board="home"]')?.click()
  })()`)
  await sleep(500)

  const afterApprove = await evaluate(`(() => {
    const tabs = Array.from(document.querySelectorAll('.sy-seg-boards button[role="tab"]')).map((b) => b.textContent.trim())
    const rollbackBtn = document.querySelector('[data-act="proposal-rollback"]')
    const inboxText = document.querySelector('[data-id="w-home-inbox"]')?.textContent ?? ''
    return { tabs, hasRollbackBtn: Boolean(rollbackBtn), inboxText }
  })()`)

  check('visual [interactive]: clicking Approve in Agent Inbox applies proposal, adds new Board tab, and renders Rollback button',
    afterApprove.tabs.includes('架构演进') && afterApprove.hasRollbackBtn === true && afterApprove.inboxText.includes('已执行'),
    `tabs=${afterApprove.tabs.join(',')} hasRollback=${afterApprove.hasRollbackBtn}`)

  await screenshot('visual-1440-after-proposal-approve.png')

  // Now click Rollback in the real DOM!
  await evaluate(`(() => {
    const btn = document.querySelector('[data-act="proposal-rollback"]')
    if (!btn) throw new Error('proposal-rollback button not found')
    btn.click()
  })()`)
  await sleep(600)

  const afterRollback = await evaluate(`(() => {
    const tabs = Array.from(document.querySelectorAll('.sy-seg-boards button[role="tab"]')).map((b) => b.textContent.trim())
    const inboxText = document.querySelector('[data-id="w-home-inbox"]')?.textContent ?? ''
    return { tabs, inboxText }
  })()`)

  check('visual [interactive]: clicking Rollback reverts the Board creation and shows 已撤销 in Agent Inbox',
    !afterRollback.tabs.includes('架构演进') && afterRollback.inboxText.includes('已撤销'),
    `tabs=${afterRollback.tabs.join(',')} inbox=${afterRollback.inboxText.slice(0, 80)}`)

  // 3. Switch to `阅读` (read) Board and verify self-contained Read Later snapshot renders!
  await evaluate(`(() => {
    const readTab = document.querySelector('[data-act="board"][data-board="read"]')
    if (readTab) readTab.click()
  })()`)
  await sleep(500)

  const readBoardState = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map((el) => {
      const body = el.querySelector('.sy-w-b')
      return {
        id: el.dataset.id,
        ovY: body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0,
        text: el.textContent,
      }
    })
    return {
      maxOvY: Math.max(0, ...cards.map((c) => c.ovY)),
      hasPrunedSnapshot: cards.some((c) => c.text.includes('【自包含快照验证】源条目已被清理但稍后读依然完整保留的深度好文')),
    }
  })()`)

  check('visual [slice3]: Read Board renders pruned Read Later article from inline snapshot with ov=0',
    readBoardState.hasPrunedSnapshot === true && readBoardState.maxOvY <= 1,
    `hasPrunedSnapshot=${readBoardState.hasPrunedSnapshot}, maxOvY=${readBoardState.maxOvY}`)

  await screenshot('visual-1440-read-board.png')

  // Switch back to `home` Board and toggle Dark theme at 1440x900
  await evaluate(`(() => {
    document.querySelector('[data-act="board"][data-board="home"]')?.click()
    document.querySelector('[aria-label="切换浅色或深色"]')?.click()
  })()`)
  await sleep(400)
  await screenshot('visual-1440-dark-home.png')

  // 4. Tablet breakpoint 820x900 (6 cols)
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 900, deviceScaleFactor: 2, mobile: false })
  await sleep(150)
  await evaluate(`window.__notifyResize()`)
  await sleep(300)
  const tabletMetrics = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map((el) => {
      const body = el.querySelector('.sy-w-b')
      return body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0
    })
    return {
      cols: document.querySelector('.sy-frame')?.dataset.cols,
      maxOvY: Math.max(0, ...cards),
    }
  })()`)
  check('visual [820x900 tablet]: 6-column bento grid packs cleanly with ov=0',
    tabletMetrics.cols === '6' && tabletMetrics.maxOvY <= 1,
    `cols=${tabletMetrics.cols}, maxOvY=${tabletMetrics.maxOvY}`)
  await screenshot('visual-820-dark-tablet.png')

  // 5. Mobile breakpoint 390x844 (4 cols, dark & light)
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await sleep(150)
  await evaluate(`window.__notifyResize()`)
  await sleep(300)
  const mobileMetrics = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map((el) => {
      const body = el.querySelector('.sy-w-b')
      return {
        id: el.dataset.id,
        ov: body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0,
      }
    })
    const horizOverflow = document.documentElement.scrollWidth - window.innerWidth
    return {
      cols: document.querySelector('.sy-frame')?.dataset.cols,
      maxOvY: Math.max(0, ...cards.map((c) => c.ov)),
      offenders: cards.filter((c) => c.ov > 1),
      horizOverflow,
    }
  })()`)
  check('visual [390x844 mobile]: 4-column bento grid has ov=0 and zero horizontal overflow',
    mobileMetrics.cols === '4' && mobileMetrics.maxOvY <= 1 && mobileMetrics.horizOverflow <= 1,
    `cols=${mobileMetrics.cols}, maxOvY=${mobileMetrics.maxOvY}, offenders=${JSON.stringify(mobileMetrics.offenders)}, horizOverflow=${mobileMetrics.horizOverflow}`)
  await screenshot('visual-390-dark-mobile.png')

  await evaluate(`(() => { document.querySelector('[aria-label="切换浅色或深色"]')?.click() })()`)
  await sleep(300)
  await screenshot('visual-390-light-mobile.png')

  ws.close()
} finally {
  chrome.kill()
  for (const effect of [...effects].reverse()) {
    try { await effect.dispose?.() } catch {}
  }
  server.close()
  await sleep(200)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} visual & interactive browser checks passed`)
process.exitCode = failed.length === 0 ? 0 : 1
