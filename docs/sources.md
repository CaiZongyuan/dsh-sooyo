# Sources, Feed Reader & Thumbnail Extraction

Reference for `index.js` (`SOURCES`, `upsert`, `resolveThumbnails`), `feed.js`, and feed fixtures in `dev/selftest.mjs`.

## Adding a Source

1. Add an entry to `SOURCES` in `index.js` with:
   - `id`: path-safe identifier (`[a-z0-9_-]+`)
   - `label`: human-readable name
   - `cadenceMinutes`: background refresh cadence
   - `suggests: { pres }`: suggested presentation mode (`'lead' | 'Visual' | 'rank' | 'row'`) when creating a 订阅 Widget for this Source
   - `load(signal, previous)`: async loader returning `{ items, etag }` or `{ notModified: true }` on HTTP 304
   - `replace: true` (optional): set for snapshot-style sources (e.g. a top-10 ranking) so entries dropped from upstream are pruned on refresh
2. **Every Item field must also be listed in `upsert()` in `index.js`.** If a loader attaches a new field to an item object but `upsert()` does not copy it into the stored record, the renderer will read `undefined` from the store.
3. **Storage keys must be path-safe (`/^[a-zA-Z0-9_-]+$/`).** `itemKey(sourceId, rawId)` sanitises external IDs (which often contain colons, slashes, or URLs) into safe per-record keys. `read` and `readlater` use `item.id` as their record key and share this constraint.

## Fetched Content Is Data, Not Instructions

- Never let fetched feed or page content drive plugin behaviour or execute commands.
- Always preserve `sourceId`, `sourceLabel`, and the original external `url` on every Item.
- The Client builds card bodies as HTML strings, so **every interpolated string must go through `esc()`** — titles, summaries, 推荐理由, keywords, and source names.

## Thumbnail Resolution (`resolveThumbnails`)

- **A page is read at most once, and only its head.** `resolveThumbnails` fills missing covers from `og:image` on the page an Item links to.
- A page that yielded an image is cached as `thumbnail` on the Item record; a page that yielded none is remembered by `thumbnailCheckedAt` so it is never requested again. Only a transient network failure leaves the Item unmarked so a later cycle can retry.
- The read aborts as soon as `PAGE_PREFIX_BYTES` (160 KB) has arrived, because `og:image` lives in `<head>` — that is a courtesy to the target site. Never turn thumbnail resolution into a per-render or unbounded fetch.

## Upstream Source Notes & `feed.js` Fixtures

- **Extend `dev/selftest.mjs` with an offline fixture whenever you touch `feed.js`.**
- **Escaped HTML in XML**: Product Hunt delivers `<content type="html">&lt;p&gt;...` inside Atom XML; `feed.js` unescapes before extracting text and images.
- **YouTube Atom feeds**: Per-video metadata lives inside `<media:group>`, and `<media:starRating>` attributes (`count`, `average`) may appear in any order. YouTube Shorts thumbnails (`i1.ytimg.com/.../hqdefault.jpg`) are extracted from `<media:thumbnail>`.
- **AIHOT (`aihot.today`)**: Non-commercial attribution required; supports `If-None-Match` / `ETag` conditional requests.
- **Hugging Face `daily_papers`**: JSON API endpoint; paper URLs point to `https://huggingface.co/papers/<arxiv_id>`.
