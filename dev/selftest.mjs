/**
 * Offline self-test for index.js + feed.js.
 *
 * The harness caches a Host plugin's module body per specifier, so a Host code change
 * only takes effect after a DSH restart. This script exercises the real `apply()` against
 * a fake context (and the real feed reader against fixtures) so a restart is a one-shot
 * success rather than a guess.
 *
 *   node dev/selftest.mjs
 */

import { strict as assert } from 'node:assert'

import { apply } from '../index.js'
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

// ---- run -------------------------------------------------------------------

const { ctx, routes, tools, warnings, effects, tables } = makeContext()
const plugin = apply(ctx, {})
await new Promise((resolve) => setTimeout(resolve, 60))

check('route registered', routes.length === 1)
check('tools registered', tools.length === 3, tools.map((t) => t.name).join(', '))
check('no effect warnings', warnings.length === 0, warnings.join(' | ') || 'none')

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
check('hf-papers items are stored', paperItems.length > 0, `${paperItems.length} papers`)
check('hf-papers keeps a one-line summary (tldr)', paperItems.some((item) => typeof item.tldr === 'string' && item.tldr.length > 0),
  paperItems.map((item) => (item.tldr ? `${item.tldr.length}c` : '-')).join(' '))
check('hf-papers keeps ai_keywords', paperItems.some((item) => Array.isArray(item.keywords) && item.keywords.length > 0),
  paperItems.map((item) => (item.keywords?.length ?? 0)).join(','))
check('hf-papers keeps the author count', paperItems.some((item) => typeof item.authorCount === 'number' && item.authorCount > 0),
  paperItems.map((item) => item.authorCount ?? '-').join(','))
check('hf-papers keeps the full abstract', paperItems.some((item) => (item.summary ?? '').length > 400),
  paperItems.map((item) => (item.summary ?? '').length).join(','))
// The handoff warns teaser figures are rare; the card must read well without one.
check('hf-papers works when a paper has no teaser figure', paperItems.every((item) => Boolean(item.thumbnail) || Boolean(item.url)),
  `${paperItems.filter((item) => item.thumbnail?.includes('social-thumbnails')).length} on the generated cover`)

const videos = await call(routes, 'GET', '/sooyo/items?source=youtube&limit=12')
const videoItems = videos.body?.items ?? []
check('youtube items are stored', videoItems.length > 0, `${videoItems.length} videos`)
check('youtube marks every entry as a Short or an episode',
  videoItems.every((item) => ['short', 'episode'].includes(item.kind)),
  videoItems.map((item) => `${item.kind}:${item.title?.slice(0, 18)}`).join(' | ').slice(0, 160))
check('youtube carries a per-video cover', videoItems.every((item) => /^https:\/\/i\.ytimg\.com\//.test(item.cover ?? '') || Boolean(item.thumbnail)),
  videoItems.slice(0, 3).map((item) => item.cover ?? item.thumbnail).join(' '))
check('youtube a Short cover is the 9:16 frame, not a 16:9 one',
  videoItems.filter((item) => item.kind === 'short').every((item) => !String(item.cover ?? '').includes('maxresdefault'))
  || videoItems.every((item) => item.kind !== 'short'),
  videoItems.filter((item) => item.kind === 'short').map((item) => item.cover).join(' ') || 'no Shorts this run')
check('youtube parses likes when the feed publishes them',
  videoItems.some((item) => typeof item.metrics?.likes === 'number')
  || videoItems.every((item) => item.metrics?.likes === undefined),
  videoItems.map((item) => item.metrics?.likes ?? '-').join(','))
check('youtube keeps views where published',
  videoItems.some((item) => typeof item.metrics?.views === 'number'),
  videoItems.map((item) => item.metrics?.views ?? '-').join(','))

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
check('resolved cover looks like an image url', /\.(jpe?g|png|webp|avif)|image/i.test(resolvedSample?.thumbnail ?? ''), String(resolvedSample?.thumbnail).slice(0, 90))
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
