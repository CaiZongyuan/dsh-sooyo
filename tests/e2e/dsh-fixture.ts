/**
 * Isolated real DSH Web Host fixture for Playwright E2E tests (Issues #8 & #9).
 *
 * Guarantees:
 * - Packs the current workspace (`pnpm pack`) and installs the real release tarball into a
 *   temporary `DSH_HOME` profile via `dsh plugin --profile web add <tgz>`.
 * - Never touches the developer's `~/.dsh` or any running DSH server.
 * - Captures the startup `dsh web: <authenticatedUrl>` token URL without logging the token.
 * - Fails explicitly if `dsh` or `pnpm` is unavailable.
 * - Cleans up only its own child processes and temporary directories.
 */

import type { Page } from '@playwright/test'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

let cachedTarballPath: string | null = null
let cachedTarballDir: string | null = null

export interface StartDshInstanceOptions {
  label?: string
  sooyoConfig?: Record<string, unknown>
  env?: Record<string, string>
  pluginSpec?: string
  registry?: string
  bundleManaged?: boolean
  hmr?: boolean
}

export interface DshInstance {
  readonly label: string
  readonly home: string
  readonly authenticatedUrl: string
  readonly origin: string
  readonly port: number
  readonly logs: string[]
  pause(): Promise<void>
  resume(): Promise<void>
  restart(nextSooyoConfig?: Record<string, unknown>): Promise<void>
  stop(): Promise<void>
}

