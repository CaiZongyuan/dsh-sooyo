// Find imported names that the module body never uses.
//
// A wrong answer here is worse than none: an earlier version built the search pattern through
// nested string escaping and reported every single import as unused, including ones the code
// cannot run without. This version splits the source at the import block and searches the body.
import { readFileSync } from 'node:fs'

const FILES = [
  '../index.js',
  '../daily.js',
  '../core/protocol.js',
  '../core/store.js',
  '../core/commands.js',
  '../core/service.js',
  '../core/migrate.js',
  '../sync/remote.js',
  '../sync/routes.js',
  '../agent/tools.js',
  '../agent/context.js',
  '../agent/review.js',
  '../agent/inbox.js',
]

const IMPORT_RE = /^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]\s*$/gm

let problems = 0
for (const file of FILES) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const imports = [...source.matchAll(IMPORT_RE)]
  if (imports.length === 0) continue

  // The module body is everything after the *import block*, not after the last import: some
  // modules keep a constant between imports and its use (a `...ACTION_NAMES` spread built right
  // after one), and slicing at the last import would hide that use and report a false positive.
  const firstImport = imports[0].index
  const lastImportEnd = imports[imports.length - 1].index + imports[imports.length - 1][0].length
  const body = source.slice(0, firstImport) + source.slice(lastImportEnd)

  for (const match of imports) {
    for (const raw of match[1].split(',')) {
      const local = raw.trim().split(/\s+as\s+/).pop()?.trim()
      if (!local) continue
      // A bare identifier occurrence, minus member access. Counting occurrences in the stripped
      // body is simpler and less error-prone than one clever pattern: `local` must appear once
      // per use, so a single match beyond the import itself means it is used.
      //
      // `...ACTION_NAMES` counts, and so does `local(`. What must NOT count is `other.local`,
      // which is why each match is checked for a preceding dot that is not a spread.
      let used = false
      for (const hit of body.matchAll(new RegExp(`(^|[^\\w$])${local.replace(/[$]/g, '\\$')}(?![\\w$])`, 'g'))) {
        const prefix = hit[1] ?? ''
        const index = hit.index + prefix.length
        const before = body.slice(Math.max(0, index - 3), index)
        // `...` immediately before the name is a spread, not a member access.
        if (!before.endsWith('.') || before.endsWith('...')) {
          used = true
          break
        }
      }
      if (!used) {
        console.log(`${file}: UNUSED import ${local}`)
        problems += 1
      }
    }
  }
}
console.log(problems === 0 ? 'no unused imports' : `${problems} unused import(s)`)
process.exitCode = problems === 0 ? 0 : 1
