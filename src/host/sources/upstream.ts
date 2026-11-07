/**
 * Two read-only feeds about *the outside world in relation to this plugin*:
 *
 * 1. **AIHOT's own capability guide and changelog.** AIHOT ships new endpoints and changes the
 *    meaning of existing ones over time (weekly/monthly reports, reset monitors, the model
 *    leaderboard). An Agent that only knows the two endpoints this plugin calls will answer
 *    "I can't do that" about a feature AIHOT has had for weeks. The changelog is therefore
 *    *agent context*, not a card source: it is summarised to a line or two, and the full text
 *    is one tool call away.
 *
 * 2. **This plugin's own upstream.** The installed copy is a git checkout (or a `github:`
 *    install on the Hub), so "is there a newer build" is a question about a ref, not a
 *    version range.
 *
 * Why not a `SOURCES` entry: a Source produces dashboard Items with a Source, cover, score and
 * read state. Changelog entries have none of those and would crowd the feed with release notes.
 * The registry stays about content the user reads; this module is about what the Agent knows.
 *
 * Nothing here writes to storage, and nothing here executes an update. Detection is a network
 * read; applying one is an operator decision (see `updatePlan`).
 */

import { decodeEntities, stripTags } from './feed-parser.js'

const DEFAULT_TIMEOUT_MS = 12_000

/** AIHOT documents its own Agent surface here; it is the authority on what AIHOT can answer. */
export const AIHOT_GUIDE_URL = 'https://aihot.news/api/v1/agent'
export const AIHOT_CHANGELOG_URL = 'https://aihot.news/changelog'

/** The upstream repository this bundle is published from. */
export const DEFAULT_REPO = 'CaiZongyuan/dsh-sooyo'

/** Cited on every AIHOT-derived tool result; the site requires attribution. */
export const AIHOT_ATTRIBUTION = { name: 'AIHOT', url: 'https://aihot.news' }

export type ChangelogEntry = {
  /** `YYYY-MM-DD`, from the section id rather than the rendered Chinese date. */
  date: string
  /** `HH:MM` in Beijing time, as AIHOT publishes it. */
  time: string | null
  /** 更新 / 优化 / 公告 / 下线 — AIHOT's own label for the entry. */
  kind: string | null
  title: string
  body: string
}

export type ChangelogDigest = {
  fetchedAt: string
  /** The site's build stamp (`<meta name="aihot-release">`), which changes on every publish. */
  release: string | null
  /** Entries newest first. */
  entries: ChangelogEntry[]
  /** Entries inside the digest window, before any `limit` the caller applied. */
  recentCount: number
  source: string
}

export type UpdateCheck = {
  repo: string
  installedVersion: string | null
  installedCommit: string | null
  /** The working tree had uncommitted edits at build time, so HEAD is not exactly what runs. */
  installedDirty: boolean
  builtAt: string | null
  latestCommit: string | null
  latestRef: string
  updateAvailable: boolean | null
  checkedAt: string
  /** How the operator applies this update for the current install shape. */
  plan: { kind: 'checkout' | 'package' | 'unknown'; command: string | null; note: string }
  error: string | null
}

/** A failed read is reported to the Agent as "unavailable", never as an exception it must handle. */
async function readText(url: string, signal?: AbortSignal, accept = 'text/html'): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener?.('abort', onAbort, { once: true })
  try {
    const response = await fetch(url, {
      headers: { accept, 'user-agent': 'dsh-sooyo (+personal, non-commercial; agent context)' },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}

/** Collapse whitespace so a rendered paragraph reads as one line in a prompt. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** The build stamp AIHOT rotates on every publish, used to skip re-parsing an unchanged page. */
export function readAihotRelease(html: string): string | null {
  const match = /<meta\s+name="aihot-release"\s+content="([^"]+)"/i.exec(html)
  return match?.[1] ?? null
}

