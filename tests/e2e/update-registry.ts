/** A local npm registry serving real, packed Sooyo bundles to the real DSH updater. */
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BUILD } from '../../src/shared/build.js'
import { packPluginTarball } from './dsh-fixture.js'

interface TestRelease { version: string; broken?: boolean; failOnRestore?: boolean }

export async function startUpdateRegistry(releases: TestRelease[]) {
  const directory = mkdtempSync(join(tmpdir(), 'sooyo-update-registry-'))
  const packages = new Map<string, { manifest: Record<string, any>; tarball: Buffer }>()
  const published = new Set<string>([releases[0]!.version])
  const requests: string[] = []
  const archive = packPluginTarball()
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const { buildPlugin } = await import(pathToFileURL(join(sourceRoot, 'dev/build.mjs')).href)
  let origin = ''
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', origin).pathname)
    requests.push(path)
    const version = path.match(/^\/dsh-sooyo\/([^/]+)$/)?.[1]
    const tarVersion = path.match(/^\/dsh-sooyo\/-\/dsh-sooyo-(.+)\.tgz$/)?.[1]
    const manifest = (entry: { manifest: Record<string, any>; tarball: Buffer }) => ({
      ...entry.manifest,
      dist: {
        tarball: `${origin}/dsh-sooyo/-/dsh-sooyo-${entry.manifest.version}.tgz`,
        integrity: `sha512-${createHash('sha512').update(entry.tarball).digest('base64')}`,
        shasum: createHash('sha1').update(entry.tarball).digest('hex'),
      },
    })
    if (tarVersion && packages.has(tarVersion)) {
      res.writeHead(200, { 'content-type': 'application/octet-stream' })
      res.end(packages.get(tarVersion)!.tarball)
    } else if (version && packages.has(version) && published.has(version)) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(manifest(packages.get(version)!)))
    } else if (path === '/dsh-sooyo') {
      const versions = Object.fromEntries([...published].map((item) => [item, manifest(packages.get(item)!)]))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        name: 'dsh-sooyo', versions,
        'dist-tags': { latest: [...published].at(-1) },
        time: Object.fromEntries([...published].map((item) => [item, '2025-01-01T00:00:00.000Z'])),
      }))
    } else {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Local registry did not bind')
  origin = `http://127.0.0.1:${address.port}`
  try {
    for (const release of releases) {
      if (!/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error('Invalid fixture version')
      const root = join(directory, release.version)
      mkdirSync(root)
      execFileSync('tar', ['-xzf', archive, '-C', root])
      const pkgRoot = join(root, 'package')
      const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
      pkg.version = release.version
      pkg.sooyo.releaseNotes = `真实安装测试版本 ${release.version}：保持个人数据及同步协议兼容。`
      delete pkg.scripts
      writeFileSync(join(pkgRoot, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8')
      const manifest = JSON.parse(readFileSync(join(pkgRoot, 'dsh.plugin.json'), 'utf8'))
      manifest.version = release.version
      writeFileSync(join(pkgRoot, 'dsh.plugin.json'), JSON.stringify(manifest), 'utf8')
      writeFileSync(join(pkgRoot, 'cordis.patch.yml'), JSON.stringify([{ insert: [{
        id: 'sooyo', name: 'dsh-sooyo', config: {
          autoRefresh: false, upstream: { context: false },
          updates: { autoCheck: false, registry: origin },
        },
      }] }]), 'utf8')
      await buildPlugin({ outdir: pkgRoot, info: {
        ...BUILD, version: release.version, builtAt: `2026-11-08T00:00:${release.version.split('.').at(-1)!.padStart(2, '0')}.000Z`,
      } })
      const host = join(pkgRoot, 'index.js')
      if (release.broken) writeFileSync(host, `throw new Error('intentional upgrade fixture failure');\n${readFileSync(host, 'utf8')}`, 'utf8')
      if (release.failOnRestore) writeFileSync(host,
        `if (globalThis.__sooyoRestoreFixtureLoaded) throw new Error('intentional restoration fixture failure');\nglobalThis.__sooyoRestoreFixtureLoaded = true;\n${readFileSync(host, 'utf8')}`, 'utf8')
      const target = join(root, 'bundle.tgz')
      execFileSync('tar', ['-czf', target, '-C', root, 'package'])
      packages.set(release.version, { manifest: pkg, tarball: readFileSync(target) })
    }
  } catch (error) {
    server.closeAllConnections()
    server.close()
    throw error
  }
  return {
    origin,
    requests,
    publish: (version: string) => {
      if (!packages.has(version)) throw new Error(`Unknown test release ${version}`)
      published.add(version)
    },
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()))
      const target = resolve(directory)
      if (dirname(target) !== resolve(tmpdir()) || !target.split(/[\\/]/).at(-1)?.startsWith('sooyo-update-registry-')) throw new Error('Unsafe registry cleanup path')
      rmSync(target, { recursive: true, force: true })
    },
  }
}
