// Append the sooyo Client block to the desktop profile patch.
//
// Two rules from the Loader patch dialect decide the shape:
//  - A patch targets an existing row by carrying that row's `id`; there is no `override:` key.
//  - `config` REPLACES the row's config wholesale, never deep-merges, so `mode` must be
//    restated or the plugin would fall back to its default content mode.
//
// Written from Node rather than PowerShell: `Set-Content -Encoding UTF8` adds a BOM that DSH's
// YAML/JSON readers treat as content, and PowerShell would also mangle the Chinese round-trip
// through its ANSI default.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const profileDir = process.env.DSH_PROFILE_DIR
if (!profileDir) throw new Error('DSH_PROFILE_DIR is not set')

const patchPath = join(profileDir, 'cordis.patch.yml')
const tokenPath = join(process.env.USERPROFILE, '.sooyo-hub-token')

if (!existsSync(patchPath)) throw new Error(`no patch at ${patchPath}`)
if (!existsSync(tokenPath)) throw new Error(`no token at ${tokenPath} — fetch it from the Hub first`)

const token = readFileSync(tokenPath, 'utf8').trim()
if (token.length < 32) throw new Error('token looks too short')

let text = readFileSync(patchPath, 'utf8')

if (text.includes('role: client')) {
  console.log('a client block is already present; nothing to do')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
copyFileSync(patchPath, `${patchPath}.bak-sooyo-client-${stamp}`)

const block = `
# --- sooyo Client (multi-device sync) --------------------------------------
# This Host owns no authoritative Sooyo data: every read and write goes to the Hub on the
# Tencent server. The token lives only in this profile (and ~/.sooyo-hub-token, mode 600); it is
# never returned by any route, so the browser cannot see it.
# \`config\` replaces the row's config wholesale, so mode is restated here.
- id: sooyo
  name: dsh-sooyo
  config:
    mode: selected
    sync:
      role: client
      device: windows-desktop
      endpoint: https://caii-cloud.tail92971e.ts.net:8888
      token: '${token}'
      cacheMs: 0
`

text = `${text.replace(/\n+$/, '')}\n${block}`
writeFileSync(patchPath, text, 'utf8')

console.log(`appended client block to ${patchPath}`)
console.log(`backup: cordis.patch.yml.bak-sooyo-client-${stamp}`)
console.log(`token length written: ${token.length}`)
