// Measure the mobile layout headlessly, via the Chrome DevTools Protocol.
//
// `agent-browser` hung on this machine, and a screenshot alone cannot tell me *why* the board
// strip collapses. CDP gives the computed geometry: which box is 0-height, which element
// overflows, and what the container query actually resolved to.
//
// Uses only Node built-ins plus the local Chrome; no dependency is added to the package.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
]
const chromePath = CHROME_CANDIDATES.find((path) => existsSync(path))
if (!chromePath) throw new Error('Chrome not found')

// `new URL(...).pathname` keeps a leading slash on Windows ("/D:/..."), which `existsSync` and
// Chrome's file:// both reject. fileURLToPath yields the native path.
const harnessPath = fileURLToPath(new URL('./mobile-harness.html', import.meta.url))
if (!existsSync(harnessPath)) throw new Error('run dev/mobile-harness.mjs first')

const userDataDir = join(process.env.TEMP, `sooyo-cdp-${Date.now()}`)
mkdirSync(userDataDir, { recursive: true })

const WIDTH = Number(process.argv[2] ?? 390)
const HEIGHT = Number(process.argv[3] ?? 844)

const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  `--window-size=${WIDTH},${HEIGHT}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(path) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:9223${path}`)
      if (response.ok) return await response.json()
    } catch { /* not up yet */ }
    await sleep(250)
  }
  throw new Error(`CDP ${path} unreachable`)
}

const targets = await getJson('/json/list')
const page = targets.find((entry) => entry.type === 'page')
if (!page) throw new Error('no page target')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let nextId = 1
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  }
})

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true,
})
await send('Page.navigate', { url: `file:///${harnessPath.replace(/^\/+/, '')}` })
await sleep(900)

const expression = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      w: round(r.width), h: round(r.height), top: round(r.top), left: round(r.left),
      scrollW: el.scrollWidth, clientW: el.clientWidth,
      overflowX: cs.overflowX, flex: cs.flex, minWidth: cs.minWidth, flexBasis: cs.flexBasis,
      display: cs.display, position: cs.position, zIndex: cs.zIndex,
    }
  }
  const q = (sel) => box(document.querySelector(sel))
  const vis = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }

  // Which elements stick out past the viewport horizontally?
  const offenders = []
  for (const el of document.querySelectorAll('.sy-root *')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 60),
        left: round(r.left), right: round(r.right), w: round(r.width),
        over: round(r.right - window.innerWidth),
      })
    }
  }

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    frame: q('.sy-frame'),
    frameCols: document.querySelector('.sy-frame')?.dataset.cols,
    topbar: q('.sy-topbar'),
    brand: q('.sy-brand'),
    seg: q('.sy-seg'),
    segButtons: [...document.querySelectorAll('.sy-seg button')].map((b) => {
      const r = b.getBoundingClientRect()
      return { text: b.textContent.trim().slice(0, 8), w: round(r.width), h: round(r.height), top: round(r.top), visible: r.height > 2 }
    }),
    cmd: q('.sy-cmd'),
    actions: q('.sy-actions'),
    hero: q('.sy-hero'),
    tag: q('.sy-tag'),
    headline: q('.sy-headline'),
    status: q('.sy-status'),
    statusVisible: vis('.sy-status'),
    overflowOffenders: offenders.slice(0, 12),
    bodyScrollW: document.body.scrollWidth,
    bodyScrollH: document.body.scrollHeight,
  }
})()`

const result = await send('Runtime.evaluate', { expression, returnByValue: true })
console.log(JSON.stringify(result.result.value, null, 2))

// A screenshot to eyeball, at the same metrics.
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
writeFileSync(join(process.env.TEMP, `sooyo-${WIDTH}.png`), Buffer.from(shot.data, 'base64'))
console.log(`screenshot: ${join(process.env.TEMP, `sooyo-${WIDTH}.png`)}`)

socket.close()
chrome.kill()
await sleep(300)
