# Changelog

## Unreleased — the sooyo daily redesign

Implements `docs/handoff-sooyo-redesign.md` and ADR 0001 (a Widget is a placed instance, not
a Source's card). Package `dsh-sooyo`, panel id `sooyo`, routes `/sooyo/*`, storage domain
`sooyo`, tools `sooyo_brief` / `sooyo_refresh` / `sooyo_sources`. Data stored under the old
`workbench` domain is not migrated.

### Host

- **Sources suggest a 呈现, they no longer declare a card.** `SOURCES[].widget` is retired;
  `suggests: { pres }` seeds a new 订阅 Widget's default and nothing else.
- **The new cards get the fields they read.** `hf-papers` keeps `tldr` (`ai_summary`), five
  `ai_keywords`, the teaser figure when `mediaUrls` has an image, `projectPage`,
  `githubStars`, the author count and the full abstract; `youtube` marks each entry as a
  Short or an episode, parses `media:starRating@count` as likes and `media:description`, and
  publishes a per-video cover (9:16 `oardefault.jpg` for Shorts, `maxresdefault.jpg` for
  episodes, with the other as a fallback); `aihot` keeps `category` end to end.
- **Personal data has its own tables.** Boards, Widgets, layouts (one record per Board per
  breakpoint, keyed `boardId-cols`), Tasks, Notes, Read Later, habits, bookmarks, 关注词 and
  the focus timer. A first run seeds four Boards; a second one keeps what the user made.
- **`GET /sooyo/daily` and `POST /sooyo/action`.** Every mutation the panel performs is one
  named action, so an unknown one fails loudly instead of silently doing nothing.
- **Icons are served by the Host** at `/sooyo/assets/<style>/<name>.webp`, restricted to a
  flat path shape so nothing can walk out of `assets/`.
- `feed.js` reads `media:starRating`, `media:description` and the whole `<media:group>`; its
  attribute reader no longer requires the wanted attribute to come first.

### Client

- Rebuilt from the prototype: the top bar (Board segments, command bar, edit switch, 添加
  Widget), the greeting headline, the packed grid with first-fit placement, edit mode (drag
  to reorder, drag a corner to resize, duplicate, remove), the Widget 库 with a live preview,
  and every Widget renderer.
- 订阅 covers five 呈现 (图文 / 榜单 / 论文 / 产品 / 视频), 关注词 matching with `关注优先`
  sorting, and 卡片流: one Item at a time, drag to sort (right = 稍后读, left = skip), a paper
  card that flips, S-size auto-advance, arrow keys.
- Widgets without a data source (日程 / 天气 / 简报 / 嵌入) say so instead of showing
  invented data, and a fresh install carries no example Tasks or weather.

### Tooling

- `npm run check` covers the two new Host modules.
- The offline self-test covers the whole personal-data surface and the icon route, and no
  longer asserts the retired `widget.kind` model.
- New fixtures pin the two YouTube shapes that broke parsing: per-video data inside
  `<media:group>`, and `media:starRating` with `count` not first.
- A `client.css guards` block asserts four source-level invariants that a browser test would
  not catch: the anchor/code resets survive an `!important` skin rule, the heading reset never
  uses the `font` shorthand, no backtick closes the CSS template literal early, and the
  element resets keep zero specificity.

### Fixed

- **Links and inline code no longer inherit the host skin's colour.** An installed UI skin
  sets tag-level colours with `!important`, so the panel's zero-specificity resets lost:
  every link rendered salmon and every `<code>` orange. The resets now use
  `color: inherit !important`, verified against a clone profile that loads the same skin.
- **The greeting headline is 38px again.** A `font: inherit !important` heading reset was
  also resetting every component's size and weight; it now resets `font-family` only, so the
  skin's serif face is still rejected without flattening the type ramp.
- A backtick inside a CSS comment terminated the `CSS` template literal and broke the whole
  client half with a `SyntaxError`; removed, and now asserted.

## 0.1.0

First public version.

- Host half: a source registry (`SOURCES`) as the single extension point; a fetch layer with
  per-source cadence, ETag/304 conditional requests, a global concurrency cap, and
  proportional retry (1/2/4… minutes) so one failing source cannot affect the others.
- Durable store on the DSH storage domain (`items` / `sources` / `read`).
- Loopback-only HTTP surface (`/workbench/ping|meta|items|refresh|state`).
- Agent tools: `workbench_brief`, `workbench_refresh`, `workbench_sources`.
- Client half: a bento widget grid in the `main` slot plus a `sidebar.panellist` entry that
  the sidebar wires to the panel on its own.
- Five built-in sources: AIHOT selected, AIHOT hot topics, HuggingFace daily papers,
  Product Hunt, and YouTube (Dwarkesh Patel).
- Five card kinds — `feed`, `papers`, `media`, `products`, `rank` — so each source gets the
  shape its content deserves rather than one generic list.
- Zero dependencies, no build step; `dev/selftest.mjs` runs the real `apply()` against a
  fake context (offline fixtures for the feed reader included).
