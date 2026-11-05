// Probe the Hub from this Windows machine exactly as the Client will, before restarting DSH.
//
// This separates "the client config is wrong" from "the network cannot reach the Hub". If this
// passes and the panel still says 未同步, the problem is in the profile, not the network.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const token = readFileSync(join(process.env.USERPROFILE, '.sooyo-hub-token'), 'utf8').trim()
const base = 'https://caii-cloud.tail92971e.ts.net:8888'

async function probe(path, { auth = true, headers = {} } = {}) {
  const started = Date.now()
  try {
    const response = await fetch(`${base}${path}`, {
      headers: {
        accept: 'application/json',
        ...(auth ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      signal: AbortSignal.timeout(12_000),
    })
    const text = await response.text()
    return { status: response.status, ms: Date.now() - started, text }
  } catch (error) {
    return { status: 0, ms: Date.now() - started, error: String(error?.cause?.code ?? error?.message ?? error) }
  }
}

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${detail}`)
}

const health = await probe('/sooyo/sync/v1/health')
record('reach the Hub over TLS from Windows', health.status === 200, `${health.status} in ${health.ms}ms`)

const unauth = await probe('/sooyo/sync/v1/health', { auth: false })
record('the Hub requires a token', unauth.status === 401, String(unauth.status))

const snapshot = await probe('/sooyo/sync/v1/snapshot')
record('snapshot is readable', snapshot.status === 200, `${snapshot.status} in ${snapshot.ms}ms`)

if (snapshot.status === 200) {
  const parsed = JSON.parse(snapshot.text)
  record('snapshot names the hub role', parsed.role === 'hub', String(parsed.role))
  record('snapshot carries boards', (parsed.boards ?? []).length > 0, `${(parsed.boards ?? []).length} boards`)
  record('snapshot carries an agent inbox', Array.isArray(parsed.agentInbox), String(parsed.agentInbox !== undefined))
}

const context = await probe('/sooyo/sync/v1/context')
record('context is readable', context.status === 200, String(context.status))

const leaked = snapshot.text.includes(token) || health.text.includes(token)
record('the token is not echoed back', !leaked, leaked ? 'LEAKED' : 'clean')

const failed = results.filter((entry) => !entry.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exitCode = failed.length === 0 ? 0 : 1
