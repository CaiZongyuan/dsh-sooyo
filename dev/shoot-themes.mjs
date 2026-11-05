// Final visual check: light and dark, phone width, with the grain node present.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find((p) => existsSync(p))
const harness = fileURLToPath(new URL('./mobile-harness.html', import.meta.url))

const shots = [
  { theme: 'light', w: 390, h: 844, scroll: 110, name: 'phone-light' },
  { theme: 'dark', w: 390, h: 844, scroll: 110, name: 'phone-dark' },
  { theme: 'dark', w: 390, h: 844, scroll: 0, name: 'phone-dark-top' },
]

for (const shot of shots) {
  const dir = join(process.env.TEMP, `sooyo-shot-${shot.name}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  const port = 9300 + Math.floor(Math.random() * 200)
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${shot.w},${shot.h}`, 'about:blank',
  ], { stdio: 'ignore' })

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  async function cdp(path) {
    for (let i = 0; i < 40; i += 1) {
      try { const r = await fetch(`http://127.0.0.1:${port}${path}`); if (r.ok) return r.json() } catch { }
      await sleep(250)
    }
    throw new Error('cdp unreachable')
  }
  const page = (await cdp('/json/list')).find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  let id = 1
  const pend = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data); const p = pend.get(m.id); if (!p) return; pend.delete(m.id)
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = id++; pend.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }))
  })

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 2, mobile: true })
  await send('Page.navigate', { url: `file:///${harness.replace(/^\/+/, '')}` })
  await sleep(700)

  // Switch theme and give the page something to scroll under the bar.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('.sy-root')
      root.dataset.theme = '${shot.theme}'
      const frame = document.querySelector('.sy-frame')
      const card = document.createElement('div')
      card.style.cssText = 'height:120px;margin-top:16px;border-radius:16px;background:var(--sy-card);box-shadow:var(--sy-shadow)'
      frame.appendChild(card)
      const tall = document.createElement('div')
      tall.style.height = '1200px'
      frame.appendChild(tall)
      root.scrollTo(0, ${shot.scroll})
      const grain = document.querySelector('.sy-grain')
      return {
        grainPresent: Boolean(grain),
        grainOpacity: grain ? getComputedStyle(grain).opacity : null,
        bg: getComputedStyle(root).backgroundColor,
      }
    })()`,
    returnByValue: true,
  }).then((r) => console.log(shot.name, JSON.stringify(r.result.value)))

  await sleep(400)
  const result = await send('Page.captureScreenshot', { format: 'png' })
  const file = join(process.env.TEMP, `${shot.name}.png`)
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  console.log('  ->', file)

  ws.close(); chrome.kill(); await sleep(250)
}
