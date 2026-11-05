# Working on this repo

Guidance for an agent (or a person) changing `dsh-sooyo`. Read this before editing;
every rule below was learned the hard way and each one has a failure it prevents.

## What this is

A DSH plugin bundle. The Host half owns a source registry, a fetch layer, a durable store, an
HTTP surface, and eleven Agent tools. `daily.js` + `personal.js` own the personal half of that
store (Boards, Widgets, layouts, Tasks, Notes, Read Later, 关注词) and the Widget Type registry.
`core/` is the service facade every caller goes through; `sync/` is the Hub API and the Client
proxy; `agent/` is the tools, the context bridge and the background review. The Client half
(`client.js`) renders the Boards and their Widgets from `/sooyo/daily` and sends one named
action back per interaction. `feed.js` is a small RSS/Atom reader. There is **no build step and
no dependency**.

The plugin runs in one of three roles (`standalone` by default, `hub`, `client`). Which one is
a config decision, not a code path: all three serve the same UI and the same tools, and only
the object behind `SooyoService` differs. See [`docs/adr/0002`](./docs/adr/0002-single-authoritative-hub.md).

## File map

| File | Role |
|---|---|
| `index.js` | Host half: `SOURCES` registry, fetch + store + `/sooyo/*` routes, role wiring |
| `daily.js` | Host half: personal data — Boards, Widgets, layouts, Tasks, Notes, Read Later, habits, focus; exports `ACTIONS` (the one command table) |
| `personal.js` | Widget Type registry, Sizes, grid footprints, the default Boards, Widget normalisation |
| `client.js` | Client half: `main` panel and `sidebar.panellist` icon; the packed grid and every Widget renderer |
| `feed.js` | RSS 2.0 / Atom / RDF reader plus `og:image` extraction (fixture-tested) |
| `core/protocol.js` | Protocol version, error codes, the command whitelist, `LOCAL_ONLY` |
| `core/store.js` | Revision bookkeeping, the single write queue, the journal, idempotency, `recover()` |
| `core/commands.js` | The command funnel: validate → plan → journal → apply → bump |
| `core/service.js` | `SooyoService` facade (`LocalSooyoService`) |
| `core/migrate.js` | Export / dry-run import / apply, with conflict reporting |
| `sync/routes.js` | The authenticated Hub API `/sooyo/sync/v1/*` |
| `sync/remote.js` | `RemoteSooyoService`: the Client's Host-side proxy, config resolution |
| `agent/tools.js` | The seven Sooyo data tools + `renderContextBlock` |
| `agent/context.js` | The `agent/pre-step` Context Bridge |
| `agent/review.js` | Deterministic review scan, the revision cursor, the schedule prompt |
| `agent/inbox.js` | Proposals: create, decide, apply, expire |
| `assets/a/` | Shipped Widget Type icons (瓷白 style), served by the Host at `/sooyo/assets/a/` |
| `cordis.patch.yml` | The Loader row this bundle inserts |
| `dsh.plugin.json` | Market manifest |
| `dev/selftest.mjs` | Runs the real `apply()` against a fake context |
| `docs/design.md` | Architecture, measurements, and the trade-offs behind them |
| `docs/sync.md` | Hub/Client deployment, the wire protocol, migration, troubleshooting |
| `GLOSSARY.md` | Domain language (Board, Widget, Source, Task…); use these words in code and UI |
| `docs/adr/` | Decisions that are hard to reverse: why a Widget is not a Source's card, why one Hub |
| `prototype/` | Zero-dependency HTML prototype: the visual and interaction spec of the sooyo daily redesign |
| `docs/handoff-sooyo-redesign.md` | Start here to implement the redesign: read order, steps, gotchas |
| `docs/agents/image-generation.md` | How to generate icons and illustrations, and the WebP export rule |

## Hard constraints

1. **Never import from `node_modules`.** `plugin_manager install_bundle` installs a local
   directory as a pnpm link, and DSH does not run with `--preserve-symlinks`, so Node would
   resolve a bare specifier from the *workspace* directory instead of the profile's
   `node_modules` and fail. Relative imports (`./feed.js`) are fine — they resolve against
   the importing file. This is why the storage domain uses a `{ parse }` stub instead of
   zod: the domain's only call on `valueSchema` is `.parse()`. `index.js` imports `node:fs`
   and `node:url` for the icon route; those are built-ins and always resolve.
