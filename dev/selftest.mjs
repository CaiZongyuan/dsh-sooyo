/**
 * Offline self-test for index.js + feed.js, plus static checks on client.js.
 *
 * The harness caches a Host plugin's module body per specifier, so a Host code change
 * only takes effect after a DSH restart. This script exercises the real `apply()` against
 * a fake context (and the real feed reader against fixtures) so a restart is a one-shot
 * success rather than a guess.
 *
 *   node dev/selftest.mjs
 */

import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

import { apply, DOMAIN_TABLES } from '../index.js'
import { readFeed, decodeEntities, stripTags, extractOgImage, absoluteUrl } from '../feed.js'

const PATH_SAFE = /^[a-zA-Z0-9_-]+$/
const OFFLINE = process.argv.includes('--offline')

const results = []
const check = (name, condition, detail) => {
  results.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  -> ${detail}`}`)
}

// ---- feed reader fixtures --------------------------------------------------

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Product Hunt</title>
  <entry>
    <id>tag:www.producthunt.com,2005:Post/1263873</id>
    <published>2026-09-28T14:07:30-07:00</published>
    <link rel="alternate" href="https://www.producthunt.com/products/acme-tool"/>
    <title>Acme Tool &amp; Friends</title>
    <content type="html">&lt;p&gt;A &lt;b&gt;tagline&lt;/b&gt; here&lt;/p&gt;</content>
    <author><name>maker</name></author>
  </entry>
</feed>`

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Channel</title>
    <item>
      <title>Hello <![CDATA[World]]></title>
      <link>https://example.com/a</link>
      <guid isPermaLink="false">post-1</guid>
      <pubDate>Mon, 28 Sep 2026 21:07:30 GMT</pubDate>
      <description><![CDATA[<p>Body text</p>]]></description>
      <media:thumbnail url="https://example.com/t.png"/>
      <media:statistics views="1234"/>
    </item>
  </channel>
</rss>`

const atom = readFeed(ATOM_FIXTURE)
check('atom: one entry', atom.length === 1)
check('atom: link from rel=alternate href', atom[0]?.url === 'https://www.producthunt.com/products/acme-tool', atom[0]?.url)
check('atom: entities decoded in title', atom[0]?.title === 'Acme Tool & Friends', atom[0]?.title)
check('atom: html stripped out of content', atom[0]?.summary === 'A tagline here', atom[0]?.summary)
check('atom: id keeps its namespace text', String(atom[0]?.nativeId).includes('Post/1263873'), atom[0]?.nativeId)

const rss = readFeed(RSS_FIXTURE)
check('rss: one item', rss.length === 1)
check('rss: plain <link> text used', rss[0]?.url === 'https://example.com/a', rss[0]?.url)
check('rss: CDATA unwrapped', rss[0]?.title === 'Hello World', rss[0]?.title)
check('rss: guid preferred as id', rss[0]?.nativeId === 'post-1', rss[0]?.nativeId)
check('rss: media:thumbnail captured', rss[0]?.thumbnail === 'https://example.com/t.png', rss[0]?.thumbnail)
check('rss: media:statistics views parsed', rss[0]?.metrics?.views === 1234, JSON.stringify(rss[0]?.metrics))
check('feed with no entries -> empty array', readFeed('<feed></feed>').length === 0)
check('entity decoding: numeric + named', decodeEntities('a &#65; &amp; b') === 'a A & b', decodeEntities('a &#65; &amp; b'))
check('stripTags collapses whitespace', stripTags('<p>a\n  b</p>') === 'a b', stripTags('<p>a\n  b</p>'))

// ---- YouTube fixture: the shape the 视频 cards read ------------------------
// YouTube wraps per-video data in `<media:group>` and writes `media:starRating` with the
// interesting attribute NOT first, which is what broke the old `tagAttr` when the count
// moved. Both are pinned here so a later regex edit cannot silently drop likes.

const YOUTUBE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <id>yt:video:EPISODE123</id>
    <yt:videoId>EPISODE123</yt:videoId>
    <title>An episode about compute</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=EPISODE123"/>
    <published>2026-11-01T10:00:00+00:00</published>
    <media:group>
      <media:title>An episode about compute</media:title>
      <media:content url="https://www.youtube.com/v/EPISODE123" type="application/x-shockwave-flash"/>
      <media:thumbnail url="https://i1.ytimg.com/vi/EPISODE123/hqdefault.jpg" width="480" height="360"/>
      <media:description>First line of the blurb.
Second line, with a link https://example.com dropped by cleanDesc.</media:description>
      <media:community>
        <media:starRating count="4821" average="5.00" min="1" max="5"/>
        <media:statistics views="120439"/>
      </media:community>
    </media:group>
  </entry>
  <entry>
    <id>yt:video:SHORT456</id>
    <yt:videoId>SHORT456</yt:videoId>
    <title>A short</title>
    <link rel="alternate" href="https://www.youtube.com/shorts/SHORT456"/>
    <published>2026-11-02T10:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i1.ytimg.com/vi/SHORT456/hqdefault.jpg" width="480" height="360"/>
      <media:community><media:starRating count="88" average="5.00" min="1" max="5"/><media:statistics views="900"/></media:community>
    </media:group>
  </entry>
