/**
 * Isolated real DSH Web Host fixture for Playwright E2E tests (Issue #9).
 *
 * Guarantees:
 * - Packs the current workspace (`pnpm pack`) and installs the real release tarball into a
 *   temporary `DSH_HOME` profile via `dsh plugin --profile web add <tgz>`.
 * - Never touches the developer's `~/.dsh` or any running DSH server.
 * - Captures the startup `dsh web: <authenticatedUrl>` token URL without logging the token.
 * - Fails explicitly if `dsh` or `pnpm` is unavailable.
 * - Cleans up only its own child processes and temporary directories.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

let cachedTarballPath = null
let cachedTarballDir = null

function resolveDshBinJs() {
  const candidates = []
  if (process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  }
  const npmRoot = spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : 'npm',
    process.platform === 'win32' ? ['/d', '/s', '/c', 'npm root -g'] : ['root', '-g'],
    { encoding: 'utf8' },
  )
  if (npmRoot.status === 0 && npmRoot.stdout) {
    candidates.push(join(npmRoot.stdout.trim(), '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  }
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  throw new Error('DSH CLI (@deepseek-ai/dsh) was not found. Install @deepseek-ai/dsh globally before running test:e2e.')
}

export function getDshVersion() {
  const binJs = resolveDshBinJs()
  const res = spawnSync(process.execPath, [binJs, '--version'], { encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`Failed to query dsh --version: ${res.stderr || res.stdout}`)
  }
  return res.stdout.trim()
}

export function packPluginTarball() {
  if (cachedTarballPath && existsSync(cachedTarballPath)) {
    return cachedTarballPath
  }
  cachedTarballDir = mkdtempSync(join(tmpdir(), 'sooyo-e2e-pack-'))
  const execPath = process.env.npm_execpath
  const useNodeExec = typeof execPath === 'string' && /\.(?:m?js|cjs)$/i.test(execPath) && existsSync(execPath)
  const packRes = useNodeExec
    ? spawnSync(
      process.execPath,
      [execPath, 'pack', '--pack-destination', cachedTarballDir],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    : spawnSync(
      process.platform === 'win32' ? 'cmd.exe' : 'pnpm',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', `pnpm pack --pack-destination ${cachedTarballDir}`]
        : ['pack', '--pack-destination', cachedTarballDir],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
  if (packRes.status !== 0) {
    throw new Error(`pnpm pack failed (${packRes.status}): ${packRes.stderr || packRes.stdout}`)
  }
  const tgzFile = readdirSync(cachedTarballDir).find((name) => name.endsWith('.tgz'))
  if (!tgzFile) {
    throw new Error(`pnpm pack produced no .tgz in ${cachedTarballDir}`)
  }
  cachedTarballPath = join(cachedTarballDir, tgzFile)
  return cachedTarballPath
}

export function cleanupPackedTarball() {
  if (cachedTarballDir && existsSync(cachedTarballDir)) {
    try {
      rmSync(cachedTarballDir, { recursive: true, force: true })
    } catch {
      // Ignore Windows transient EBUSY on temp cleanup
    }
    cachedTarballDir = null
    cachedTarballPath = null
  }
}

function buildPatchYaml(sooyoConfig = {}) {
  const merged = {
    mode: 'selected',
    autoRefresh: false,
    ...sooyoConfig,
  }
  return JSON.stringify([
    {
      id: 'sooyo',
      name: 'dsh-sooyo',
      config: merged,
    },
  ], null, 2)
}

async function waitForSooyoReady(origin, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/sooyo/ping`)
      if (res.ok) {
        const body = await res.json()
        if (body?.ok && (body?.ready || body?.role === 'client')) {
          return body
        }
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`Timed out waiting for ${origin}/sooyo/ping to become ready (${lastError?.message ?? 'not ready'})`)
}

/**
 * Create and manage an isolated DSH Web Host instance with `dsh-sooyo` installed.
 *
 * @param {object} [options]
 * @param {string} [options.label] - Instance label for diagnostics (`standalone`, `hub`, `client`).
 * @param {object} [options.sooyoConfig] - Config merged into the `sooyo` entry patch.
 * @param {Record<string, string>} [options.env] - Extra environment variables (e.g. sync token).
 */