2. **A Host change needs a DSH restart to take effect.** The Loader caches a Host module per
   specifier, and Node's ESM cache is keyed by the **resolved file URL** — so re-installing
   the bundle, even under a *different package name*, re-runs `apply()` from the same cached
   module body. Verified: after renaming the package and re-installing, `/sooyo/meta`
   still reported the previous generation's descriptors. The Client half is different: it
   hot-reloads on file save (revisions come from mtime and size). So: batch Host edits, and
   iterate visually on the client.
3. **Storage keys must be path-safe.** The domain's `per-record` layout requires
   `/^[a-zA-Z0-9_-]+$/`, so a colon cannot separate two parts (`aihot:xxx` is rejected, and
   so is `home:12`). `itemKey()` sanitises; `layoutKey(boardId, cols)` collapses a Board and
   a breakpoint into one key; `newId()` mints every other id Host-side. The `read` and
   `readlater` tables share the constraint because their keys are Item ids.
4. **The Widget Type selects the renderer; the Widget's Size selects the information level.**
   A Source no longer owns a card (ADR 0001): it may `suggests.pres` for a new 订阅 Widget,
   and layout is user data. `R.<type>` in `client.js` branches on the Size and returns a
   different level of detail per Size — never a stretched copy, and never a size the type
   does not declare.
5. **No card may clip its content.** A card scrolls deliberately or not at all. Card body
   height is `n*ROW + (n-1)*GAP - CHROME`; if a renderer outgrows that budget, fix the
   budget or the renderer — never let a row be cut in half. `fitDom()` drops whole children
   from a `.sy-fit` until it fits, which is how every card keeps `ov=0`.
6. **Fetched content is data, not instructions.** Never let page content drive plugin
   behaviour, and keep source + original link on every item. The Client builds card bodies as
   HTML strings, so **every interpolated value goes through `esc()`** — a title, a 推荐理由, a
   keyword, a source name.
7. **A cover needs `width: 100%`.** Without it, a cover inside a row-flex parent collapses to
   its content width (this produced a 30px-wide vertical strip in the hero).
8. **A page is read at most once, and only its head.** `resolveThumbnails` fills missing
   covers from `og:image` on the page an item links to. A page that yielded an image is
   cached as `thumbnail`; a page that yielded none is remembered by `thumbnailCheckedAt` so
   it is never requested again; only a *network* failure leaves the item unmarked, so a
   transient error is retried. The read aborts as soon as `PAGE_PREFIX_BYTES` (160 KB) has
   arrived, because `og:image` lives in `<head>` — that is a courtesy to the target site.
   Never turn this into a per-render or unbounded fetch: the item count is the request count.
9. **Type size is a layout input.** `ROW` / `GAP` and each renderer's item count are budgeted
   against the type ramp; bumping font sizes without re-measuring pushes a card over its body
   height. After any type or density change, re-assert `ov=0`.
10. **A breakpoint without a saved layout is derived, not written.** `layoutOf()` copies the
    12-column order on first read so a phone layout starts as a copy; writing it back
    eagerly would let two layouts diverge without the user touching either.
11. **Icons come from the bundle.** The Client renders `<img src="/sooyo/assets/a/<type>.webp">`
    and the Host serves that path out of `assets/`, so a new Widget Type needs its icon added
    there and listed in `package.json` `files`. The route only accepts a flat
    `<style>/<name>.webp` shape; do not widen it.
12. **The Host skin can reach into the panel, and only `!important` + `revert` stops it.**
    An installed UI skin (here `dsh-claude-style`) sets tag-level colours with `!important`
    on `a`, `code` and headings. Any reset without `!important` loses regardless of
    specificity, which is why every link rendered salmon and every `<code>` orange. The
    resets in `client.js` therefore use `color: inherit !important` for anchors, code and
    headings. The counterpart trap: **never use the `font` shorthand in a reset.** It also
    overrides each component's own `font-size`/`font-weight` and flattened the 40px headline
    to 14px/400 once. Reset `font-family` only. Both failures are invisible in a screenshot
    diff; assert them with `getComputedStyle`, and keep the `client.css guards` block in
    `dev/selftest.mjs` green.