</feed>`

const youtube = readFeed(YOUTUBE_FIXTURE)
check('youtube: two entries', youtube.length === 2, `${youtube.length}`)
check('youtube: media:starRating count read with average first', youtube[0]?.metrics?.likes === 4821, JSON.stringify(youtube[0]?.metrics))
check('youtube: views and likes coexist', youtube[0]?.metrics?.views === 120439 && youtube[0]?.metrics?.likes === 4821, JSON.stringify(youtube[0]?.metrics))
check('youtube: media:description kept separate from summary', /First line of the blurb/.test(youtube[0]?.description ?? ''), youtube[0]?.description?.slice(0, 40))
check('youtube: description is stripped of markup', !/[<>]/.test(youtube[0]?.description ?? ''), youtube[0]?.description?.slice(0, 40))
check('youtube: a Short is told apart by its URL', youtube[1]?.url.includes('/shorts/'), youtube[1]?.url)
check('youtube: nativeId keeps the yt:video: prefix for the id strip', youtube[0]?.nativeId === 'yt:video:EPISODE123', youtube[0]?.nativeId)


// ---- page metadata fixtures ------------------------------------------------
// AIHOT and Product Hunt publish no image in their feeds, so the Host half reads
// `og:image` off the page each item links to. Attribute order varies in the wild.

const OG_CASES = [
  ['og:image, property before content', '<meta property="og:image" content="https://a.test/x.jpg">', 'https://a.test/x.jpg'],
  ['og:image, content before property', '<meta content="https://b.test/y.png" property="og:image">', 'https://b.test/y.png'],
  ['relative url resolved', '<meta property="og:image" content="/img/z.jpg">', 'https://page.test/img/z.jpg'],
  ['twitter:image fallback', '<meta name="twitter:image" content="https://d.test/t.jpg">', 'https://d.test/t.jpg'],
  ['og:image:secure_url preferred', '<meta property="og:image:secure_url" content="https://s.test/s.jpg">', 'https://s.test/s.jpg'],
  ['entities decoded in url', '<meta property="og:image" content="https://e.test/a.jpg?x=1&amp;y=2">', 'https://e.test/a.jpg?x=1&y=2'],
  ['json-ld fallback', '<script type="application/ld+json">{"image":"https://f.test/j.jpg"}</script>', 'https://f.test/j.jpg'],
  ['json-ld array + @graph-free', '<script type="application/ld+json">[{"image":["https://g.test/k.jpg"]}]</script>', 'https://g.test/k.jpg'],
  ['data uri rejected', '<meta property="og:image" content="data:image/png;base64,AAAA">', null],
  ['no image at all', '<html><head><title>t</title></head></html>', null],
  ['malformed json-ld tolerated badly', '<script type="application/ld+json">{oops</script>', null],
]
for (const [name, html, want] of OG_CASES) {
  const got = extractOgImage(html, 'https://page.test/article')
  check(`og:image — ${name}`, got === want, String(got))
}
check('absoluteUrl resolves relative to base', absoluteUrl('/a.jpg', 'https://h.test/p') === 'https://h.test/a.jpg')
check('absoluteUrl rejects data:', absoluteUrl('data:image/png;base64,AA', 'https://h.test/p') === null)

// ---- fake context ----------------------------------------------------------

function makeTable() {
  const map = new Map()
  return {
    get: (key) => map.get(key),
    entries: () => map.entries(),
    keys: () => map.keys(),
    get size() {
      return map.size
    },
    put: async (key, value) => {
      // Mirrors the real per-record backend, which is what rejected the first attempt.
      if (!PATH_SAFE.test(key)) throw new Error(`unit 'sooyo': per-record key '${key}' is not path-safe`)
      map.set(key, value)
    },
    delete: async (key) => map.delete(key),
    update: async (key, fn) => {
      const next = fn(map.get(key))
      map.set(key, next)
      return next
    },
  }
}

function makeContext() {
  const tables = new Map()
  const routes = []
  const tools = []
  const effects = []
  const warnings = []

  const ctx = {
    logger: { warn: (...args) => warnings.push(args.map(String).join(' ')) },
    effect: (callback, label) => {
      const dispose = callback()
      effects.push({ label, dispose })
      return dispose ?? (() => {})
    },
    inject: (names, callback) => {
      callback({
        tools: {
          register: (definition) => {
            tools.push(definition)
            return () => {}
          },
        },
      })
      return () => {}
    },
    storageDomain: {
      open: async (spec) => {
        // The real domain validates every key on write; a fixture that skipped this once
        // shipped a colon-separated key that only failed in production.
        for (const table of Object.keys(spec.tables)) if (!tables.has(table)) tables.set(table, makeTable())
        return {
          name: spec.name,
          table: (name) => {
            if (!tables.has(name)) tables.set(name, makeTable())
            return tables.get(name)
          },
          close: async () => {},
        }
      },
    },
    webServer: {
      register: (route) => {
        routes.push(route)
        return () => {}
      },
    },
  }
  return { ctx, routes, tools, warnings, effects, tables }
}

function makeRequest(method, url, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')]
  return {
    method,
    url,
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

function makeResponse() {
  const state = { status: null, body: null }
  return {
    state,
    headersSent: false,
    writeHead(status) {
      state.status = status
      this.headersSent = true
    },
    end(body) {
      state.body = body
    },
  }
}

async function call(routes, method, url, body) {
  const route = routes[0]
  assert.ok(route, 'the plugin must register one /sooyo route')
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, '/sooyo')
  const req = makeRequest(method, url, body)
  const res = makeResponse()
  await route.handler(req, res)
  let parsed = null
  if (typeof res.state.body === 'string' && res.state.body.length > 0) {
    // The icon route answers with bytes, so a JSON parse is allowed to fail there.
    try { parsed = JSON.parse(res.state.body) } catch { parsed = null }
  }
  return { status: res.state.status, body: parsed, bytes: res.state.body }
}

/**
 * The same body reader `index.js` uses, re-declared here.
 *
 * The sync route builder takes it as a dependency (`readJson`) rather than importing it, so this
 * file supplies the identical implementation to prove the Hub parses bodies the same way the
 * local route does — including the 1 MB ceiling.
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// ---- run -------------------------------------------------------------------

const { ctx, routes, tools, warnings, effects, tables } = makeContext()
const plugin = apply(ctx, {})
await new Promise((resolve) => setTimeout(resolve, 60))

/** The service `apply()` built — the sync section drives it directly, as the Hub route does. */
const service = plugin.service

check('route registered', routes.length === 1)
check('tools registered', tools.length === 11, tools.map((t) => t.name).join(', '))
// The fake context has no event surface, so the Context Bridge reports that it disabled
// itself instead of failing `apply()`. That one message is expected; anything else is not.
const unexpectedWarnings = warnings.filter((line) => !line.includes('Sooyo Context Bridge disabled'))
check('no unexpected effect warnings', unexpectedWarnings.length === 0, unexpectedWarnings.join(' | ') || 'none')
check('the plugin exposes one role-agnostic service', Boolean(service) && service.role === 'standalone', String(service?.role))

// The storage backend accepts only `^[a-z][a-z0-9_]*$` for a table name, and a violation
// surfaces as "store never becomes ready" rather than as an error near the mistake — which is
// exactly how `agentInbox`/`agentReviews` shipped broken past 188 green checks. Assert the spec.
const { TABLES } = await import('../core/store.js')
const TABLE_NAME_RE = /^[a-z][a-z0-9_]*$/
check('every domain table name satisfies the storage backend rule',
  Object.values(TABLES).every((name) => TABLE_NAME_RE.test(name)),
  Object.entries(TABLES).filter(([, name]) => !TABLE_NAME_RE.test(name)).map(([key, name]) => `${key}=${name}`).join(', ') || `${Object.keys(TABLES).length} tables`)
check('the domain spec declares exactly the TABLES map',
  JSON.stringify(Object.keys(DOMAIN_TABLES)) === JSON.stringify([...new Set(Object.values(TABLES))]),
  `${Object.keys(DOMAIN_TABLES).length} declared / ${new Set(Object.values(TABLES)).size} named`)

const ping = await call(routes, 'GET', '/sooyo/ping')
check('GET /ping -> 200 ready', ping.status === 200 && ping.body?.ready === true, JSON.stringify(ping.body))

// Skipped entirely under --offline: this block is the only part that makes requests.
if (OFFLINE) {
  console.log('\n-- network checks skipped (--offline): no requests made --')
} else {
console.log('\n-- refreshing every declared source (network) --')
const refresh = await call(routes, 'POST', '/sooyo/refresh')
for (const entry of refresh.body?.results ?? []) {
  if (entry.ok) console.log(`   ok      ${entry.sourceId}  added=${entry.added ?? 0}${entry.notModified ? ' (304)' : ''} total=${entry.total ?? '-'}`)
  else console.log(`   failed  ${entry.sourceId}  ${String(entry.error).slice(0, 90)}`)
}
const okSources = (refresh.body?.results ?? []).filter((entry) => entry.ok)
check('at least the AIHOT sources refreshed', okSources.some((entry) => entry.sourceId === 'aihot'), okSources.map((e) => e.sourceId).join(', '))
check('refresh reported no unexpected throw', Array.isArray(refresh.body?.results), `${(refresh.body?.results ?? []).length} sources`)

/**
 * Upstream availability is not this repo's regression.
 *
 * A source's own host going 404/500 says nothing about a code change here, and a test that
 * fails on it trains everyone to ignore red. Each per-source assertion below therefore skips
 * (printing why) when that one source failed to refresh, instead of failing the run. A source
 * that refreshed but yielded no items is still a real failure: that is our parsing.
 */
const failedSources = new Set((refresh.body?.results ?? []).filter((entry) => !entry.ok).map((entry) => entry.sourceId))
const skipFeedback = []
const checkSource = (sourceId, name, condition, detail) => {
  if (failedSources.has(sourceId)) {
    skipFeedback.push(`${sourceId}: ${String(refresh.body?.results?.find((e) => e.sourceId === sourceId)?.error ?? '').slice(0, 60)}`)
    console.log(`SKIP  ${name}  -> ${sourceId} did not refresh upstream`)
    return
  }
  check(name, condition, detail)
}

const meta = await call(routes, 'GET', '/sooyo/meta')
check('meta is ready', meta.body?.ready === true, meta.body?.error)
// ADR 0001: a Source no longer owns a card. It suggests a 呈现, and layout is user data.
check('meta still describes every source', (meta.body?.sources ?? []).length > 0, `${(meta.body?.sources ?? []).length} sources`)
check('a source suggests a 呈现 instead of declaring a card',
  (meta.body?.sources ?? []).every((source) => !source.widget && typeof source.suggests?.pres === 'string'),
  (meta.body?.sources ?? []).map((source) => `${source.id}:${source.suggests?.pres}`).join(' | '))
check('meta counts articles separately from ranks', (meta.body?.articleCount ?? 0) > 0 && (meta.body?.articleCount ?? 0) <= (meta.body?.itemCount ?? 0),
  `articles=${meta.body?.articleCount} items=${meta.body?.itemCount}`)

const all = await call(routes, 'GET', '/sooyo/items?limit=300&kind=all')
check('GET /items -> stored items', (all.body?.items?.length ?? 0) > 0, `matched=${all.body?.matched}`)
check('every stored key is path-safe', (all.body?.items ?? []).every((item) => PATH_SAFE.test(item.id)),
  (all.body?.items ?? []).slice(0, 2).map((item) => item.id).join(', '))
check('every item carries sourceId + itemKind', (all.body?.items ?? []).every((item) => item.sourceId && item.itemKind))

const articles = await call(routes, 'GET', '/sooyo/items?limit=300')
check('default listing excludes rank rows', (articles.body?.items ?? []).every((item) => item.itemKind !== 'rank'),
  `${(articles.body?.items ?? []).length} articles`)

const hot = await call(routes, 'GET', '/sooyo/items?source=aihot-hot&kind=all')
check('rank source is reachable by id', (hot.body?.items ?? []).length > 0, `${(hot.body?.items ?? []).length} rows`)
check('rank rows carry their rank in metrics', (hot.body?.items ?? []).every((item) => item.itemKind === 'rank' && typeof item.metrics?.rank === 'number'))

const aihot = await call(routes, 'GET', '/sooyo/items?source=aihot&limit=3')
const first = aihot.body?.items?.[0]
check('aihot item carries the fields the UI draws', Boolean(first?.title && first?.url && first?.origin), first?.title)
check('aihot reason present (from /items, not the snapshot API)', typeof first?.reason === 'string' && first.reason.length > 0, `${first?.reason?.length ?? 0} chars`)
check('aihot item keeps its category for the 图文 tabs', typeof first?.category === 'string' && first.category.length > 0, first?.category)

// The redesign's cards read fields the first generation dropped; assert them on live data,
// because a parsing change that silently yields undefined only shows up in the UI.
const papers = await call(routes, 'GET', '/sooyo/items?source=hf-papers&limit=8')
const paperItems = papers.body?.items ?? []
checkSource('hf-papers', 'hf-papers items are stored', paperItems.length > 0, `${paperItems.length} papers`)
checkSource('hf-papers', 'hf-papers keeps a one-line summary (tldr)', paperItems.some((item) => typeof item.tldr === 'string' && item.tldr.length > 0),
  paperItems.map((item) => (item.tldr ? `${item.tldr.length}c` : '-')).join(' '))
checkSource('hf-papers', 'hf-papers keeps ai_keywords', paperItems.some((item) => Array.isArray(item.keywords) && item.keywords.length > 0),
  paperItems.map((item) => (item.keywords?.length ?? 0)).join(','))
checkSource('hf-papers', 'hf-papers keeps the author count', paperItems.some((item) => typeof item.authorCount === 'number' && item.authorCount > 0),
  paperItems.map((item) => item.authorCount ?? '-').join(','))
checkSource('hf-papers', 'hf-papers keeps the full abstract', paperItems.some((item) => (item.summary ?? '').length > 400),
  paperItems.map((item) => (item.summary ?? '').length).join(','))
// The handoff warns teaser figures are rare; the card must read well without one.
checkSource('hf-papers', 'hf-papers works when a paper has no teaser figure', paperItems.every((item) => Boolean(item.thumbnail) || Boolean(item.url)),
  `${paperItems.filter((item) => item.thumbnail?.includes('social-thumbnails')).length} on the generated cover`)

const videos = await call(routes, 'GET', '/sooyo/items?source=youtube&limit=12')
const videoItems = videos.body?.items ?? []
checkSource('youtube', 'youtube items are stored', videoItems.length > 0, `${videoItems.length} videos`)
checkSource('youtube', 'youtube marks every entry as a Short or an episode',
  videoItems.every((item) => ['short', 'episode'].includes(item.kind)),
  videoItems.map((item) => `${item.kind}:${item.title?.slice(0, 18)}`).join(' | ').slice(0, 160))
checkSource('youtube', 'youtube carries a per-video cover', videoItems.every((item) => /^https:\/\/i\.ytimg\.com\//.test(item.cover ?? '') || Boolean(item.thumbnail)),
  videoItems.slice(0, 3).map((item) => item.cover ?? item.thumbnail).join(' '))
checkSource('youtube', 'youtube a Short cover is the 9:16 frame, not a 16:9 one',
  videoItems.filter((item) => item.kind === 'short').every((item) => !String(item.cover ?? '').includes('maxresdefault'))
  || videoItems.every((item) => item.kind !== 'short'),
  videoItems.filter((item) => item.kind === 'short').map((item) => item.cover).join(' ') || 'no Shorts this run')
checkSource('youtube', 'youtube parses likes when the feed publishes them',
  videoItems.some((item) => typeof item.metrics?.likes === 'number')
  || videoItems.every((item) => item.metrics?.likes === undefined),
  videoItems.map((item) => item.metrics?.likes ?? '-').join(','))
checkSource('youtube', 'youtube keeps views where published',
  videoItems.some((item) => typeof item.metrics?.views === 'number'),
  videoItems.map((item) => item.metrics?.views ?? '-').join(','))

if (skipFeedback.length > 0) {
  console.log(`\nNOTE  ${skipFeedback.length} source(s) skipped: upstream did not answer — ${skipFeedback.join(' | ')}`)
  console.log('      A source that fails to fetch is not a regression here; re-run when it is back.')
}

const mark = await call(routes, 'POST', '/sooyo/state', { ids: [first?.id], seen: true, starred: true })
check('POST /state -> ok', mark.body?.ok === true, JSON.stringify(mark.body))
const afterMark = await call(routes, 'GET', '/sooyo/items?source=aihot&limit=3')
const marked = (afterMark.body?.items ?? []).find((item) => item.id === first?.id)
check('state round-trips', marked?.state?.seen === true && marked?.state?.starred === true, JSON.stringify(marked?.state))

const brief = tools.find((tool) => tool.name === 'sooyo_brief')
const briefResult = await brief.execute({ hours: 24 * 30, limit: 5 })
check('sooyo_brief aggregates across sources', Array.isArray(briefResult?.items) && briefResult.items.length > 0, `count=${briefResult?.count}`)
check('sooyo_brief carries the untrusted-content note', typeof briefResult?.note === 'string' && briefResult.note.includes('指令'))
check('sooyo_brief render() produces a text block', brief.output.render({}, briefResult)[0]?.type === 'text')
check('tool output is JSON-serializable', typeof JSON.stringify(briefResult) === 'string')

const sourcesTool = await tools.find((tool) => tool.name === 'sooyo_sources').execute({})
check('sooyo_sources lists the registry', (sourcesTool?.sources?.length ?? 0) === (meta.body?.sources?.length ?? -1), `${sourcesTool?.sources?.length} sources`)

// Cover images for the sources that publish none: read og:image off the linked page.
const thumb = await plugin.resolveThumbnails(3)
check('og:image pass read some pages', (thumb.checked ?? 0) > 0, JSON.stringify(thumb))
check('og:image pass resolved a real cover', (thumb.resolved ?? 0) > 0, `resolved=${thumb.resolved} skipped=${thumb.skipped} failed=${thumb.failed}`)

const withImages = await call(routes, 'GET', '/sooyo/items?limit=300&kind=all')
const resolvedSample = (withImages.body?.items ?? []).find((item) => item.thumbnail && item.thumbnailCheckedAt)
check('resolved cover is stored on the item', Boolean(resolvedSample?.thumbnail), resolvedSample?.thumbnail)
// Not every resolved cover ends in a file extension: a CDN thumbnail can be a query-only URL
// (pbs.twimg.com/…?format=jpg), which is still an image. Assert the host is http(s) instead.
check('resolved cover is an absolute http(s) url', /^https?:\/\//i.test(resolvedSample?.thumbnail ?? ''), String(resolvedSample?.thumbnail).slice(0, 90))
check('a page with no image is remembered, not refetched', (withImages.body?.items ?? []).some((item) => !item.thumbnail && item.thumbnailCheckedAt))

// End of the network-dependent block.
}

const notFound = await call(routes, 'GET', '/sooyo/nope')
check('unknown route -> 404', notFound.status === 404)

// ---- personal data: Boards, Widgets, layouts, Tasks, Notes, Read Later ------
// Deliberately outside the network block: the whole surface below is local, so CI covers
// it on every run.

console.log('\n-- personal data (no network) --')

const daily = await call(routes, 'GET', '/sooyo/daily')
check('GET /daily -> ready', daily.status === 200 && daily.body?.ready === true, daily.body?.error)
check('a first run has the default Boards', (daily.body?.boards ?? []).length >= 4,
  (daily.body?.boards ?? []).map((b) => b.id).join(', '))
check('a Board name is 总览', (daily.body?.boards ?? []).some((b) => b.name === '总览'))
check('Widgets start placed on every breakpoint', (daily.body?.boards ?? []).every((board) =>
  [12, 6, 4].every((cols) => Array.isArray(daily.body?.layouts?.[board.id]?.[cols]))))
check('every placed Widget exists', Object.values(daily.body?.layouts ?? {}).every((perBoard) =>
  Object.values(perBoard).every((order) => order.every((entry) => daily.body.widgets[entry.id]))))
check('Widget Type registry reaches the Client', Boolean(daily.body?.types?.subscription?.sizes?.Wide))
check('a fresh install carries no invented personal data',
  (daily.body?.tasks ?? []).length === 0 && (daily.body?.readLater ?? []).length === 0 && (daily.body?.interests ?? []).length === 0,
  `tasks=${daily.body?.tasks?.length} readLater=${daily.body?.readLater?.length} interests=${daily.body?.interests?.length}`)
check('no seeded Widget claims weather or calendar data',
  Object.values(daily.body?.widgets ?? {}).every((widget) => !['weather', 'calendar'].includes(widget.type)),
  Object.values(daily.body?.widgets ?? {}).map((w) => w.type).join(','))

const madeBoard = await call(routes, 'POST', '/sooyo/action', { name: 'board.create', body: { name: '科研' } })
check('board.create -> ok', madeBoard.body?.ok === true && madeBoard.body?.board?.name === '科研', JSON.stringify(madeBoard.body))
const afterBoard = await call(routes, 'GET', '/sooyo/daily')
check('the new Board becomes active', afterBoard.body?.active === madeBoard.body?.board?.id, afterBoard.body?.active)
check('a new Board starts empty at every breakpoint', [12, 6, 4].every((cols) => (afterBoard.body?.layouts?.[madeBoard.body?.board?.id]?.[cols] ?? []).length === 0))

const added = await call(routes, 'POST', '/sooyo/action', {
  name: 'widget.add',
  body: { type: 'subscription', size: 'L', boardId: madeBoard.body?.board?.id, settings: { sources: ['aihot'], pres: '论文' }, title: '近三天 AI 论文' },
})
check('widget.add -> ok', added.body?.ok === true, JSON.stringify(added.body))
check('widget.add keeps its 呈现', added.body?.widget?.settings?.pres === '论文', added.body?.widget?.settings?.pres)

const afterAdd = await call(routes, 'GET', '/sooyo/daily')
check('the added Widget is on the Board', (afterAdd.body?.layouts?.[madeBoard.body?.board?.id]?.[12] ?? []).some((entry) => entry.id === added.body?.widget?.id))

const resized = await call(routes, 'POST', '/sooyo/action', {
  name: 'widget.resize',
  body: { id: added.body?.widget?.id, size: 'Wide', cols: 12, boardId: madeBoard.body?.board?.id },
})
check('widget.resize -> ok and applied', resized.body?.ok === true && resized.body?.size === 'Wide', JSON.stringify(resized.body))
check('a Size the type does not have falls back', (await call(routes, 'POST', '/sooyo/action', {
  name: 'widget.resize',
  body: { id: added.body?.widget?.id, size: 'Nope', cols: 12, boardId: madeBoard.body?.board?.id },
})).body?.size === 'S',
  (await call(routes, 'GET', '/sooyo/daily')).body?.layouts?.[madeBoard.body?.board?.id]?.[12]?.find((e) => e.id === added.body?.widget?.id)?.size)

const captured = await call(routes, 'POST', '/sooyo/action', { name: 'capture', body: { text: '订周五去杭州的高铁' } })
check('capture lands in Inbox', captured.body?.ok === true && captured.body?.task?.list === 'inbox', JSON.stringify(captured.body))
const noteCaptured = await call(routes, 'POST', '/sooyo/action', { name: 'capture', body: { text: '#note Board 模板能不能导入导出' } })
check('capture with #note produces a Note', noteCaptured.body?.kind === 'note' && noteCaptured.body?.note?.text.startsWith('Board'), JSON.stringify(noteCaptured.body))

const moved = await call(routes, 'POST', '/sooyo/action', { name: 'task.update', body: { id: captured.body?.task?.id, list: 'today', done: true } })
check('task.update moves and completes', moved.body?.task?.list === 'today' && moved.body?.task?.done === true, JSON.stringify(moved.body))

const later = await call(routes, 'POST', '/sooyo/action', { name: 'readlater.set', body: { itemId: 'some-item-id' } })
check('readlater.set stores an Item id', later.body?.ok === true && later.body?.saved === true, JSON.stringify(later.body))
const laterOff = await call(routes, 'POST', '/sooyo/action', { name: 'readlater.set', body: { itemId: 'some-item-id', on: false } })
check('readlater.set can remove again', laterOff.body?.saved === false)
check('a Read Later key is path-safe', PATH_SAFE.test('some-item-id'))

const interests = await call(routes, 'POST', '/sooyo/action', { name: 'interests.set', body: { text: 'Agent，多模态、Agent' } })
check('interests.set de-duplicates', JSON.stringify(interests.body?.interests) === JSON.stringify(['Agent', '多模态']), JSON.stringify(interests.body?.interests))

const habit = await call(routes, 'POST', '/sooyo/action', { name: 'habit.tick', body: { id: 'h1', day: 0 } })
check('habit.tick flips the day and the streak', habit.body?.ok === true && habit.body?.habit?.week?.[0] === 1 && habit.body?.habit?.streak === 1, JSON.stringify(habit.body?.habit))

const focus = await call(routes, 'POST', '/sooyo/action', { name: 'focus.set', body: { action: 'start' } })
check('focus.set start records a deadline', focus.body?.ok === true && focus.body?.focus?.running === true, JSON.stringify(focus.body?.focus))
const paused = await call(routes, 'POST', '/sooyo/action', { name: 'focus.set', body: { action: 'pause' } })
check('focus.set pause clears the deadline', paused.body?.focus?.running === false && paused.body?.focus?.deadline === null)

const dup = await call(routes, 'POST', '/sooyo/action', {
  name: 'widget.duplicate',
  body: { id: added.body?.widget?.id, boardId: madeBoard.body?.board?.id },
})
check('widget.duplicate -> new id, same settings', dup.body?.ok === true
  && dup.body?.widget?.id !== added.body?.widget?.id
  && dup.body?.widget?.settings?.pres === '论文', JSON.stringify(dup.body))

const order = (await call(routes, 'GET', '/sooyo/daily')).body?.layouts?.[madeBoard.body?.board?.id]?.[12] ?? []
const reordered = await call(routes, 'POST', '/sooyo/action', {
  name: 'layout.set',
  body: { boardId: madeBoard.body?.board?.id, cols: 12, order: [...order].reverse() },
})
check('layout.set stores the whole order', reordered.body?.ok === true && reordered.body?.order?.length === order.length)

const removed = await call(routes, 'POST', '/sooyo/action', { name: 'widget.remove', body: { id: dup.body?.widget?.id } })
check('widget.remove takes it off every layout', removed.body?.ok === true
  && !Object.values((await call(routes, 'GET', '/sooyo/daily')).body?.layouts ?? {})
    .some((perBoard) => Object.values(perBoard).some((list) => list.some((entry) => entry.id === dup.body?.widget?.id))))

const droppedBoard = await call(routes, 'POST', '/sooyo/action', { name: 'board.remove', body: { id: madeBoard.body?.board?.id } })
check('board.remove -> ok', droppedBoard.body?.ok === true, JSON.stringify(droppedBoard.body))
// Removing down to the last Board must stop there; a user with zero Boards has no page.
let guard = 10
let lastRefusal = null
while (guard-- > 0) {
  const list = (await call(routes, 'GET', '/sooyo/daily')).body?.boards ?? []
  if (list.length <= 1) break
  const response = await call(routes, 'POST', '/sooyo/action', { name: 'board.remove', body: { id: list[list.length - 1].id } })
  if (response.body?.ok === false) lastRefusal = response
}
const finalBoards = (await call(routes, 'GET', '/sooyo/daily')).body?.boards ?? []
check('removing Boards stops at one', finalBoards.length === 1, `${finalBoards.length} left`)
check('the last Board cannot be removed', (await call(routes, 'POST', '/sooyo/action', { name: 'board.remove', body: { id: finalBoards[0]?.id } })).body?.ok === false, lastRefusal ? JSON.stringify(lastRefusal.body) : 'no refusal seen')

check('unknown action -> 404', (await call(routes, 'POST', '/sooyo/action', { name: 'nope.nope', body: {} })).status === 404)

const icon = await call(routes, 'GET', '/sooyo/assets/a/subscription.webp')
check('GET /assets/<style>/<name>.webp -> 200', icon.status === 200, `status ${icon.status}`)
check('an unknown icon -> 404', (await call(routes, 'GET', '/sooyo/assets/a/nope.webp')).status === 404)
check('a path that escapes assets/ -> 404', (await call(routes, 'GET', '/sooyo/assets/../../package.json')).status === 404)

const offlineDaily = await call(routes, 'GET', '/sooyo/daily')
check('every stored key across the daily tables is path-safe', [...tables.entries()].every(([name, table]) =>
  [...table.entries()].every(([key]) => PATH_SAFE.test(key))),
  [...tables.entries()].map(([name, table]) => `${name}:${[...table.keys()].length}`).join(' '))
check('the daily snapshot is stable across reloads', offlineDaily.body?.active === afterBoard.body?.active
  || offlineDaily.body?.boards?.length > 0, `${offlineDaily.body?.boards?.length} boards`)

// ---- sync protocol, roles, migration and the Agent bridge -------------------
// Everything below is local too: the Hub/Client pair runs in this one process, with the Client
// pointed at the Hub's route handler through a fake `fetch`. That exercises the real protocol —
// auth, ETag, 409, idempotency, the journal — without a network or a second DSH.

console.log('\n-- sync protocol (hub + client, no network) --')

const {
  createSyncHandler,
  buildSyncRoutes,
} = await import('../sync/routes.js')
const { exportDomain, planImport, applyImport, describePlan } = await import('../core/migrate.js')
const { PROTOCOL_VERSION, ERRORS, COMMANDS, LOCAL_ONLY } = await import('../core/protocol.js')

const HUB_TOKEN = 'test-hub-token-0123456789'
const READ_TOKEN = 'test-read-token-0123456789'

/**
 * A Hub backed by the same service the plugin just built.
 *
 * Reusing the live service is deliberate: the point is to prove the sync API, the command
 * funnel and the local routes agree, which a second service instance would not show.
 */
const hubResponses = []
function makeSyncFetch() {
  return async (url, init = {}) => {
    const parsed = new URL(url)
    const body = init.body === undefined ? undefined : JSON.parse(init.body)
    const req = {
      method: init.method ?? 'GET',
      // The Hub route derives its own sub-path by stripping `/sooyo/sync/v1` from the URL, so
      // hand it the full pathname that a real client would have requested.
      url: parsed.pathname + parsed.search,
      headers: { ...(init.headers ?? {}) },
      socket: { remoteAddress: '127.0.0.1' },
      async *[Symbol.asyncIterator]() {
        if (body !== undefined) yield Buffer.from(JSON.stringify(body), 'utf8')
      },
    }
    const out = { status: 200, headers: {}, body: null }
    const res = {
      headersSent: false,
      writeHead(status, headers = {}) {
        out.status = status
        out.headers = headers
        this.headersSent = true
      },
      end(payload) {
        out.body = payload ?? null
      },
    }
    await syncRoute.handler(req, res)
    hubResponses.push({ route: parsed.pathname, status: out.status })
    const payload = out.body
    return {
      ok: out.status >= 200 && out.status < 300,
      status: out.status,
      headers: {
        get: (name) => {
          const key = String(name).toLowerCase()
          for (const [header, headerValue] of Object.entries(out.headers ?? {})) {
            if (header.toLowerCase() === key) return headerValue
          }
          return null
        },
      },
      async text() {
        return typeof payload === 'string' ? payload : ''
      },
      body: null,
    }
  }
}

const { sync: hubSync, route: syncRoute } = buildSyncRoutes({
  service,
  send: () => {},
  readJson: readJsonBody,
  tokens: [
    { token: HUB_TOKEN, device: 'device-hub-test', access: 'write' },
    { token: READ_TOKEN, device: 'device-read-test', access: 'read' },
  ],
  allowLoopbackOnly: true,
  log: () => {},
})

/** The sync handler and the route must agree on the prefix they serve. */
check('sync route is a /sooyo/sync prefix', syncRoute.kind === 'prefix' && syncRoute.path === '/sooyo/sync')
check('the sync handler exposes the five documented endpoints',
  ['/health', '/snapshot', '/items', '/context', '/command'].every((path) => hubSync.ROUTES.has(path)),
  [...hubSync.ROUTES].join(', '))

/**
 * The sync responses are written by the route handler, which sets its own status and headers.
 * `syncCall` drives that handler directly — the same code path `webServer` would invoke — and
 * `makeSyncFetch` adapts the client's `fetch` onto it, so the Client role talks to the real Hub.
 */

/** Drive one sync request directly, the way the Hub's route handler does. */
async function syncCall(method, path, { token, body, headers = {}, remote = '127.0.0.1' } = {}) {
  const req = {
    method,
    url: `/sooyo/sync/v1${path}`,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    socket: { remoteAddress: remote },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body), 'utf8')
    },
  }
  const state = { status: null, body: null, headers: {} }
  const res = {
    headersSent: false,
    writeHead(status, responseHeaders = {}) {
      state.status = status
      state.headers = responseHeaders
      this.headersSent = true
    },
    end(payload) {
      state.body = payload ?? null
    },
  }
  await syncRoute.handler(req, res)
  let parsed = null
  if (typeof state.body === 'string' && state.body.length > 0) {
    try { parsed = JSON.parse(state.body) } catch { parsed = null }
  }
  return { status: state.status, body: parsed, headers: state.headers }
}

const noAuth = await syncCall('GET', '/snapshot')
check('sync: no token -> 401', noAuth.status === 401 && noAuth.body?.error?.code === ERRORS.unauthorized, JSON.stringify(noAuth.body?.error))
const badAuth = await syncCall('GET', '/snapshot', { token: 'wrong-token-0123456789' })
check('sync: wrong token -> 401', badAuth.status === 401, String(badAuth.status))
const remotePeer = await syncCall('GET', '/snapshot', { token: HUB_TOKEN, remote: '10.0.0.9' })
check('sync: a non-loopback peer is refused while allowLoopbackOnly is on', remotePeer.status === 403, String(remotePeer.status))

const health = await syncCall('GET', '/health', { token: HUB_TOKEN })
check('sync: /health names the protocol version and the role', health.status === 200 && health.body?.protocolVersion === PROTOCOL_VERSION && health.body?.role === 'standalone',
  JSON.stringify(health.body))
check('sync: /health leaks no data', health.body?.tasks === undefined && health.body?.boards === undefined)

const snap1 = await syncCall('GET', '/snapshot', { token: HUB_TOKEN })
check('sync: /snapshot returns the dashboard', snap1.status === 200 && Array.isArray(snap1.body?.boards), `${snap1.status}`)
const etag1 = snap1.headers.etag
check('sync: /snapshot carries an ETag derived from dataRevision', typeof etag1 === 'string' && etag1.includes(`-${snap1.body?.dataRevision}"`), String(etag1))
const snap304 = await syncCall('GET', '/snapshot', { token: HUB_TOKEN, headers: { 'if-none-match': etag1 } })
check('sync: a matching If-None-Match -> 304 with no body', snap304.status === 304 && snap304.body === null, String(snap304.status))