/**
 * Parse AIHOT's changelog page.
 *
 * Shape per day (verified against the live page on 2026-11-07):
 *
 *   <section id="d-2026-11-07">
 *     <h2><time dateTime="2026-11-07">2026 年 11 月 7 日</time><span>周六</span></h2>
 *     <ol><li>
 *       <div><span class="mono block …">18:01</span><span …><span …></span>更新</span></div>
 *       <article><h3>…title…</h3><p>…body…</p></article>
 *     </li></ol>
 *   </section>
 *
 * The date comes from `id="d-…"` rather than the rendered text: the text is localised Chinese
 * ("2026 年 11 月 7 日") and reformatting it is a parsing problem for no benefit. Every value is
 * stripped and entity-decoded, because this is third-party HTML being fed to a model.
 */
export function parseAihotChangelog(html: string): ChangelogEntry[] {
  const source = String(html ?? '')
  const entries: ChangelogEntry[] = []
  const sectionRe = /<section\b[^>]*\bid="d-(\d{4}-\d{2}-\d{2})"[^>]*>([\s\S]*?)<\/section>/gi
  let section: RegExpExecArray | null
  while ((section = sectionRe.exec(source)) !== null) {
    const date = section[1] ?? ''
    if (!date) continue
    const inner = section[2] ?? ''
    const itemRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
    let item: RegExpExecArray | null
    while ((item = itemRe.exec(inner)) !== null) {
      const chunk = item[1] ?? ''
      const titleMatch = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(chunk)
      if (!titleMatch) continue
      const title = oneLine(decodeEntities(stripTags(titleMatch[1] ?? '')))
      if (!title) continue
      const bodyMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(chunk.slice(titleMatch.index))
      const timeMatch = /<span class="mono[^"]*"[^>]*>\s*(\d{1,2}:\d{2})\s*<\/span>/i.exec(chunk)
      /**
       * The kind ("更新" / "优化" / "公告" / "下线") is the readable text of the meta column: a
       * clock, a decorative dot span, then the label — the dot sits *before* the text inside the
       * same span, so reading `>text<` per span misses it. Strip the column and drop the clock.
       */
      const metaEnd = chunk.search(/<article\b/i)
      const metaText = oneLine(decodeEntities(stripTags(metaEnd === -1 ? chunk : chunk.slice(0, metaEnd))))
      const kind = metaText.replace(/^\d{1,2}:\d{2}\s*/, '').trim() || null
      entries.push({
        date,
        time: timeMatch?.[1] ?? null,
        kind,
        title,
        body: bodyMatch ? oneLine(decodeEntities(stripTags(bodyMatch[1] ?? ''))) : '',
      })
    }
  }
  return entries
}

/**
 * Read and parse the changelog, reusing the last parse while the site's build stamp is unchanged.
 *
 * AIHOT publishes no `ETag` or `Last-Modified` on this page (it sends
 * `Cache-Control: public, max-age=299`), so a conditional request is not available. The
 * `aihot-release` meta is the next best signal: the page is fetched anyway, but an unchanged
 * stamp means the (comparatively expensive) parse is skipped.
 */
export function createAihotReader(options: { ttlMs?: number; timeoutMs?: number } = {}) {
  const ttlMs = options.ttlMs ?? 15 * 60 * 1000
  let cache: { at: number; release: string | null; entries: ChangelogEntry[] } | null = null
  let inflight: Promise<ChangelogDigest> | null = null

  async function read(signal?: AbortSignal): Promise<ChangelogDigest> {
    const now = Date.now()
    if (cache && now - cache.at < ttlMs) return { ...digestOf(cache), fetchedAt: new Date(cache.at).toISOString() }
    if (inflight) return inflight

    inflight = (async () => {
      const html = await readText(AIHOT_CHANGELOG_URL, signal)
      const release = readAihotRelease(html)
      if (cache && release && release === cache.release) {
        cache = { ...cache, at: Date.now() }
        return digestOf(cache)
      }
      const entries = parseAihotChangelog(html)
      cache = { at: Date.now(), release, entries }
      return digestOf(cache)
    })()

    try {
      return await inflight
    } finally {
      inflight = null
    }
  }

  function digestOf(value: { at: number; release: string | null; entries: ChangelogEntry[] }): ChangelogDigest {
    const cutoff = Date.now() - 14 * 24 * 3600 * 1000
    const recent = value.entries.filter((entry) => {
      const at = Date.parse(`${entry.date}T00:00:00Z`)
      return Number.isFinite(at) && at >= cutoff
    })
    return {
      fetchedAt: new Date(value.at).toISOString(),
      release: value.release,
      entries: value.entries,
      recentCount: recent.length,
      source: AIHOT_CHANGELOG_URL,
    }
  }

  return { read, peek: () => cache }
}

