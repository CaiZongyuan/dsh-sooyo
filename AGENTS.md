# Working on this repo

Guidance for an agent (or a person) changing `dsh-sooyo`. Read this before editing;
every rule below was learned the hard way and each one has a failure it prevents.

## What this is

A DSH plugin bundle. The Host half (`index.js`) owns a source registry, a fetch layer, a
durable store, an HTTP surface, and three Agent tools; `daily.js` + `personal.js` own the
personal half of that store (Boards, Widgets, layouts, Tasks, Notes, Read Later, 关注词) and
the Widget Type registry. The Client half (`client.js`) renders the Boards and their Widgets
from `/sooyo/daily` and sends one named action back per interaction. `feed.js` is a small
RSS/Atom reader. There is **no build step and no dependency**.

## File map

| File | Role |
|---|---|
| `index.js` | Host half: `SOURCES` registry, fetch + store + `/sooyo/*` routes + tools |
| `daily.js` | Host half: personal data — Boards, Widgets, layouts, Tasks, Notes, Read Later, habits, focus |
| `personal.js` | Widget Type registry, Sizes, grid footprints, the default Boards, Widget normalisation |
| `client.js` | Client half: `main` panel and `sidebar.panellist` icon; the packed grid and every Widget renderer |
| `feed.js` | RSS 2.0 / Atom / RDF reader plus `og:image` extraction (fixture-tested) |
| `assets/a/` | Shipped Widget Type icons (瓷白 style), served by the Host at `/sooyo/assets/a/` |
| `cordis.patch.yml` | The Loader row this bundle inserts |
| `dsh.plugin.json` | Market manifest |
| `dev/selftest.mjs` | Runs the real `apply()` against a fake context |
| `docs/design.md` | Architecture, measurements, and the trade-offs behind them |
| `GLOSSARY.md` | Domain language (Board, Widget, Source, Task…); use these words in code and UI |
| `docs/adr/` | Decisions that are hard to reverse, e.g. why a Widget is not a Source's card |
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

## Testing

```sh
npm run check         # syntax
npm run test:offline  # fixtures + structure + the whole personal-data surface; no network (what CI runs)
npm run test          # also fetches all five sources and asserts the fields the new cards read
```

Extend `dev/selftest.mjs` with a **fixture** whenever you touch `feed.js` parsing: the
escaped-HTML bug (Product Hunt delivers `&lt;p&gt;` inside XML) was caught offline by a
fixture, and would otherwise only have surfaced by eye. The YouTube fixture pins two real
shapes: per-video data inside `<media:group>`, and `media:starRating` with `count` *not* first.

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

