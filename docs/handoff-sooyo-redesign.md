# Handoff: implementing the sooyo daily redesign

The redesign is settled as a prototype; this document takes an agent from that prototype to a working plugin. Use the words in `GLOSSARY.md` (Board, Widget, Widget Type, Size, Source, Item, 呈现, 卡片流, 关注词, Task, Inbox, Today, Capture, Note, Read Later) in code, UI copy and commit messages.

## Sources of truth

Read these before writing code; this document only links them.

| What | Where |
|---|---|
| Vocabulary | `GLOSSARY.md` |
| Why a Widget is no longer a Source's card | `docs/adr/0001-widget-decoupled-from-source.md` |
| Hard constraints (no `node_modules`, Host restart, path-safe keys, no clipping, fetched content is data) | `AGENTS.md` |
| Visual and interaction spec | `prototype/sooyo-daily.html` (open it in a browser; it runs without a server) |
| Icon assets, three candidate styles | `prototype/assets/{a,b,c}/*.webp` |
| How icons were generated | `docs/agents/image-generation.md` |

The prototype is the spec, so match it rather than reinterpret it. Its script is organised so each part maps to something you build:

- `T`: the Widget Type registry. Each type lists its Sizes as desktop `[cols, rows]`, plus its actions.
- `footprint()`: maps a Size to the 12 / 6 / 4 column breakpoints. `pack()` is the first-fit compaction that places Widgets with no holes.
- `fit()`: drops whole rows that do not fit, which is how every card keeps `ov=0`.
- `R.<type>`: one renderer per Widget Type and Size. `R.subscription` branches on 呈现 (图文 / 榜单 / 论文 / 产品 / 视频).
- `deckView` / `layoutDeck` / `deckGo` / `deckAct` and the `pointerdown` / `wheel` / `animationend` handlers: the 卡片流 layout and its gestures.
- `matchOf`: 关注词 matching. `subItems`: sorting, including `match` (关注优先).
- `freshState()`: the default Boards (总览 / 工作 / 生活 / 阅读), their Widgets and settings.

Everything personal in the prototype is example data: Tasks, calendar events, Projects and GitHub activity, habits, weather. Only 订阅 Items come from a real fetch, and that snapshot (`prototype/snapshot.js`, `prototype/covers/`) is gitignored. Without it the prototype falls back to the hand-written `SAMPLE`.

## Steps

### 1. Host: fetch the fields the new cards need

The prototype's snapshot was enriched by hand; the plugin drops these fields today. Extend the `SOURCES` loaders in `index.js` (and `feed.js` for YouTube):

- **hf-papers**: keep `paper.ai_summary` (as `tldr`), `paper.ai_keywords` (first 5), `paper.mediaUrls[0]` when it is an image, `paper.projectPage`, `paper.githubStars`, the author count, and the full `paper.summary`.
- **youtube**: mark each entry as a Short or an episode (the link contains `/shorts/`). Parse `media:starRating@count` as likes and `media:description`. Use the cover `maxresdefault.jpg` for episodes and `oardefault.jpg` (9:16) for Shorts, falling back to `maxresdefault`.
- **aihot**: keep `category`. The loader already reads it; the 图文 cards filter and colour by it.

Done when: `npm run test:offline` passes with a new fixture for each parsing change (AGENTS.md requires one for every `feed.js` change), and a networked `npm run test` shows the new fields on real Items.

### 2. Host: store Boards, Widgets and personal data

ADR 0001 retires `SOURCES[].widget`. A Source may still suggest a default 呈现, but layout becomes user data. Add storage-domain tables for: Boards, Widgets (type, settings, title), layouts per Board per breakpoint (an ordered list of `{ widgetId, size }`), 关注词, Tasks, Notes, and Read Later. Keys must stay path-safe (AGENTS.md rule 3). Expose them through `/sooyo/*` routes that mirror what the prototype's handlers do: toggle a Task, Capture, save to Read Later, reorder and resize Widgets, add and remove Widgets, create a Board.

Done when: every mutation the prototype performs has a route, and its state survives a DSH restart.

### 3. Client: port the design

Rebuild `client.js` from the prototype, keeping the client half dependency-free:

- the design tokens and the light and dark themes;
- the top bar: Board segments, Command Bar, edit switch, the 添加 Widget button;
- the greeting headline;
- the packed grid with FLIP animation, edit mode (drag to reorder, resize to a supported Size, duplicate, remove);
- the Widget Gallery;
- every `R.<type>` renderer, including 卡片流 and 关注词.

Swap the example data for the Host routes from step 2.

Done when: each Board matches the prototype at 1440, 834 and 390 px wide, in both themes, and every card reports `ov=0`.

### 4. Ship icons and update the docs

- **Icons**: the style is undecided (A 瓷白, B 磨砂 or C 黏土). Ask the user before shipping one. Then ship that style's WebP files, list them in `package.json` `files`, and serve them so the client half can load them, for example from the Host route prefix. A dark variant of the chosen style is still to be generated.
- **AGENTS.md**:
  - rewrite rule 4: the Widget Type selects the renderer, and the Widget's Size selects the information level;
  - update the file map;
  - point the `ov=0` snippet at the new card class.

Done when: the plugin renders icons from its own files, and AGENTS.md describes the new model with no leftover reference to `kind` deciding size.

## Gotchas

- **The network from WSL goes through a proxy.** Node ignores `HTTPS_PROXY` unless you set `NODE_USE_ENV_PROXY=1`, so a networked `npm run test` without it times out on every Source.
- **AIHOT terms forbid public redistribution**, and this repo is public. Never commit fetched Items or covers, including test fixtures copied from live data. Write fixtures by hand.
- **HF teaser figures are rare**: in the 2026-11-04 fetch only 1 of 8 papers had an image in `mediaUrls`. Paper cards must read well on text alone, which the prototype's design assumes.
- **YouTube `oardefault.jpg` returns 404 for some Shorts.** Fall back to `maxresdefault.jpg` and let CSS `object-fit: cover` crop it to 9:16.
- **Measuring `ov` inside a 卡片流 needs layout boxes.** Stacked and departed cards carry transforms, so `getBoundingClientRect` reports their transformed position. Check card contents with `offsetTop + offsetHeight` against the inner box's height minus its bottom padding.
- **agent-browser caches `snapshot.js` and the page across reloads.** Before re-measuring after an edit, refetch both with `fetch(url, { cache: 'reload' })`.

## Out of scope

- App pages (a full RSS reader, a task manager). The user chose Widgets only for now.
- The Agent Board planner is a static preview in the prototype; a real implementation needs an authorised operation interface for Agents, which has not been designed.