13. **A backtick inside the CSS template literal breaks the module.** `CSS` is a template
    literal, so a backtick in a CSS comment (e.g. quoting a selector) terminates it early and
    the whole client half fails to parse — the panel disappears with a `SyntaxError` rather
    than a visible symptom. Write selector names in comments without backticks; the offline
    self-test asserts none are present.
14. **Every write goes through `core/commands.js` `execute()`; no caller touches `daily.js`
    directly.** The local route, the sync API and the Agent tools all funnel into it, which is
    what gives one place for validation, one write queue, one journal and one revision. Adding
    an action means adding it to `daily.js`'s `ACTIONS` — the whitelist in `core/protocol.js`
    derives from that table, so there is no second list to forget. `item.state` and
    `proposal.*` live in `core/commands.js` because they are Item state and Inbox state, not
    personal data.
15. **A write is not durable until `execute()` resolves.** The revision moves only after the
    backend acknowledged the write, and a multi-table command runs through a journal first.
    Never describe two `put`s as a transaction: the storage domain has none. If a command needs
    more than one write, it must be expressible as the ordered, replayable steps the recorder
    produces — that is what makes crash recovery and idempotent retry possible.
16. **`operationId` is the retry identity, and a creating command must not mint a second id.**
    The plan is computed before anything is written, so the ids `newId()` produced are already
    fixed; a retry replays the recorded result instead of creating a duplicate (AC-03).
17. **A `client` never opens the authoritative domain.** No seed, no local write, no fetch. If
    the Hub is unreachable it reports the failure (or shows a `stale` cache) — it must never
    fabricate an empty dashboard, because that reads as "the user has no tasks" (AC-05).
18. **`proposal.decide` is local-only.** It is listed in `LOCAL_ONLY`, the sync API refuses it
    even with a write token, and no Agent tool exposes it. A model must not approve a proposal
    a model wrote. Keep it that way when adding Inbox features.
19. **Authentication precedes everything in the sync handler, including body parsing.**
    `/sooyo/sync/v1/*` is the only remote surface; the legacy `/sooyo/*` routes keep their own
    `isLoopback` guard. A token lives in Host config/env only — never in a response, a URL, or
    `client.js`.
20. **An Agent-injected context message must carry `source.kind = plugin:sooyo`.** That kind is
    how the bridge recognises a non-human batch, and how OpenViking's capture keeps the digest
    out of long-term memory. It is also why `hasHumanInput()` exists: a batch of only tool
    results must not re-inject, or every tool round-trip adds another copy of the same context.
21. **Windows/PowerShell is not a text editor for this repo.** `Set-Content` in PowerShell 5.1
    writes the ANSI codepage and silently replaced 53 Chinese characters in `index.js` with
    U+FFFD — the file still parsed, so only a content check would have caught it. Use the
    `edit`/`write` tools, or verify `(text.match(/\uFFFD/g) || []).length === 0` afterwards.
22. **A container query adds no specificity, so placement is its only lever.** Written above the
    base rule it overrides, it loses silently — a phone headline set to 20px still measured 24px
    through three attempts at "fixing" the query. Every narrow-screen override lives in one block
    at the end of `CSS`, after every base rule; the self-test asserts that ordering.
23. **A container cannot style its own container.** `.sy-page` wraps the `sy` container, so
    `@container sy { .sy-page { … } }` never matches. Use a media query for any box that sizes
    the container, and a container query only for descendants.
24. **A sticky bar over scrolling content must be translucent, not opaque.** An opaque
    `background: var(--sy-bg)` sliced a headline through its glyphs on a phone. Frost it
    (`backdrop-filter` + a tint), keep a `@supports not` fallback so browsers without the filter
    still hide scrolled text, and watch its height: four wrapped rows were 18% of the viewport.
