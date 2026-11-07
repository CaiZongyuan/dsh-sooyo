/**
 * Build script for `dsh-sooyo`.
 *
 * Produces the two zero-build runtime artifacts at the repository root:
 *   - `index.js`: ESM Host bundle (`platform: 'node'`, zero `node_modules` bare imports).
 *   - `client.js`: DSH `__ModuleLoader__` Client bundle (`react` resolved via `require('react')`).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import * as esbuild from 'esbuild'

const ROOT = resolve(import.meta.dirname, '..')

/**
 * Identity of this build, inlined by esbuild as `__SOOYO_BUILD__`.
 *
 * The build step is the only moment both facts are reliably readable: `package.json` ships with
 * the package, but `.git` does not, and a `github:` install has neither `git` on the machine nor
 * a checkout. Baking it here means `sooyo_update_check` can always say which commit is running
 * instead of guessing from a version string that the branch does not bump per commit.
 */
function readBuildInfo() {
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
    // Reported separately: the revision stays plain 40-hex (it is compared against the upstream
    // ref), while "there are uncommitted edits" is a different fact about this build.
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    dirty = Boolean(status.trim())
  } catch {
    commit = null
  }
  return { version, commit, dirty, builtAt: new Date().toISOString() }
}

const BUILD = readBuildInfo()

async function buildHost() {
  const result = await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/host/index.ts')],
    outfile: resolve(ROOT, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: ['node:*'],
    charset: 'utf8',
    legalComments: 'none',
    metafile: true,
    define: { __SOOYO_BUILD__: JSON.stringify(BUILD) },
  })
  return result
}

async function buildClient() {
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
  })

  const cjsCode = result.outputFiles[0].text
    .replace(/className:\s*"sy-grain"/g, "className: 'sy-grain'")

  const wrapped = `/**
 * Client half of sooyo daily — generated from \`src/client/index.ts\`.
 * Do not edit by hand; run \`pnpm run build\` to regenerate.
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

  writeFileSync(resolve(ROOT, 'client.js'), wrapped, 'utf8')
}

await buildHost()
await buildClient()
console.log(`Built index.js and client.js successfully (${BUILD.version ?? 'unknown'}+${BUILD.commit ?? 'nogit'}).`)
