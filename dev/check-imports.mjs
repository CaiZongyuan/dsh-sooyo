/**
 * Static invariant checks for `dsh-sooyo`:
 *   1. No bare `node_modules` imports in `src/host/**` or generated `index.js` (only `node:*` and relative paths).
 *   2. `client.js` is wrapped in `window.__ModuleLoader__.load` and resolves `react` via `require('react')`.
 *   3. No UTF-8 replacement character (`U+FFFD`) corruption in source/artifact/doc files.
 *   4. `package.json` and `dsh.plugin.json` versions match.
 *   5. No unused runtime value imports in `src/host/**`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function walk(dir, predicate = () => true) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'test-results') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walk(full, predicate))
    } else if (predicate(full)) {
      out.push(full)
    }
  }
  return out
}

let problems = 0
const fail = (msg) => {
  console.error(`FAIL  ${msg}`)
  problems += 1
}

// 1. Version parity between package.json and dsh.plugin.json
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const pluginManifest = JSON.parse(readFileSync(resolve(ROOT, 'dsh.plugin.json'), 'utf8'))
if (pkg.version !== pluginManifest.version) {
  fail(`version mismatch: package.json=${pkg.version} vs dsh.plugin.json=${pluginManifest.version}`)
}

// 2. UTF-8 U+FFFD check across all source, test, doc and artifact files
const textFiles = walk(ROOT, (f) => /\.(ts|tsx|js|mjs|json|md|css|yml)$/.test(f))
for (const file of textFiles) {
  const content = readFileSync(file, 'utf8')
  if (content.includes('\uFFFD')) {
    fail(`${relative(ROOT, file)}: contains UTF-8 replacement character (U+FFFD)`)
  }
}

// 3. No bare node_modules imports in src/host/** or index.js
const hostFiles = [
  resolve(ROOT, 'index.js'),
  ...walk(resolve(ROOT, 'src/host'), (f) => /\.(ts|js)$/.test(f)),
]
const STATIC_IMPORT_RE = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm
for (const file of hostFiles) {
  const content = readFileSync(file, 'utf8')
  for (const match of content.matchAll(STATIC_IMPORT_RE)) {
    const spec = match[1]
    if (!spec) continue
    if (!spec.startsWith('.') && !spec.startsWith('node:')) {
      fail(`${relative(ROOT, file)}: forbidden bare import "${spec}" (only node:* and relative paths allowed)`)
    }
  }
}

// 4. Client bundle invariant: uses window.__ModuleLoader__.load and require('react')
const clientBundle = readFileSync(resolve(ROOT, 'client.js'), 'utf8')
if (!clientBundle.includes('window.__ModuleLoader__.load(')) {
  fail('client.js: missing window.__ModuleLoader__.load wrapper')
}
if (!/require\(['"]react['"]\)/.test(clientBundle)) {
  fail('client.js: must resolve React via require("react") from DSH ModuleLoader')
}

// 5. Unused value imports check on src/host/**
const VALUE_IMPORT_RE = /^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]\s*$/gm
for (const file of walk(resolve(ROOT, 'src/host'), (f) => f.endsWith('.ts'))) {
  const source = readFileSync(file, 'utf8')
  const imports = [...source.matchAll(VALUE_IMPORT_RE)]
  if (imports.length === 0) continue

  const firstImport = imports[0].index
  const lastImportEnd = imports[imports.length - 1].index + imports[imports.length - 1][0].length
  const body = source.slice(0, firstImport) + source.slice(lastImportEnd)

  for (const match of imports) {
    for (const raw of match[1].split(',')) {
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('type ')) continue
      const local = trimmed.split(/\s+as\s+/).pop()?.trim()
      if (!local) continue
      let used = false
      for (const hit of body.matchAll(new RegExp(`(^|[^\\w$])${local.replace(/[$]/g, '\\$')}(?![\\w$])`, 'g'))) {
        const prefix = hit[1] ?? ''
        const index = hit.index + prefix.length
        const before = body.slice(Math.max(0, index - 3), index)
        if (!before.endsWith('.') || before.endsWith('...')) {
          used = true
          break
        }
      }
      if (!used) {
        fail(`${relative(ROOT, file)}: UNUSED import ${local}`)
      }
    }
  }
}

console.log(problems === 0 ? 'all static & import checks passed' : `${problems} check(s) failed`)
process.exitCode = problems === 0 ? 0 : 1