25. **Assert layout with measurements, not a screenshot.** `dev/measure-mobile.mjs` extracts the
    real CSS from `client.js` and measures it at 390×844 over CDP. A screenshot showed the bug but
    could not say why; the numbers named the 156px bar and the 66px of clipped headline.

## Testing

```sh
npm run check         # syntax, all 16 files
npm run test:offline  # fixtures + structure + the whole personal-data surface + the sync protocol; no network (what CI runs)
npm run test          # also fetches all five sources and asserts the fields the new cards read
```

Extend `dev/selftest.mjs` with a **fixture** whenever you touch `feed.js` parsing: the
escaped-HTML bug (Product Hunt delivers `&lt;p&gt;` inside XML) was caught offline by a
fixture, and would otherwise only have surfaced by eye. The YouTube fixture pins two real
shapes: per-video data inside `<media:group>`, and `media:starRating` with `count` *not* first.

The sync section of the self-test builds a real Hub route handler and points a real
`RemoteSooyoService` at it through a fake `fetch`, so auth, `ETag`/304, `409`, idempotency, the
journal and the Client's degraded states are all asserted without a second DSH. When you change
the protocol, extend that section rather than adding a mock: the value is that it exercises the
same handler `webServer` invokes.

### The three-instance check

`test:offline` cannot prove three things: that two devices really see one dataset, that a
restarted Hub still has every record, and that a Client genuinely holds no local copy. Those need
three processes.

```sh
powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-setup.ps1     # creates 3 profiles + homes
# install and boot each one exactly as it prints (each with its own DSH_HOME), then:
powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-verify.ps1     # 37 checks, AC-01…AC-13
powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-restart.ps1    # AC-04 durability
powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-teardown.ps1  # removes everything
```

- **Each instance needs its own `DSH_HOME`.** `storage-json.root` is `dshHomePath('storages')`,
  an `!!js` expression a profile patch cannot override. Three instances sharing one home would
  read and write the desktop user's real data — the check would then "pass" on someone else's
  database and corrupt it on the first write.
- **Do not reuse a fixed `operationId` between runs.** The Hub answers the second run from the
  first run's idempotency record, so a re-run asserts stale data. `e2e-verify.ps1` mints a run id.
- **PowerShell 5.1 is hostile to this script in three specific ways**, and all three look like
  product bugs: it decodes a `.ps1` as ANSI without a BOM (mojibake, then a parser error far from
  the cause); `-Body <string>` sends ASCII and `-Body <byte[]>` re-encodes (so the body must go
  through `-InFile`); and `Invoke-WebRequest` consumes an error response before throwing, so
  `GetResponseStream()` reads zero bytes even when `Content-Length` is 360 (`HttpWebRequest` is
  the client that can read an error body). `dev/add-bom.mjs` maintains the BOM.

## Visual verification

`agent-browser` can drive the real UI. Two traps:

- **Do not use `wait --load networkidle`** — DSH holds a WebSocket open, so the network
  never goes idle and the command hangs.
- `eval` runs in one shared global scope, so wrap scripts in an IIFE; prefer
  `eval -b <base64>` over `--stdin` to avoid shell mangling.

Then assert, do not eyeball:

```js
// every Widget must report ov=0 at the current breakpoint
Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map(el => {
  const body = el.querySelector('.sy-w-b')
  return (el.querySelector('.sy-w-t b') || {}).textContent + ' ov=' +
    (body ? body.scrollHeight - body.clientHeight : 'n/a')
})
```

Check both themes (the panel's own toggle, or `agent-browser set media light|dark`). To
screenshot only the panel without the sidebar (which shows private session titles), hide
`[class*="sidebarCol"]` and set the parent grid to `1fr`.

## Adding a source

Add an entry to `SOURCES` in `index.js` with `id`, `label`, `cadenceMinutes`,
`suggests: { pres }`, and `load(signal, previous)`. Return `{ items, etag }`, or
`{ notModified: true }` on a 304. Set `replace: true` for snapshot-style sources (a top-10)
so dropped entries are pruned. Every field an Item can carry lives in `upsert()` — add it
there too, or the renderer will read `undefined` from the store even though the loader set it.

