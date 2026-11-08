import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { BUILD, UPDATE_CONTRACT } from '../index.js'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const manifest = JSON.parse(readFileSync(new URL('dsh.plugin.json', root), 'utf8'))
const client = readFileSync(new URL('client.js', root), 'utf8')
const identity = client.match(/Build identity: (\{[^\n]+\})/)
assert(identity, 'Client bundle must carry its own build identity')
assert.deepEqual(JSON.parse(identity[1]), BUILD, 'Host and browser must be built together')
assert.equal(pkg.version, BUILD.version, 'npm version must match the running build')
assert.equal(manifest.version, pkg.version, 'DSH manifest and npm versions must match')
assert.deepEqual(pkg.sooyo?.updateContract, UPDATE_CONTRACT, 'Published update compatibility must match the code')
assert.equal(typeof pkg.sooyo?.releaseNotes, 'string', 'A release must include update notes')
if (process.argv.includes('--release')) {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'Official updates use stable versions')
  assert.equal(BUILD.dirty, false, 'A release cannot contain uncommitted source changes')
  assert.match(BUILD.commit ?? '', /^[a-f0-9]{40}$/, 'A release must identify its source commit')
  assert.equal(BUILD.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'A release must be built from the current commit')
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', '.', ':!index.js', ':!client.js'], { cwd: root, encoding: 'utf8' }).trim(), '', 'A release requires a clean source tree')
  if (process.env.GITHUB_REF?.startsWith('refs/tags/')) {
    assert.equal(process.env.GITHUB_REF, `refs/tags/v${pkg.version}`, 'Release tag must match the package version')
  }
}
console.log(`Release metadata verified: ${pkg.version}, Host/browser identity and compatibility agree.`)