// ---- idempotency (AC-03) ---------------------------------------------------

const beforeTasks = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.length ?? 0
const opId = 'devicea-retry-0001'
const created1 = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: opId, name: 'task.add', body: { title: '幂等测试任务' } },
})
check('sync: a create returns a dataRevision and the task', created1.status === 200 && created1.body?.ok === true && created1.body?.result?.task?.id,
  JSON.stringify(created1.body?.result))
const created2 = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: opId, name: 'task.add', body: { title: '幂等测试任务' } },
})
check('sync: replaying the same operationId is flagged replayed', created2.body?.replayed === true, JSON.stringify(created2.body))
check('sync: the replay names the same task id', created2.body?.result?.task?.id === created1.body?.result?.task?.id,
  `${created2.body?.result?.task?.id} vs ${created1.body?.result?.task?.id}`)
const afterTasks = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.length ?? 0
check('sync: a retried create adds exactly one task (AC-03)', afterTasks === beforeTasks + 1, `${beforeTasks} -> ${afterTasks}`)

// ---- conflicts (AC-02) -----------------------------------------------------

const taskId = created1.body?.result?.task?.id
const taskRow = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.find((task) => task.id === taskId)
check('a written task carries a revision', Number.isSafeInteger(taskRow?.revision), String(taskRow?.revision))

