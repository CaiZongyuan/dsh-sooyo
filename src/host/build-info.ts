/**
 * What this bundle *is* — baked at build time, because the answer is only knowable there.
 *
 * `dev/build.mjs` runs inside the repository (or pnpm's temporary clone of it), which is the
 * only moment `git rev-parse` and `package.json` are both readable. A runtime read would fail
 * exactly where it matters: an installed package ships only the `files` list, so neither `.git`
 * nor a caller-relative `package.json` is guaranteed to exist next to `index.js`.
 *
 * `__SOOYO_BUILD__` is an esbuild `define`, so the object is inlined as a literal and costs no
 * I/O. The `typeof` guard keeps a direct `tsx`/`node --experimental-strip-types` run — where no
 * define has happened — from throwing a ReferenceError for an undeclared identifier.
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export type InstallShape = 'checkout' | 'package' | 'unknown'

export type BuildInfo = {
  /** `package.json` `version` at build time. */
  version: string | null
  /**
   * `git rev-parse HEAD` at build time, or null when built outside a checkout.
   *
   * Plain 40-hex, deliberately: it is compared for equality against the upstream ref, so a
   * suffix like `-dirty` would make every build with uncommitted edits look out of date. The
   * dirty flag travels separately in {@link BuildInfo.dirty}.
   */
  commit: string | null
  /** Whether the working tree had uncommitted changes when this build ran. */
  dirty: boolean
  /** ISO timestamp of the build. */
  builtAt: string | null
}

declare const __SOOYO_BUILD__: BuildInfo | undefined

const FALLBACK: BuildInfo = { version: null, commit: null, dirty: false, builtAt: null }

export const BUILD: BuildInfo =
  typeof __SOOYO_BUILD__ === 'object' && __SOOYO_BUILD__ !== null ? __SOOYO_BUILD__ : FALLBACK

/**
 * How this copy got here, which decides what an update command even looks like.
 *
 * A `link:` install is a working tree with `.git` beside `index.js`; a `github:`/npm install is
 * a pnpm-managed directory that ships only the `files` list and therefore has no `.git`. Reading
 * that difference is more reliable than asking the operator to declare it, and it is a `stat`
 * rather than a network call.
 */
export function installShape(entryUrl: string | URL): InstallShape {
  try {
    const root = new URL('./', entryUrl)
    return existsSync(fileURLToPath(new URL('.git', root))) ? 'checkout' : 'package'
  } catch {
    return 'unknown'
  }
}

/** A short, human-recognisable identity for logs and the update line. */
export function buildLabel(info: BuildInfo, shape: InstallShape): string {
  const version = info.version ?? 'unknown'
  const commit = info.commit ? info.commit.slice(0, 7) : 'nogit'
  return `${version}+${commit}${info.dirty ? '+edits' : ''} (${shape})`
}