/**
 * Read AIHOT's Agent guide (Markdown, maintained by AIHOT).
 *
 * Cached for longer than the changelog because it is documentation: it changes when a feature
 * ships, not on every publish.
 */
export function createGuideReader(options: { ttlMs?: number } = {}) {
  const ttlMs = options.ttlMs ?? 6 * 3600 * 1000
  let cache: { at: number; text: string } | null = null

  async function read(signal?: AbortSignal): Promise<{ text: string; fetchedAt: string; source: string }> {
    if (cache && Date.now() - cache.at < ttlMs) {
      return { text: cache.text, fetchedAt: new Date(cache.at).toISOString(), source: AIHOT_GUIDE_URL }
    }
    const text = await readText(AIHOT_GUIDE_URL, signal, 'text/markdown, text/plain')
    cache = { at: Date.now(), text }
    return { text, fetchedAt: new Date(cache.at).toISOString(), source: AIHOT_GUIDE_URL }
  }

  return { read }
}

/**
 * Ask GitHub for a ref without spending API quota.
 *
 * `info/refs` is git's own ref advertisement — the request `git ls-remote` makes. The REST API
 * allows 60 unauthenticated calls an hour **per IP, shared by every plugin on the machine**,
 * and a handful of GitHub-installed plugins exhaust it; the whole profile then silently stops
 * reporting updates (the same lesson `dshmarket` records as issue #349). This endpoint has no
 * such budget.
 *
 * The response is a pkt-line stream:
 *   `<4 hex len><40 hex sha> <ref name>\0<capabilities>` for the first ref, then
 *   `<4 hex len><40 hex sha> <ref name>` per ref.
 */
export function parseRefAdvertisement(body: string, ref = 'refs/heads/main'): string | null {
  const pattern = new RegExp(`([0-9a-f]{40})\\s+${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\0\\n]|$)`, 'g')
  const match = pattern.exec(String(body ?? ''))
  return match?.[1] ?? null
}

const VERSION_RE = /^\d+\.\d+\.\d+/

function compareVersion(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const left = (VERSION_RE.exec(a)?.[0] ?? '0.0.0').split('.').map((part) => Number(part) || 0)
  const right = (VERSION_RE.exec(b)?.[0] ?? '0.0.0').split('.').map((part) => Number(part) || 0)
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) - (right[index] ?? 0)
  }
  return 0
}

/**
 * What an operator runs to take an update, given how this copy was installed.
 *
 * `checkout` is a git working tree (`link:` in a profile, or a hand clone): pulling is a plain
 * fast-forward. `package` is a `github:` / npm spec that pnpm owns, which is what the Hub runs.
 */
export function updatePlan(shape: 'checkout' | 'package' | 'unknown', repo = DEFAULT_REPO, ref = 'main'): UpdateCheck['plan'] {
  if (shape === 'checkout') {
    return {
      kind: 'checkout',
      command: `git -C <this checkout> pull --ff-only origin ${ref}`,
      note: '这个副本是 git 工作树：拉取后用 pnpm run build 重新生成 index.js / client.js，再重启 DSH（Host 模块只在重启后重新加载）。',
    }
  }
  if (shape === 'package') {
    return {
      kind: 'package',
      command: `pnpm add "github:${repo}#${ref}"`,
      note: '这个副本由 pnpm 从 GitHub 安装：改 profile 里的版本引用后重新安装，或交给 dshmarket 的更新接口，然后重启 DSH。',
    }
  }
  return { kind: 'unknown', command: null, note: '无法判断安装方式；请在 profile 的 package.json 里确认 dsh-sooyo 的 spec。' }
}

export type UpdateCheckerOptions = {
  repo?: string
  ref?: string
  installedVersion?: string | null
  installedCommit?: string | null
  installedDirty?: boolean
  builtAt?: string | null
  shape?: 'checkout' | 'package' | 'unknown'
  ttlMs?: number
  timeoutMs?: number
}