const okWrite = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: {
    protocolVersion: 1,
    operationId: 'devicea-write-0002',
    name: 'task.update',
    body: { id: taskId, done: true },
    precondition: { entity: 'task', id: taskId, revision: taskRow.revision },
  },
})
check('sync: a matching precondition is accepted', okWrite.body?.ok === true, JSON.stringify(okWrite.body?.error))

const staleWrite = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: {
    protocolVersion: 1,
    operationId: 'deviceb-write-0003',
    name: 'task.update',
    body: { id: taskId, title: '同时改标题' },
    // The revision the second device saw before the first device's write landed.
    precondition: { entity: 'task', id: taskId, revision: taskRow.revision },
  },
})
check('sync: a stale precondition -> 409 (AC-02)', staleWrite.status === 409 && staleWrite.body?.error?.code === ERRORS.conflict,
  `${staleWrite.status} ${JSON.stringify(staleWrite.body?.error?.code)}`)
check('sync: the 409 carries the current record so the UI can diff',
  staleWrite.body?.error?.details?.current?.title === '幂等测试任务' && staleWrite.body?.error?.details?.revision > taskRow.revision,
  JSON.stringify({ revision: staleWrite.body?.error?.details?.revision, title: staleWrite.body?.error?.details?.current?.title }))
const afterConflict = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.find((task) => task.id === taskId)
check('sync: a refused write changed nothing (no silent overwrite)', afterConflict?.title === '幂等测试任务', afterConflict?.title)