function resolveDshBinJs(): string {
  const candidates: string[] = []
  if (process.env.DSH_E2E_BIN) {
    const override = resolve(process.env.DSH_E2E_BIN)
    if (!existsSync(override)) throw new Error(`DSH_E2E_BIN does not exist: ${override}`)
    return override
  }
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

export function getDshVersion(): string {
  const binJs = resolveDshBinJs()
  const res = spawnSync(process.execPath, [binJs, '--version'], { encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`Failed to query dsh --version: ${res.stderr || res.stdout}`)
  }
  return res.stdout.trim()
}

export function packPluginTarball(): string {
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

export function cleanupPackedTarball(): void {
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

function buildPatchYaml(sooyoConfig: Record<string, unknown> = {}): string {
  const merged = {
    mode: 'selected',
    autoRefresh: false,
    ...sooyoConfig,
  }
  return JSON.stringify(
    [
      {
        id: 'sooyo',
        name: 'dsh-sooyo',
        config: merged,
      },
    ],
    null,
    2,
  )
}

async function waitForSooyoReady(origin: string, timeoutMs = 20_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/sooyo/ping`)
      if (res.ok) {
        const body = (await res.json()) as Record<string, unknown>
        if (body?.ok && (body?.ready || body?.role === 'client')) {
          return body
        }
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(
    `Timed out waiting for ${origin}/sooyo/ping to become ready (${(lastError as Error)?.message ?? 'not ready'})`,
  )
}

export async function startDshInstance(options: StartDshInstanceOptions = {}): Promise<DshInstance> {
  const label = options.label ?? 'standalone'
  const dshBinJs = resolveDshBinJs()
  const spec = options.pluginSpec ?? packPluginTarball()
  const home = mkdtempSync(join(tmpdir(), `sooyo-dsh-${label}-`))
  const patchPath = join(home, 'sooyo-e2e-overlay.json')
  const patches: Array<Record<string, unknown>> = options.bundleManaged ? [] : JSON.parse(buildPatchYaml(options.sooyoConfig))
  if (options.hmr === false) patches.push({ id: 'hmr', disabled: true })
  if (options.registry) patches.push({ id: 'plugin-manager', config: { registry: options.registry, fallbackRegistries: [] } })
  writeFileSync(patchPath, JSON.stringify(patches), 'utf8')

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    ...(options.env ?? {}),
    ...(options.registry ? { NPM_CONFIG_REGISTRY: options.registry } : {}),
  }

  const installRes = await new Promise<{ status: number | null; output: string }>((done, reject) => {
    const install = spawn(process.execPath,
      [dshBinJs, 'plugin', '--profile', 'web', 'add', spec, ...(options.registry ? ['--registry', options.registry] : [])],
      { cwd: REPO_ROOT, env: baseEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    install.stdout.on('data', (chunk) => { output += chunk })
    install.stderr.on('data', (chunk) => { output += chunk })
    install.once('error', reject)
    install.once('exit', (status) => done({ status, output }))
  })
  if (installRes.status !== 0) {
    rmSync(home, { recursive: true, force: true })
    throw new Error(`dsh plugin add failed for [${label}]:\n${installRes.output}`)
  }

  let child: ChildProcess | null = null
  let authenticatedUrl = ''
  let origin = ''
  let port = 0
  const logs: string[] = []

  const redactToken = (line: string): string => line.replace(/([?&]token=)[^&\s]+/gi, '$1<REDACTED>')

  async function boot(requestedPort = 0): Promise<void> {
    authenticatedUrl = ''

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
        String(requestedPort),
      ],
      {
        cwd: REPO_ROOT,
        env: baseEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    const urlPromise = new Promise<string>((resolveUrl, rejectUrl) => {
      const timer = setTimeout(() => {
        rejectUrl(
          new Error(`Timed out waiting for DSH [${label}] web URL.\nRecent logs:\n${logs.slice(-20).join('\n')}`),
        )
      }, 60_000)

      let stdoutBuf = ''
      child!.stdout!.setEncoding('utf8')
      child!.stdout!.on('data', (chunk: string) => {
        stdoutBuf += chunk
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) logs.push(`[${label}:out] ${redactToken(line)}`)
        }
        const match = stdoutBuf.match(/dsh web:\s*(https?:\/\/\S+)/)
        if (match?.[1]) {
          clearTimeout(timer)
          resolveUrl(match[1])
        }
      })

      child!.stderr!.setEncoding('utf8')
      child!.stderr!.on('data', (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) logs.push(`[${label}:err] ${redactToken(line)}`)
        }
      })

      child!.once('exit', (code, signal) => {
        clearTimeout(timer)
        if (!authenticatedUrl) {
          rejectUrl(
            new Error(`DSH [${label}] exited prematurely (code=${code}, signal=${signal}).\nLogs:\n${logs.join('\n')}`),
          )
        }
      })
    })

    authenticatedUrl = await urlPromise
    const parsed = new URL(authenticatedUrl)
    origin = parsed.origin
    port = Number(parsed.port)
    await waitForSooyoReady(origin)
  }

  async function stopProcess(): Promise<void> {
    if (!child || child.exitCode !== null) {
      child = null
      return
    }
    const proc = child
    child = null
    await new Promise<void>((resolveStop) => {
      const killTimer = setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch {}
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

  async function pause(): Promise<void> {
    await stopProcess()
  }

  async function resume(): Promise<void> {
    await boot(port || 0)
  }

  async function restart(nextSooyoConfig?: Record<string, unknown>): Promise<void> {
    const previousPort = port || 0
    await stopProcess()
    if (nextSooyoConfig !== undefined) {
      writeFileSync(patchPath, buildPatchYaml(nextSooyoConfig), 'utf8')
    }
    await boot(previousPort)
  }

  async function stop(): Promise<void> {
    await stopProcess()
    try {
      rmSync(home, { recursive: true, force: true })
    } catch {
      // Ignore transient Windows file lock on cleanup
    }
  }

  try {
    await boot(0)
  } catch (error) {
    await stop()
    throw error
  }

  return {
    label,
    home,
    get authenticatedUrl() {
      return authenticatedUrl
    },
    get origin() {
      return origin
    },
    get port() {
      return port
    },
    get logs() {
      return [...logs]
    },
    pause,
    resume,
    restart,
    stop,
  }
}

export async function openSooyoInDsh(page: Page, instance: DshInstance): Promise<void> {
  await page.addInitScript(() => {
    const dismissDshOnboarding = () => {
      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        if (dialog.classList.contains('sy-sheet') || dialog.classList.contains('sy-pop') || dialog.closest('.sy-root')) {
          continue
        }
        const title = `${dialog.getAttribute('aria-label') ?? ''} ${dialog.querySelector('h1, h2, [role="heading"]')?.textContent ?? ''}`
        if (!/预览版说明|开始使用|preview|get started/i.test(title)) continue
        for (const btn of dialog.querySelectorAll('button')) {
          if (btn.textContent?.trim() === 'Continue') {
            ;(btn as HTMLButtonElement).click()
          }
        }
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(
          (b) => b.querySelector('svg') && !b.textContent?.trim(),
        )
        if (closeBtn) {
          ;(closeBtn as HTMLButtonElement).click()
        }
      }
    }
    const observer = new MutationObserver(() => dismissDshOnboarding())
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true })
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.documentElement, { childList: true, subtree: true })
        dismissDshOnboarding()
      })
    }
  })

  await page.goto(instance.authenticatedUrl, { waitUntil: 'domcontentloaded' })

  const sidebarBtn = page
    .locator('button[aria-label="sooyo daily"], button[title="sooyo daily"], button:has-text("sooyo daily")')
    .first()
  await sidebarBtn.waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(500)

  for (let pass = 0; pass < 8; pass += 1) {
    const dismissed = await page.evaluate(() => {
      let acted = false
      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        if (dialog.classList.contains('sy-sheet') || dialog.classList.contains('sy-pop') || dialog.closest('.sy-root')) {
          continue
        }
        const title = `${dialog.getAttribute('aria-label') ?? ''} ${dialog.querySelector('h1, h2, [role="heading"]')?.textContent ?? ''}`
        if (!/预览版说明|开始使用|preview|get started/i.test(title)) continue
        for (const btn of dialog.querySelectorAll('button')) {
          if (btn.textContent?.trim() === 'Continue') {
            ;(btn as HTMLButtonElement).click()
            acted = true
          }
        }
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(
          (b) => b.querySelector('svg') && !b.textContent?.trim(),
        )
        if (closeBtn) {
          ;(closeBtn as HTMLButtonElement).click()
          acted = true
        }
      }
      return acted
    })
    if (!dismissed && pass >= 2) break
    await page.waitForTimeout(150)
  }

  const panelLocator = page.locator('.sy-root')
  if (!(await panelLocator.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) =>
          b.textContent?.includes('sooyo daily') ||
          b.getAttribute('aria-label') === 'sooyo daily' ||
          b.getAttribute('title') === 'sooyo daily',
      )
      ;(btn as HTMLButtonElement | undefined)?.click()
    })
  }

  await page.locator('.sy-root .sy-grid > .sy-w').first().waitFor({ state: 'visible', timeout: 20_000 })
}

/** DSH switches its navigation surface at the mobile breakpoint; reopen the global panel there. */
export async function activateSooyoPanel(page: Page): Promise<void> {
  if (!(await page.locator('.sy-root').isVisible())) {
    const panel = page.locator('button[aria-label="sooyo daily"], button[title="sooyo daily"]').first()
    if (!(await panel.isVisible())) {
      await page.getByRole('button', { name: /^(打开侧边栏|Open sidebar)$/i }).last().click()
    }
    await panel.click()
  }
  await page.locator('.sy-root .sy-grid > .sy-w').first().waitFor({ state: 'visible' })
}