/**
 * Compare the running build against the upstream default branch.
 *
 * `updateAvailable` is deliberately `null` rather than `false` when the local commit is unknown
 * (a tarball install has no `.git`): "I could not tell" and "you are current" are different
 * answers, and a green badge on the wrong one is worse than no badge.
 */
export function createUpdateChecker(options: UpdateCheckerOptions = {}) {
  const repo = options.repo ?? DEFAULT_REPO
  const ref = options.ref ?? 'main'
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000
  const shape = options.shape ?? 'unknown'
  let cache: { at: number; value: UpdateCheck } | null = null
  let inflight: Promise<UpdateCheck> | null = null

  async function check(signal?: AbortSignal): Promise<UpdateCheck> {
    if (cache && Date.now() - cache.at < ttlMs) return cache.value
    if (inflight) return inflight

    inflight = (async () => {
      const checkedAt = new Date().toISOString()
      const base: UpdateCheck = {
        repo,
        installedVersion: options.installedVersion ?? null,
        installedCommit: options.installedCommit ?? null,
        installedDirty: Boolean(options.installedDirty),
        builtAt: options.builtAt ?? null,
        latestCommit: null,
        latestRef: ref,
        updateAvailable: null,
        checkedAt,
        plan: updatePlan(shape, repo, ref),
        error: null,
      }
      try {
        const body = await readText(
          `https://github.com/${repo}/info/refs?service=git-upload-pack`,
          signal,
          'application/x-git-upload-pack-advertisement, text/plain',
        )
        const latest = parseRefAdvertisement(body, `refs/heads/${ref}`)
        if (!latest) throw new Error('ref advertisement did not name the default branch')
        const same = Boolean(base.installedCommit) && base.installedCommit === latest
        const value: UpdateCheck = {
          ...base,
          latestCommit: latest,
          updateAvailable: base.installedCommit ? !same : null,
        }
        cache = { at: Date.now(), value }
        return value
      } catch (error) {
        // A failed check must not read as "up to date".
        const value: UpdateCheck = { ...base, error: String((error as Error)?.message ?? error) }
        cache = { at: Date.now(), value }
        return value
      }
    })()

    try {
      return await inflight
    } finally {
      inflight = null
    }
  }

  return { check, peek: () => cache?.value ?? null }
}

/** One line for the Agent context block; null when there is nothing worth saying. */
export function describeUpdate(check: UpdateCheck | null): string | null {
  if (!check) return null
  if (check.error) return `Update: checked ${check.repo} but the check failed (${check.error}).`
  if (check.updateAvailable === true) {
    const local = check.installedCommit ? check.installedCommit.slice(0, 7) : check.installedVersion ?? 'unknown'
    const remote = check.latestCommit ? check.latestCommit.slice(0, 7) : 'unknown'
    return `Update: dsh-sooyo ${local} → ${remote} on ${check.latestRef} (ask the user before updating; Host reload needs a restart).`
  }
  if (check.updateAvailable === false && check.installedDirty) {
    // Same revision upstream, but this build carries uncommitted edits: "not behind" is true and
    // "identical to upstream" is not. Naming it prevents a later "why is behaviour different
    // from the release?" that the version string cannot answer.
    return `Build: dsh-sooyo ${check.installedCommit?.slice(0, 7) ?? 'unknown'} + local edits (upstream is at the same revision).`
  }
  if (check.updateAvailable === false) return null
  return null
}

/**
 * The changelog as Agent context: the newest entries, newest first, tightly bounded.
 *
 * This is the *pointer* half of the design — enough for the model to know AIHOT gained a
 * capability recently, never the whole page. `sooyo_aihot` returns the rest.
 */
export function describeChangelog(digest: ChangelogDigest | null, { limit = 2 } = {}): string | null {
  if (!digest || digest.entries.length === 0) return null
  const newest = digest.entries.slice(0, Math.max(1, Math.min(limit, 5)))
  const parts = newest.map((entry) => `${entry.date}${entry.time ? ` ${entry.time}` : ''} ${entry.title}`)
  const head = `AIHOT changelog (${digest.recentCount} entries in 14d): ${parts.join(' | ')}`
  return `${head} — full text and AIHOT's Agent guide via sooyo_aihot.`
}

export { compareVersion }