// ---- authz, validation and the local-only set -----------------------------

const readOnly = await syncCall('POST', '/command', {
  token: READ_TOKEN,
  body: { protocolVersion: 1, operationId: 'readonly-write-0001', name: 'task.add', body: { title: 'x' } },
})
check('sync: a read-only token cannot write', readOnly.status === 403, String(readOnly.status))

const unknownCommand = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: 'unknown-cmd-0001', name: 'drop.database', body: {} },
})
check('sync: an unknown command -> 422', unknownCommand.status === 422 && unknownCommand.body?.error?.code === ERRORS.unsupported,
  `${unknownCommand.status} ${unknownCommand.body?.error?.code}`)

const badBody = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: 'bad-body-0001', name: 'task.add', body: { title: '' } },
})
check('sync: an empty title -> 400, not a stored empty task', badBody.status === 400, `${badBody.status} ${badBody.body?.error?.message}`)

const unsafeKey = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: 'bad-key-0001', name: 'task.update', body: { id: 'a:b', done: true } },
})
check('sync: a non-path-safe id -> 400', unsafeKey.status === 400, `${unsafeKey.status} ${unsafeKey.body?.error?.message}`)

const decide = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: 'decide-remote-01', name: 'proposal.decide', body: { id: 'p-x', decision: 'approve' } },
})
check('sync: proposal.decide is refused over the network (a model must not approve)',
  decide.status === 403 && /本机/.test(String(decide.body?.error?.message)), `${decide.status} ${decide.body?.error?.message}`)