export async function startDshInstance(options = {}) {
  const label = options.label ?? 'standalone'
  const dshBinJs = resolveDshBinJs()
  const tarball = packPluginTarball()
  const home = mkdtempSync(join(tmpdir(), `sooyo-dsh-${label}-`))
  const patchPath = join(home, 'sooyo-e2e-overlay.json')
  writeFileSync(patchPath, buildPatchYaml(options.sooyoConfig), 'utf8')

  const baseEnv = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    ...(options.env ?? {}),
  }

  // 1. Install the packaged tarball into the isolated `web` profile
  const installRes = spawnSync(
    process.execPath,
    [dshBinJs, 'plugin', '--profile', 'web', 'add', tarball],
    {
      cwd: REPO_ROOT,
      env: baseEnv,
      encoding: 'utf8',
    },
  )
  if (installRes.status !== 0) {
    rmSync(home, { recursive: true, force: true })
    throw new Error(`dsh plugin add failed for [${label}]:\n${installRes.stderr || installRes.stdout}`)
  }

  let child = null
  let authenticatedUrl = null
  let origin = null
  let port = null
  const logs = []

  const redactToken = (line) => line.replace(/([?&]token=)[^&\s]+/gi, '$1<REDACTED>')

  async function boot() {
    authenticatedUrl = null
    origin = null
    port = null

    child = spawn(
      process.execPath,
      [
        dshBinJs,
        '--profile',
        'web',
        '--patch',
        patchPath,
        '--no-open',
        '--host',
        '127.0.0.1',
        '--port',
        '0',
      ],
      {
        cwd: REPO_ROOT,
        env: baseEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    const urlPromise = new Promise((resolveUrl, rejectUrl) => {
      const timer = setTimeout(() => {
        rejectUrl(new Error(`Timed out waiting for DSH [${label}] web URL.\nRecent logs:\n${logs.slice(-20).join('\n')}`))
      }, 30_000)

      let stdoutBuf = ''
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdoutBuf += chunk
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) logs.push(`[${label}:out] ${redactToken(line)}`)
        }
        const match = stdoutBuf.match(/dsh web:\s*(https?:\/\/\S+)/)
        if (match) {
          clearTimeout(timer)
          resolveUrl(match[1])
        }
      })

      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) logs.push(`[${label}:err] ${redactToken(line)}`)
        }
      })

      child.once('exit', (code, signal) => {
        clearTimeout(timer)
        if (!authenticatedUrl) {
          rejectUrl(new Error(`DSH [${label}] exited prematurely (code=${code}, signal=${signal}).\nLogs:\n${logs.join('\n')}`))
        }
      })
    })

    authenticatedUrl = await urlPromise
    const parsed = new URL(authenticatedUrl)
    origin = parsed.origin
    port = Number(parsed.port)
    await waitForSooyoReady(origin)
  }

  async function stopProcess() {
    if (!child || child.exitCode !== null) {
      child = null
      return
    }
    const proc = child
    child = null
    await new Promise((resolveStop) => {
      const killTimer = setTimeout(() => {
        try { proc.kill('SIGKILL') } catch {}
        resolveStop()
      }, 5000)
      proc.once('exit', () => {
        clearTimeout(killTimer)
        resolveStop()
      })
      try {
        proc.kill('SIGTERM')
      } catch {
        clearTimeout(killTimer)
        resolveStop()
      }
    })
  }

  async function restart(nextSooyoConfig = undefined) {
    await stopProcess()
    if (nextSooyoConfig !== undefined) {
      writeFileSync(patchPath, buildPatchYaml(nextSooyoConfig), 'utf8')
    }
    await boot()
  }

  async function stop() {
    await stopProcess()
    try {
      rmSync(home, { recursive: true, force: true })
    } catch {
      // Ignore transient Windows file lock on cleanup
    }
  }

  await boot()

  return {
    label,
    home,
    get authenticatedUrl() { return authenticatedUrl },
    get origin() { return origin },
    get port() { return port },
    get logs() { return [...logs] },
    restart,
    stop,
  }
}

/**
 * Authenticate a Playwright `page` against the DSH instance and open the `sooyo daily` panel.
 */
export async function openSooyoInDsh(page, instance) {
  await page.goto(instance.authenticatedUrl, { waitUntil: 'domcontentloaded' })

  // Wait for the DSH sidebar to mount
  const sidebarBtn = page.locator('button[aria-label="sooyo daily"], button[title="sooyo daily"], button:has-text("sooyo daily")').first()
  await sidebarBtn.waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(300)

  // Dismiss any stacked DSH onboarding modals ("Get started" close button & "Preview Notice" Continue button)
  for (let pass = 0; pass < 5; pass += 1) {
    const dismissed = await page.evaluate(() => {
      let acted = false
      // 1. Click Continue button if present
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent?.trim() === 'Continue') {
          btn.click()
          acted = true
        }
      }
      // 2. Click close (X) icon button inside any dialog (e.g. "Get started")
      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(
          (b) => b.querySelector('svg') && !b.textContent?.trim(),
        )
        if (closeBtn) {
          closeBtn.click()
          acted = true
        }
      }
      return acted
    })
    if (!dismissed) break
    await page.waitForTimeout(150)
  }

  // Open the Sooyo panel via its sidebar button if not already active
  const panelLocator = page.locator('.sy-root')
  if (!(await panelLocator.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('sooyo daily')
        || b.getAttribute('aria-label') === 'sooyo daily'
        || b.getAttribute('title') === 'sooyo daily',
      )
      btn?.click()
    })
  }

  await page.locator('.sy-root .sy-grid > .sy-w').first().waitFor({ state: 'visible', timeout: 20_000 })
}
