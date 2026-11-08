import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { strict as assert } from 'node:assert'
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const archive = resolve(root, process.argv[2] ?? `artifacts/${pkg.name}-${pkg.version}.tgz`)
const npmCli = [
  resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find(existsSync)
assert(npmCli, 'npm CLI was not found beside Node.js')

execFileSync(process.execPath, ['dev/verify-release.mjs', '--release'], { cwd: root, stdio: 'inherit' })
for (const name of ['index.js', 'client.js']) {
  const packed = execFileSync('tar', ['-xOf', archive, `package/${name}`], { maxBuffer: 8_000_000 })
  assert(packed.equals(readFileSync(resolve(root, name))), `Packed ${name} differs from the verified release build`)
}
const packedPkg = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }))
assert.equal(packedPkg.name, pkg.name)
assert.equal(packedPkg.version, pkg.version)
assert.deepEqual(packedPkg.sooyo, pkg.sooyo)
const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`
const registry = 'https://registry.npmjs.org'
const lookup = spawnSync(process.execPath, [npmCli, 'view', `${pkg.name}@${pkg.version}`, 'dist.integrity', '--json',
  `--registry=${registry}`, '--fetch-retries=0', '--fetch-timeout=15000'], { cwd: root, encoding: 'utf8', timeout: 25_000 })
if (lookup.error) throw lookup.error
let answer
try { answer = JSON.parse(lookup.stdout) } catch {
  throw new Error(`npm version lookup returned no JSON: ${lookup.stderr}`)
}
if (lookup.status === 0) {
  assert.equal(answer, integrity, `npm already has ${pkg.name}@${pkg.version} with different contents; publish a new version`)
  console.log(`${pkg.name}@${pkg.version} is already published with the exact verified integrity.`)
} else {
  assert.equal(answer?.error?.code, 'E404', `npm lookup failed: ${lookup.stderr}`)
  const flags = process.env.GITHUB_ACTIONS === 'true' ? ['--provenance'] : []
  const publish = spawnSync(process.execPath, [npmCli, 'publish', archive, '--access=public', `--registry=${registry}`, ...flags],
    { cwd: root, stdio: 'inherit' })
  if (publish.error) throw publish.error
  if (publish.status !== 0) process.exit(publish.status ?? 1)
  const verify = spawnSync(process.execPath, [npmCli, 'view', `${pkg.name}@${pkg.version}`, 'dist.integrity', '--json',
    `--registry=${registry}`, '--fetch-retries=0', '--fetch-timeout=15000'], { cwd: root, encoding: 'utf8', timeout: 25_000 })
  if (verify.error) throw verify.error
  assert.equal(verify.status, 0, `Published version could not be verified: ${verify.stderr}`)
  assert.equal(JSON.parse(verify.stdout), integrity, 'Published tarball integrity differs from the verified release')
  console.log(`Published and verified ${pkg.name}@${pkg.version}.`)
}