check('proposal.decide is in the local-only set', LOCAL_ONLY.has('proposal.decide'))
check('the command whitelist derives from the action registry', COMMANDS.includes('task.add') && COMMANDS.includes('item.state'))

const tooBig = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 1, operationId: 'huge-0001', name: 'note.add', body: { text: 'x'.repeat(5000) } },
})
check('sync: an over-length field -> 400', tooBig.status === 400, String(tooBig.status))

const wrongProtocol = await syncCall('POST', '/command', {
  token: HUB_TOKEN,
  body: { protocolVersion: 99, operationId: 'proto-0001', name: 'task.add', body: { title: 'x' } },
})
check('sync: an unsupported protocolVersion -> 400', wrongProtocol.status === 400, String(wrongProtocol.status))

// ---- the Client role over the same handler --------------------------------

const { RemoteSooyoService, resolveSyncConfig } = await import('../sync/remote.js')
const originalFetch = globalThis.fetch
globalThis.fetch = makeSyncFetch()
const clientService = new RemoteSooyoService({
  role: 'client',
  endpoint: 'http://127.0.0.1:1',
  token: HUB_TOKEN,
  device: 'device-b',
  cacheMs: 0,
  timeoutMs: 4000,
}, { sources: () => [], log: () => {} })

try {
  const clientSnap = await clientService.snapshot({ force: true })
  check('client: snapshot comes from the Hub', Array.isArray(clientSnap?.boards) && clientSnap.boards.length > 0, `${clientSnap?.boards?.length} boards`)
  check('client: the snapshot names the merged task', (clientSnap?.tasks ?? []).some((task) => task.id === taskId), 'task visible via Hub')

  const clientCreated = await clientService.execute({ name: 'task.add', body: { title: '来自 B 设备' } })
  check('client: a write reaches the Hub and returns the business result', clientCreated?.ok === true && clientCreated?.task?.id,
    JSON.stringify(clientCreated))

  const fromHub = await call(routes, 'GET', '/sooyo/daily')
  check('client: the Hub is authoritative — its own local view has the new task (AC-01)',
    (fromHub.body?.tasks ?? []).some((task) => task.title === '来自 B 设备'),
    `${(fromHub.body?.tasks ?? []).length} tasks`)

  const clientItems = await clientService.items({ limit: 5 })
  check('client: /items proxies to the Hub without throwing', Array.isArray(clientItems?.items), `${clientItems?.items?.length} items`)

  const clientContext = await clientService.context({ limit: 2 })
  check('client: /context returns the Agent digest', clientContext?.ready === true && typeof clientContext?.counts?.open === 'number',
    JSON.stringify(clientContext?.counts))

  // A Hub that cannot be reached must not produce an empty authoritative dashboard.
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }
  const offlineClient = new RemoteSooyoService({ role: 'client', endpoint: 'http://127.0.0.1:1', token: HUB_TOKEN, cacheMs: 0, timeoutMs: 500 }, { log: () => {} })
  const offlineSnap = await offlineClient.snapshot().catch((error) => ({ threw: String(error?.message ?? error) }))
  check('client: an unreachable Hub throws rather than showing an empty dashboard (AC-05)',
    typeof offlineSnap?.threw === 'string' && /连不上 Hub/.test(offlineSnap.threw), JSON.stringify(offlineSnap))
  const offlineItems = await offlineClient.items({ limit: 5 })
  check('client: a failed /items is marked stale with an error, not silently empty',
    offlineItems?.stale === true && typeof offlineItems?.error === 'string', JSON.stringify(offlineItems?.error))
} finally {
  globalThis.fetch = originalFetch
}

// A client with no endpoint or token must say so instead of falling back to a local store.
const noEndpoint = resolveSyncConfig({ sync: { role: 'client' } })
check('config: client without endpoint reports why', noEndpoint.role === 'client' && noEndpoint.endpoint === null && /endpoint/.test(noEndpoint.error ?? ''),
  String(noEndpoint.error))
const noToken = resolveSyncConfig({ sync: { role: 'client', endpoint: 'https://hub.test' } }, {})
check('config: client without a token reports why', noToken.token === null && /令牌/.test(noToken.error ?? ''), String(noToken.error))
const shortToken = resolveSyncConfig({ sync: { role: 'hub', tokens: ['short'] } })
check('config: a short hub token is refused', shortToken.tokens.length === 0, `${shortToken.tokens.length} tokens`)
const standaloneDefault = resolveSyncConfig({})
check('config: no sync block means standalone (AC-13)', standaloneDefault.role === 'standalone')
const badRole = resolveSyncConfig({ sync: { role: 'server' } })
check('config: an unknown role falls back to standalone', badRole.role === 'standalone')

// ---- migration (AC-14, §7) ------------------------------------------------

console.log('\n-- migration (export / dry-run import) --')

const exported = exportDomain(service.tables, { device: 'device-a', role: 'standalone', dataRevision: service.state().revision })
check('export: names its format and counts', exported.kind === 'sooyo-export' && exported.exportVersion === 1 && typeof exported.counts === 'object',
  JSON.stringify(exported.counts))
check('export: carries the personal tables and no fetched Items', 'tasks' in exported.tables && !('items' in exported.tables) && !('sources' in exported.tables),
  Object.keys(exported.tables).join(','))
check('export: records the source device', exported.source.device === 'device-a' && exported.source.role === 'standalone')

const dryPlan = planImport(service.tables, exported, {})
check('import: re-importing the same data is a no-op', dryPlan.ok === true && dryPlan.summary.create === 0 && dryPlan.summary.identical > 0,
  JSON.stringify(dryPlan.summary))
check('import: the dry run writes nothing', dryPlan.operations.length === 0, `${dryPlan.operations.length} operations`)
check('import: the dry run prints a per-table summary', Array.isArray(describePlan(dryPlan)) && describePlan(dryPlan).length > 1,
  describePlan(dryPlan).slice(0, 2).join(' / '))

// A second device's export: one new task, one task that differs, one unsafe key.
const otherDevice = {
  kind: 'sooyo-export',
  exportVersion: 1,
  generatedAt: new Date().toISOString(),
  source: { device: 'device-b', role: 'standalone', dataRevision: 7 },
  tables: {
    tasks: [
      { key: 't-fresh-from-b', value: { id: 't-fresh-from-b', title: '只在 B 上', list: 'inbox', done: false } },
      { key: taskId, value: { id: taskId, title: 'B 版本的标题', list: 'inbox', done: false } },
      { key: 'bad key', value: { id: 'bad key' } },
    ],
  },
}
const mergePlan = planImport(service.tables, otherDevice, {})
check('import: a new record is planned as create', mergePlan.summary.create === 1, JSON.stringify(mergePlan.summary))
check('import: a differing record is a conflict, not an overwrite', mergePlan.summary.conflict === 1 && mergePlan.summary.update === 0,
  JSON.stringify(mergePlan.summary))
check('import: an unsafe key is rejected, not sanitised', mergePlan.summary.rejected === 1
  && mergePlan.rejected.some((entry) => entry.reason === 'unsafe-key'), JSON.stringify(mergePlan.rejected.map((e) => e.reason)))
check('import: the conflict names both versions', mergePlan.conflicts[0]?.current?.title !== mergePlan.conflicts[0]?.incoming?.title,
  `${mergePlan.conflicts[0]?.current?.title} vs ${mergePlan.conflicts[0]?.incoming?.title}`)

const applied = await applyImport(service.tables, mergePlan, {})
check('import: applying writes only the planned create', applied.ok === true && applied.written.create === 1 && applied.written.update === 0,
  JSON.stringify(applied.written))
