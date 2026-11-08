import { strict as assert } from 'node:assert'
import { RuntimeLifecycle, createPluginUpdates, UPDATE_CONTRACT, BUILD, sameBuild, apply, TABLES } from '../index.js'

const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

export async function runUpdateSelftests(check, { makeContext }) {
  console.log('\n-- Plugin updates and safe shutdown (no network) --')
  const lifecycle = new RuntimeLifecycle()
  const releaseWrite = deferred()
  const writes = []
  const accepted = lifecycle.run(async () => {
    await releaseWrite.promise
    await lifecycle.run(async () => { writes.push('accepted') })
  })
  const pausing = lifecycle.pause()
  assert.throws(() => lifecycle.run(() => writes.push('late')), /升级或关闭/)
  check('updates: pausing refuses new work without closing accepted work', lifecycle.phase === 'pausing' && writes.length === 0)
  releaseWrite.resolve()
  await Promise.all([accepted, pausing])
  check('updates: accepted work finishes before the runtime becomes paused', writes.join(',') === 'accepted' && lifecycle.phase === 'paused')
  lifecycle.resume()
  check('updates: a cancelled preparation reopens admission', lifecycle.run(() => 'ready') === 'ready')

  const flush = deferred()
  let saved = false
  await lifecycle.run(async () => {
    void lifecycle.run(async () => { await flush.promise; saved = true })
  })
  let closed = false
  const closing = lifecycle.close(async () => { closed = true })
  await Promise.resolve()
  check('updates: shutdown waits for nested fire-and-forget persistence', !closed && !saved)
  flush.resolve()
  await closing
  check('updates: storage closes only after persistence completes', saved && closed && lifecycle.phase === 'closed')
  assert.throws(() => lifecycle.run(() => {}), /升级或关闭/)

  // A timer created by a completed operation must not retain permission to write forever.
  const timed = new RuntimeLifecycle()
  let timerOutcome
  await timed.run(async () => {
    setTimeout(() => {
      try { timed.run(() => { timerOutcome = 'wrote' }) } catch { timerOutcome = 'refused' }
    }, 5)
  })
  await timed.pause()
  await new Promise((resolve) => setTimeout(resolve, 15))
  check('updates: inherited async context cannot admit work after its owner finishes', timerOutcome === 'refused')

  let calls = 0
  let currentVersion = '0.4.0'
  let contract = UPDATE_CONTRACT
  let nodeRequirement = '>=20'
  let fail = false
  const state = new RuntimeLifecycle()
  const build = { ...BUILD, version: '0.3.0' }
  const runtime = () => ({ build, instanceId: 'unit-instance', role: 'standalone', ready: true, phase: state.phase, contract: UPDATE_CONTRACT })
  const manager = {
    listBundles: async () => [{ name: 'dsh-sooyo', version: build.version, updatable: true }],
    listVersions: async () => {
      calls++
      if (fail) throw new Error('registry offline')
      return {
        status: 'listed', registry: 'https://registry.npmjs.org', omitted: 0,
        versions: [
          { version: '9.0.0-rc.1', prerelease: true, bundle: true },
          { version: currentVersion, prerelease: false, bundle: true },
          { version: '0.3.1', prerelease: false, bundle: true },
        ],
      }
    },
    updateBundle: () => { throw new Error('A check must never install') },
  }
  const metadata = async (url) => new Response(JSON.stringify({
    name: 'dsh-sooyo', version: String(url).split('/').at(-1),
    engines: { node: nodeRequirement },
    sooyo: { updateContract: contract, releaseNotes: 'A tested release' },
  }))
  const updates = createPluginUpdates({
    manager: () => manager, lifecycle: state, runtime, shape: 'package',
    development: { check: async () => { throw new Error('Registry installs must not compare main') } },
    fetch: metadata,
  })
  const first = await updates.check()
  check('updates: default candidate is the newest stable release, not a newer prerelease', first.candidate?.version === '0.4.0')
  check('updates: native compatible registry installs can update', first.canUpdate && first.source === 'registry')
  await updates.check()
  check('updates: normal checks reuse cached results', calls === 1)
  currentVersion = '0.5.0'
  const forced = await updates.check(true)
  check('updates: force bypasses the cache and discovers a new release', calls === 2 && forced.candidate.version === '0.5.0')
  fail = true
  const unavailable = await updates.check(true)
  check('updates: registry failures never report current or retain an actionable stale candidate', unavailable.state === 'error' && !unavailable.canUpdate && unavailable.candidate === null)
  fail = false
  contract = { ...UPDATE_CONTRACT, dataSchemaVersion: 999 }
  const incompatible = await updates.check(true)
  check('updates: schema changes are visible but cannot use one-click activation', incompatible.state === 'available' && !incompatible.canUpdate && incompatible.candidate.reason.includes('维护升级'))
  contract = UPDATE_CONTRACT
  nodeRequirement = '>=999'
  const unsupportedNode = await updates.check(true)
  check('updates: an unsupported Node release cannot be activated', !unsupportedNode.canUpdate && unsupportedNode.candidate.reason.includes('Node.js'))
  nodeRequirement = '>=20'
  await updates.check(true)

  const presence = (id, dirty = false, freezeId = undefined, browserBuild = build) =>
    updates.presence({ id, dirty, busy: false, build: browserBuild, freezeId })
  const prepareWithAck = async (secondDirty = false, secondBuild = build) => {
    const ack = setInterval(() => {
      const freezeId = updates.freezeId()
      if (!freezeId) return
      presence('panel-one-001', false, freezeId)
      presence('panel-two-002', secondDirty, freezeId, secondBuild)
    }, 5)
    try { return await updates.prepare('panel-one-001', '0.5.0') } finally { clearInterval(ack) }
  }
  presence('panel-one-001')
  presence('panel-two-002', true)
  await assert.rejects(prepareWithAck(true), /未提交内容/)
  check('updates: a draft in another window blocks activation and releases the preparation', state.accepting && updates.freezeId() === null)
  presence('panel-two-002', false, undefined, { ...build, builtAt: 'different-build' })
  await assert.rejects(prepareWithAck(false, { ...build, builtAt: 'different-build' }), /不同的界面版本/)
  check('updates: mixed browser builds block activation before installation', state.accepting)
  // The last cached heartbeat can still say dirty even after the user cleared the draft.
  presence('panel-two-002', true)
  const prepared = await prepareWithAck()
  check('updates: every window acknowledges a freeze before the runtime is paused', state.phase === 'paused' && prepared.version === '0.5.0')
  await assert.rejects(updates.prepare('panel-one-001', '0.5.0'), /已有升级/)
  updates.resume('wrong-id')
  check('updates: another operation cannot release an active preparation', state.phase === 'paused')
  updates.resume(prepared.requestId)
  check('updates: the matching failed/cancelled operation can resume the old instance', state.accepting)
  updates.dispose()

  const legacy = createPluginUpdates({
    manager: () => undefined, lifecycle: state, runtime, shape: 'package',
    development: { check: async () => ({}) },
    fetch: async (url) => String(url).endsWith('/dsh-sooyo')
      ? new Response(JSON.stringify({ versions: { '0.4.0': {} } })) : metadata(url),
  })
  const legacyStatus = await legacy.check()
  check('updates: old hosts still check releases but stay read-only', legacyStatus.candidate.version === '0.4.0' && !legacyStatus.canUpdate && legacyStatus.reason.includes('缺少'))
  legacy.dispose()
  check('updates: two versions with the same semver but different build times are distinct', !sameBuild(build, { ...build, builtAt: 'other' }))
  check('updates: a build cannot verify an unknown browser identity', !sameBuild({ version: null, commit: null, builtAt: null, dirty: false }, build))

  // Exercise the actual apply()/service/Intent path while a task write is being persisted.
  const env = makeContext()
  let storageClosed = false
  const open = env.ctx.storageDomain.open
  env.ctx.storageDomain.open = async (spec) => {
    const domain = await open(spec)
    domain.close = async () => { storageClosed = true }
    return domain
  }
  const plugin = apply(env.ctx, { autoRefresh: false, upstream: { context: false }, updates: { autoCheck: false } })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const started = deferred()
  const finish = deferred()
  const taskTable = env.tables.get(TABLES.tasks)
  const put = taskTable.put
  taskTable.put = async (key, value) => {
    started.resolve()
    await finish.promise
    assert.equal(storageClosed, false, 'Accepted task persistence must precede domain.close')
    await put(key, value)
  }
  const writing = plugin.service.execute({ name: 'task.add', operationId: 'shutdown-accepted-task', body: { title: 'Finish this accepted write' } })
  await started.promise
  const domainEffect = env.effects.find((effect) => effect.label === 'sooyo: domain')
  const disposed = domainEffect.dispose()
  await assert.rejects(async () => plugin.service.execute({ name: 'task.add', operationId: 'shutdown-refused-task', body: { title: 'Refuse this late write' } }), /升级或关闭/)
  check('updates: real Host disposal keeps storage open while an accepted command persists', !storageClosed && plugin.lifecycle.phase === 'closing')
  finish.resolve()
  const committed = await writing
  await disposed
  check('updates: the accepted command commits its Intent before real Host storage closes',
    storageClosed && committed.result?.ok === true && taskTable.size === 1
    && [...env.tables.get(TABLES.operations).entries()].some(([, value]) => value.operationId === 'shutdown-accepted-task' && value.status === 'committed'))
  for (const effect of [...env.effects].reverse()) await effect.dispose?.()

  const opening = makeContext()
  const opened = deferred()
  let tableReads = 0
  let closes = 0
  opening.ctx.storageDomain.open = () => opened.promise
  const initializing = apply(opening.ctx, { autoRefresh: false, upstream: { context: false }, updates: { autoCheck: false } })
  const stopOpening = opening.effects.find((effect) => effect.label === 'sooyo: domain').dispose()
  opened.resolve({ table: () => { tableReads++; throw new Error('Disposed initialization must not seed') }, close: async () => { closes++ } })
  await stopOpening
  check('updates: disposal during domain open closes once without seeding or reviving the old instance', closes === 1 && tableReads === 0 && !initializing.localRuntime().ready)
  for (const effect of [...opening.effects].reverse()) await effect.dispose?.()
}
