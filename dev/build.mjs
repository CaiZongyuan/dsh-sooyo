/**
 * Build script for `dsh-sooyo`.
 *
 * Produces the two zero-build runtime artifacts at the repository root:
 *   - `index.js`: ESM Host bundle (`platform: 'node'`, zero `node_modules` bare imports).
 *   - `client.js`: DSH `__ModuleLoader__` Client bundle (`react` resolved via `require('react')`).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as esbuild from 'esbuild'

const ROOT = resolve(import.meta.dirname, '..')

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
console.log('Built index.js and client.js successfully.')