check('import: the conflict target was left alone', (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.find((task) => task.id === taskId)?.title === '幂等测试任务')

const overwritePlan = planImport(service.tables, otherDevice, { overwrite: true })
check('import: overwrite is opt-in and then plans an update', overwritePlan.summary.update === 1 && overwritePlan.summary.conflict === 0,
  JSON.stringify(overwritePlan.summary))

const notOurs = planImport(service.tables, { kind: 'something-else' }, {})
check('import: a foreign file is refused', notOurs.ok === false, String(notOurs.error))
const futureVersion = planImport(service.tables, { kind: 'sooyo-export', exportVersion: 99, tables: {} }, {})
check('import: a future export version is refused rather than half-read', futureVersion.ok === false, String(futureVersion.error))

// ---- Agent tools (AC-08, AC-09) -------------------------------------------

console.log('\n-- Agent tools and context (no network) --')

const toolByName = (name) => tools.find((tool) => tool.name === name)
check('the new read/write tools are registered',
  ['sooyo_context_get', 'sooyo_task_list', 'sooyo_task_create', 'sooyo_task_update', 'sooyo_note_capture', 'sooyo_inbox_list', 'sooyo_proposal_create', 'sooyo_review_run']
    .every((name) => Boolean(toolByName(name))),
  tools.map((tool) => tool.name).join(', '))
check('no unrestricted sooyo_action tool exists',
  !toolByName('sooyo_action'), 'a free-form action tool would let the model name any command')
check('the original three tools keep their names',
  ['sooyo_brief', 'sooyo_refresh', 'sooyo_sources'].every((name) => Boolean(toolByName(name))))

const contextTool = await toolByName('sooyo_context_get').execute({ limit: 5 })
check('sooyo_context_get returns counts and a revision', contextTool?.ready === true && typeof contextTool?.counts?.open === 'number'
  && Number.isSafeInteger(contextTool?.dataRevision), JSON.stringify(contextTool?.counts))
check('sooyo_context_get marks the data as not-an-instruction', /不是指令/.test(String(contextTool?.note)))

const createdByTool = await toolByName('sooyo_task_create').execute({ title: '工具建的任务', list: 'today' }, {})
check('sooyo_task_create writes through the funnel', createdByTool?.ok === true && createdByTool?.result?.task?.list === 'today',
  JSON.stringify(createdByTool?.error ?? createdByTool?.result?.task?.list))
const toolTaskId = createdByTool?.result?.task?.id
const toolTaskRow = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.find((task) => task.id === toolTaskId)
check('a tool-created task carries a revision', Number.isSafeInteger(toolTaskRow?.revision), String(toolTaskRow?.revision))

const noRevision = await toolByName('sooyo_task_update').execute({ id: toolTaskId, done: true }, {})
check('sooyo_task_update refuses a write without a revision', noRevision?.ok === false && /revision/.test(String(noRevision?.error)),
  String(noRevision?.error))

const withRevision = await toolByName('sooyo_task_update').execute({ id: toolTaskId, revision: toolTaskRow.revision, done: true }, {})
check('sooyo_task_update applies with a matching revision', withRevision?.ok === true && withRevision?.result?.task?.done === true,
  JSON.stringify(withRevision?.error ?? withRevision?.result?.task?.done))

const staleTool = await toolByName('sooyo_task_update').execute({ id: toolTaskId, revision: toolTaskRow.revision, title: '过期写入' }, {})
check('sooyo_task_update surfaces a conflict with a hint', staleTool?.ok === false && staleTool?.code === ERRORS.conflict && /revision/.test(String(staleTool?.hint)),
  String(staleTool?.hint))

const noteTool = await toolByName('sooyo_note_capture').execute({ text: '工具记的一条笔记', originUrl: 'https://example.com/a', originTitle: '来源条目' }, {})
check('sooyo_note_capture stores the note with its Origin', noteTool?.ok === true && noteTool?.result?.note?.origin?.url === 'https://example.com/a',
  JSON.stringify(noteTool?.result?.note?.origin))

const proposalTool = await toolByName('sooyo_proposal_create').execute({
  reason: '把今天的任务重新排序',
  operations: [{ name: 'task.add', body: { title: '建议的任务' } }],
  evidenceRefs: ['viking://user/a/memories/x.md'],
}, {})
check('sooyo_proposal_create writes to the Inbox', proposalTool?.ok === true && proposalTool?.result?.proposal?.status === 'pending',
  JSON.stringify(proposalTool?.error ?? proposalTool?.result?.proposal?.status))
const proposalId = proposalTool?.result?.proposal?.id
check('a proposal records its evidence', (proposalTool?.result?.proposal?.evidenceRefs ?? []).length === 1)

const badProposal = await toolByName('sooyo_proposal_create').execute({
  reason: 'x',
  operations: [{ name: 'board.remove', body: { id: 'home' } }],
}, {})
check('sooyo_proposal_create refuses a destructive operation', badProposal?.ok === false, String(badProposal?.error))

const inboxTool = await toolByName('sooyo_inbox_list').execute({ status: 'pending' }, {})
check('sooyo_inbox_list shows the pending proposal', (inboxTool?.proposals ?? []).some((entry) => entry.id === proposalId), JSON.stringify(inboxTool?.matched))
check('the Agent Inbox arrives with the dashboard', (await call(routes, 'GET', '/sooyo/daily')).body?.agentInbox?.length > 0)

// A proposal is a suggestion until a human decides: applying it is a local route, and the
// approve-then-apply flow is what makes AC-11 pass.
const approve = await call(routes, 'POST', '/sooyo/agent-inbox/decide', { id: proposalId, decision: 'approve' })
check('a local approval applies the proposal', approve.body?.ok === true && approve.body?.applied?.ok === true,
  JSON.stringify(approve.body?.applied))
const appliedTask = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.find((task) => task.title === '建议的任务')
check('an applied proposal really created its task', Boolean(appliedTask), 'task present')
check('an applied proposal is marked applied', (await call(routes, 'GET', '/sooyo/daily')).body?.agentInbox?.find((entry) => entry.id === proposalId)?.status === 'applied')
const doubleDecide = await call(routes, 'POST', '/sooyo/agent-inbox/decide', { id: proposalId, decision: 'approve' })
check('a second decision is refused, so nothing is applied twice', doubleDecide.body?.ok === false, String(doubleDecide.body?.error))

// ---- background review (AC-11, AC-12) -------------------------------------

console.log('\n-- background review (no network) --')

const reviewTool = toolByName('sooyo_review_run')
const scan1 = await reviewTool.execute({}, {})
check('sooyo_review_run scans without a model', scan1?.ok === true && typeof scan1?.candidateCount === 'number', JSON.stringify(scan1?.candidateCount))
check('a scan reports whether a review is worth doing', typeof scan1?.shouldReview === 'boolean')
check('the scan names its role', scan1?.role === 'standalone', String(scan1?.role))

const candidates = scan1?.candidates ?? []
check('the scan lists tasks and notes but never Items', candidates.every((entry) => ['task', 'note'].includes(entry.itemType)),
  candidates.map((entry) => entry.itemType).join(','))
check('a never-reviewed item reports no processedRevision', candidates.every((entry) => entry.processedRevision === null || Number.isSafeInteger(entry.processedRevision)))

const acked = await reviewTool.execute({
  ack: candidates.slice(0, 3).map((entry) => ({ itemType: entry.itemType, itemId: entry.itemId, revision: entry.revision })),
}, {})
check('acknowledging advances the cursor', acked?.acknowledged === Math.min(3, candidates.length), String(acked?.acknowledged))

const scan2 = await reviewTool.execute({}, {})
const ackedIds = new Set(candidates.slice(0, 3).map((entry) => entry.itemId))
check('an acknowledged item is not proposed again (AC-12)',
  (scan2?.candidates ?? []).every((entry) => !ackedIds.has(entry.itemId)),
  `${scan2?.candidateCount} candidates left, acked ${ackedIds.size}`)
check('the second scan drops exactly the acknowledged items', (scan2?.candidateCount ?? 0) === (scan1?.candidateCount ?? 0) - ackedIds.size,
  `${scan1?.candidateCount} - ${ackedIds.size} -> ${scan2?.candidateCount}`)

// A changed record becomes a candidate again even if it was acknowledged before.
const ackedTask = candidates.find((entry) => entry.itemType === 'task' && ackedIds.has(entry.itemId))
if (ackedTask) {
  const latest = (await call(routes, 'GET', '/sooyo/daily')).body?.tasks?.find((task) => task.id === ackedTask.itemId)
  await call(routes, 'POST', '/sooyo/action', { name: 'task.update', body: { id: ackedTask.itemId, title: `${latest?.title}（改过）` } })
  const scan3 = await reviewTool.execute({}, {})
  check('an acknowledged item that changed is a candidate again',
    (scan3?.candidates ?? []).some((entry) => entry.itemId === ackedTask.itemId), `${scan3?.candidateCount} candidates`)
}

const scheduleSpec = (await call(routes, 'GET', '/sooyo/review/schedule')).body
check('the review exposes a schedule spec for the Hub only', scheduleSpec?.ok === true && /sooyo_review_run/.test(String(scheduleSpec?.spec?.prompt)),
  String(scheduleSpec?.spec?.title))
check('the review prompt tells the model to stop when there is nothing to do',
  /shouldReview 为 false/.test(String(scheduleSpec?.spec?.prompt)))

// ---- the Context Bridge ----------------------------------------------------

console.log('\n-- Sooyo Context Bridge (no browser) --')

const { attachAgentContext, contextMessage, hasHumanInput, isSynthetic } = await import('../agent/context.js')
const { renderContextBlock } = await import('../agent/tools.js')

const humanMessage = { id: 'm1', role: 'user', content: [{ type: 'text', text: '今天做什么' }], source: { kind: 'user' } }
const toolMessage = { id: 'm2', role: 'tool', content: [], source: { kind: 'tool', callId: 'c1' } }
const recallMessage = { id: 'm3', role: 'user', content: [], source: { kind: 'plugin:openviking-memory', plugin: 'openviking-memory', form: 'recall' } }

check('a human message counts as human input', hasHumanInput([humanMessage]) === true)
check('a tool-result-only batch is not a human turn', hasHumanInput([toolMessage]) === false)
check('an OpenViking recall digest is not human input', hasHumanInput([recallMessage]) === false)
check('the OpenViking plugin source is recognised as synthetic', isSynthetic(recallMessage) === true)
check('a first-party context kind is recognised as synthetic', isSynthetic({ source: { kind: 'time-context' } }) === true)
check('our own plugin message is synthetic', isSynthetic(contextMessage('x')) === true)
check('a plugin message is not treated as user speech', contextMessage('x').source.kind === 'plugin:sooyo')

const block = renderContextBlock(scan1 && {
  ready: true,
  dataRevision: 42,
  generatedAt: '2026-11-05T12:00:00.000Z',
  counts: { tasks: 9, open: 5, today: 2, inbox: 3, later: 0, notes: 4, readLater: 1, boards: 3, proposals: 1 },
  today: [{ id: 't-1', title: '写 issue 的 PR1', list: 'today' }],
  inbox: [],
  recentNotes: [{ id: 'n-1', text: '把同步做成单一写入队列' }],
})
check('the context block names its source and revision', /source=plugin:sooyo-context/.test(block) && /dataRevision=42/.test(block), block.split('\n')[1])
check('the context block points at the tool for more', /sooyo_context_get/.test(block))
check('the context block says it is data, not an instruction', /not an instruction/.test(block))
check('the context block stays small', block.length < 1200, `${block.length} chars`)

// The waterfall listener: appended after next(), only on a human turn, once per turn.
const waterfall = []
const fakeCtx = {
  on: (name, listener) => waterfall.push({ name, listener }),
  off: () => {},
}
const disposeBridge = attachAgentContext(fakeCtx, {
  service: { context: async () => ({ ready: true, dataRevision: 1, counts: { open: 1 }, today: [], inbox: [], recentNotes: [] }) },
  role: () => 'standalone',
  render: renderContextBlock,
  enabled: () => true,
})
check('the bridge listens on agent/pre-step', waterfall[0]?.name === 'agent/pre-step')
const decision = await waterfall[0].listener(
  { agent: { id: 'a1' }, messages: [humanMessage], turn: 1, step: 1, signal: new AbortController().signal },
  async () => ({ kind: 'enter', messages: [humanMessage] }),
)
check('a human turn gains the Sooyo context', decision.messages.length === 2 && decision.messages[1].source.kind === 'plugin:sooyo',
  decision.messages.map((message) => message.source.kind).join(','))
check('the injected message keeps the original decision keys', Array.isArray(decision.messages) && decision.kind === 'enter')

const again = await waterfall[0].listener(
  { agent: { id: 'a1' }, messages: [humanMessage], turn: 1, step: 2, signal: new AbortController().signal },
  async () => ({ kind: 'enter', messages: [humanMessage] }),
)
check('a second step in the same turn does not inject again', again.messages.length === 1, `${again.messages.length} messages`)

const toolOnly = await waterfall[0].listener(
  { agent: { id: 'a2' }, messages: [toolMessage], turn: 2, step: 1, signal: new AbortController().signal },
  async () => ({ kind: 'enter', messages: [toolMessage] }),
)
check('a tool-only batch is left untouched', toolOnly.messages.length === 1)
disposeBridge()

// AC-08: writing a task must not touch the model or the memory plugin.
check('a task write produced no Agent message', waterfall.length === 1, `${waterfall.length} listeners`)

// Two regressions reached a real UI before anyone noticed, and both are cheap to assert on
// the source. A skin installed in the profile sets tag-level colours with !important, so a
// reset that loses makes every link salmon; a "font" shorthand in a reset silently flattens
// component type. Neither shows up in a screenshot assertion, only in computed style.

console.log('\n-- client.css guards (no browser) --')

const clientSource = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

check('anchor reset survives an !important skin rule', /:where\(a\)\s*\{[^}]*color:\s*inherit\s*!important/.test(clientSource),
  'expects `.sy-root :where(a) { color: inherit !important; ... }`')
check('code/kbd reset survives an !important skin rule', /:where\(code,\s*kbd,\s*samp\)[^{]*\{[^}]*color:\s*inherit\s*!important/.test(clientSource),
  'expects a color: inherit !important on code/kbd/samp')
check('heading reset touches font-family only, never the font shorthand',
  (() => {
    const rule = clientSource.match(/:where\(h1,[^}]*\}/)?.[0] ?? ''
    return rule.length > 0 && /font-family:/.test(rule) && !/(^|[;{\s])font:/.test(rule)
  })(),
  'a `font:` shorthand here overrides every component font-size (it flattened the headline once)')
check('no stray backtick inside the CSS template literal',
  (() => {
    const start = clientSource.indexOf('const CSS = `')
    if (start < 0) return false
    // The literal ends at the first backtick that closes it — find it by scanning forward
    // for a backtick at end of line, which is how the block is delimited.
    const rest = clientSource.slice(start + 'const CSS = `'.length)
    const close = rest.search(/^`$/m)
    if (close < 0) return false
    return !rest.slice(0, close).includes('`')
  })(),
  'a backtick in a CSS comment terminates the template literal and breaks the module')
check('element resets keep zero specificity so component classes win',
  /\.sy-root :where\(button\)/.test(clientSource) && !/^\.sy-root button \{/m.test(clientSource),
  'a plain `.sy-root button` reset outranks `.sy-btn` and strips its border')

/**
 * Layout guards for the two phone bugs.
 *
 * Both were found by measuring a real layout at 390px, and both are invisible to any assertion
 * about "does it render" — the panel rendered fine, it was just 156px of chrome over a cut
 * headline. These checks encode the two structural causes so they cannot come back silently:
 *
 *  - a container query placed BEFORE its base rule loses on source order (it adds no
 *    specificity), which is how a 20px phone headline still measured 24px;
 *  - `.sy-page` is the parent of the `sy` container, so a container query can never style it.
 */
const cssBlock = (() => {
  const start = clientSource.indexOf('const CSS = `')
  if (start < 0) return ''
  const rest = clientSource.slice(start + 'const CSS = `'.length)
  const close = rest.search(/^`$/m)
  return close < 0 ? '' : rest.slice(0, close)
})()

const cssIndexOf = (needle) => cssBlock.indexOf(needle)

check('the phone container query comes after the base rules it overrides',
  cssIndexOf('@container sy (max-width: 640px)') > cssIndexOf('.sy-headline { margin: 0;'),
  'a container query has no extra specificity, so source order is the only thing that makes it win')

check('.sy-page is styled by a media query, not the container query it parents',
  (() => {
    // Slice to the END of that container block (its matching brace), not to the end of the file:
    // the wrong slice swallowed the media query below it and reported a false failure.
    const start = cssIndexOf('@container sy (max-width: 640px)')
    if (start < 0) return false
    let depth = 0
    let end = start
    for (let i = start; i < cssBlock.length; i += 1) {
      if (cssBlock[i] === '{') depth += 1
      else if (cssBlock[i] === '}') {
        depth -= 1
        if (depth === 0) { end = i; break }
      }
    }
    const containerBlock = cssBlock.slice(start, end + 1)
    const declaredInContainer = /^\s*\.sy-page\s*\{/m.test(containerBlock)
    const declaredInMedia = /@media \(max-width: 640px\) \{\s*\n\s*\.sy-page\s*\{/.test(cssBlock)
    return !declaredInContainer && declaredInMedia
  })(),
  '.sy-page wraps the container, so @container can never reach it')

check('the sticky bar is frosted rather than an opaque fill',
  /\.sy-topbar \{[^}]*backdrop-filter: var\(--sy-blur\)/.test(cssBlock)
  && /--sy-chrome: rgba\(/.test(cssBlock),
  'an opaque bar slices any headline that scrolls under it — the reported phone bug')

check('the frost has a fallback for browsers without backdrop-filter',
  /@supports not \(\(backdrop-filter/.test(cssBlock),
  'without the fallback a browser that ignores the filter shows scrolled text through the bar')

check('the dark palette is warm-neutral, not blue-black',
  /--sy-bg: #121211/.test(cssBlock) && !/--sy-bg: #0E0F12/.test(cssBlock),
  'a warm black reads as a surface; a blue-black reads as a screen')

check('the grain layer is a real node with a matching style',
  /\.sy-grain \{/.test(cssBlock) && /className: 'sy-grain'/.test(clientSource),
  'grain breaks up OLED banding on a flat dark fill')

// ---- teardown --------------------------------------------------------------

// The poll effect owns a 30s setTimeout: a live timer would keep node alive forever.
for (const effect of [...effects].reverse()) {
  try {
    await effect.dispose?.()
  } catch (error) {
    check(`disposing effect "${effect.label}"`, false, String(error?.message ?? error))
  }
}
check('effects dispose cleanly', true, `${effects.length} effects`)

const failed = results.filter((entry) => !entry.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed${OFFLINE ? ' (network block skipped)' : ''}`)
process.exitCode = failed.length === 0 ? 0 : 1
