/**
 * Build script for `dsh-sooyo`.
 *
 * Produces the two zero-build runtime artifacts at the repository root:
 *   - `index.js`: ESM Host bundle (`platform: 'node'`, zero `node_modules` bare imports).
 *   - `client.js`: DSH `__ModuleLoader__` Client bundle (`react` resolved via `require('react')`).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const ROOT = resolve(import.meta.dirname, '..')

/**
 * Identity of this build, inlined by esbuild as `__SOOYO_BUILD__`.
 *
 * The build step is the only moment both facts are reliably readable: `package.json` ships with
 * the package, but `.git` does not, and a `github:` install has neither `git` on the machine nor
 * a checkout. Baking it here means `sooyo_update_check` can always say which commit is running
 * instead of guessing from a version string that the branch does not bump per commit.
 *
 * **A dirty tree is refused by default** (`--allow-dirty` overrides). The reason is not tidiness:
 * `commit` is compared for equality against the upstream ref, so an artifact built *before* its
 * own change was committed names its parent and reports "one commit behind" forever — the exact
 * false alarm the update check exists to avoid. Refusing the build makes `commit` mean "this
 * revision contains the code you are running". When overridden, `dirty` stays in the payload so
 * the reader is told the difference.
 */
function readBuildInfo({ allowDirty }) {
  let version = null
  try {
    version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version ?? null
  } catch {
    version = null
  }
  let commit = null
  let dirty = false
  try {
    // `execFileSync` rather than a shell: no quoting rules, and a missing `git` is an exception
    // rather than a stray "command not found" line on stdout.
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
    const status = execFileSync('git', ['status', '--porcelain', '--', '.', ':!index.js', ':!client.js'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    dirty = Boolean(status.trim())
    if (dirty && !allowDirty) {
      const files = status.trim().split('\n').slice(0, 8).join('\n  ')
      throw new Error(
        `working tree is dirty; refusing to build a bundle whose commit would not name its own code.\n`
        + `  Commit first, or pass --allow-dirty (the build then reports commit+dirty).\n  ${files}`,
      )
    }
  } catch (error) {
    if (String(error?.message ?? '').startsWith('working tree is dirty')) throw error
    // No git (a tarball or a CI checkout without history): leave commit unknown rather than
    // inventing one; `updateAvailable` becomes null and says "could not tell".
    commit = null
    dirty = false
  }
  // Clean builds use their source commit's timestamp so a tag produces identical release bytes on reruns.
  const builtAt = commit && !dirty
    ? new Date(execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()).toISOString()
    : new Date().toISOString()
  return { version, commit, dirty, builtAt }
}

async function buildHost(buildInfo, outdir) {
  const result = await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/host/index.ts')],
    outfile: resolve(outdir, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: ['node:*'],
    charset: 'utf8',
    legalComments: 'none',
    metafile: true,
    define: { __SOOYO_BUILD__: JSON.stringify(buildInfo) },
  })
  return result
}

async function buildClient(buildInfo, outdir) {
  const cssPath = resolve(ROOT, 'src/client/styles/tokens.css')
  const rawCss = readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n').trim()

  const cssExternalPlugin = {
    name: 'sooyo-inline-css',
    setup(build) {
      build.onResolve({ filter: /tokens\.css$/ }, (args) => ({
        path: args.path,
        namespace: 'sooyo-css',
      }))
      build.onLoad({ filter: /.*/, namespace: 'sooyo-css' }, () => ({
        contents: 'export default CSS;',
        loader: 'js',
      }))
    },
  }

  const result = await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/client/index.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    external: ['react'],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    charset: 'utf8',
    legalComments: 'none',
    plugins: [cssExternalPlugin],
    define: { __SOOYO_BUILD__: JSON.stringify(buildInfo) },
  })

  const cjsCode = result.outputFiles[0].text
    .replace(/className:\s*"sy-grain"/g, "className: 'sy-grain'")

  const wrapped = `/**
 * Client half of sooyo daily — generated from \`src/client/index.ts\`.
 * Do not edit by hand; run \`pnpm run build\` to regenerate.
 * Build identity: ${JSON.stringify(buildInfo)}
 */
window.__ModuleLoader__.load({
  id: 'dsh-sooyo',
  factory(require) {
    const exports = {}
    const module = { exports }
    const CSS = \`
${rawCss}
\`
${cjsCode}
    return module.exports.default ?? module.exports.clientPlugin ?? module.exports
  },
})
`

  writeFileSync(resolve(outdir, 'client.js'), wrapped, 'utf8')
}

export async function buildPlugin({ outdir = ROOT, info } = {}) {
  const buildInfo = info ?? readBuildInfo({ allowDirty: false })
  mkdirSync(outdir, { recursive: true })
  await buildHost(buildInfo, outdir)
  await buildClient(buildInfo, outdir)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const info = readBuildInfo({ allowDirty: process.argv.includes('--allow-dirty') })
  await buildPlugin({ info })
  console.log(`Built index.js and client.js successfully (${info.version ?? 'unknown'}+${info.commit ?? 'nogit'}).`)
}
