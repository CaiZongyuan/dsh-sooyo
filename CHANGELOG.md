# Changelog

## 0.2.0 — 多设备同步与 Agent Context Bridge

实现 [issue #1](https://github.com/CaiZongyuan/dsh-sooyo/issues/1) 的 PR1–PR5。三种角色
（`standalone` / `hub` / `client`）由同一份代码提供，靠 `sync.role` 选择；不配 `sync` 时行为与 0.1.0
完全一致。设计与理由见 [`docs/adr/0002`](./docs/adr/0002-single-authoritative-hub.md)，部署与协议见
[`docs/sync.md`](./docs/sync.md)。

### Host — 服务分层（PR1）

- **`core/commands.js` 是唯一的写入通道。** 本地 `POST /sooyo/action`、同步 API 的 `POST /command`、
  Agent 工具全部经它；校验、白名单、计划、日志、revision 只实现一次。
- **命令白名单从 `daily.js` 的 `ACTIONS` 派生**，不存在第二份容易忘记同步的列表。`item.state` 与
  `proposal.*` 因为属于条目状态与收件箱状态，留在 `core/commands.js`。
- **计划先于写入。** 命令体先对着一个录制版 tables 门面跑一遍，得到确定的有序写步骤（含已经 `newId()`
  出来的实体 id），再写日志、再落盘。这让崩溃可恢复、重试不会建出第二条记录。
- **`LocalSooyoService` / `RemoteSooyoService` 满足同一个接口**（`snapshot` / `items` / `context` /
  `meta` / `execute`），路由与工具只认这个对象。

### Host — Hub API（PR2）

- **`/sooyo/sync/v1/*`**：`health` / `snapshot` / `items` / `context` / `command` 五个端点，
  `Authorization: Bearer`，**认证先于读取请求体**。
- **`ETag` 就是 `dataRevision`**，所以 `If-None-Match` 可以安全地返回 `304`：revision 只在写入落盘后前进。
- **`operationId` 幂等**：重试回放第一次的结果并标 `replayed`，创建型命令不会造重复实体（AC-03）。
- **`precondition` → `409`**：响应带当前记录与 revision，绝不静默覆盖（AC-02）。
- **`read` / `write` 两种令牌**；单设备 60 秒 240 次的限流；`allowLoopbackOnly` 默认 `true`。
- **旧 `/sooyo/*` 路由保留 `isLoopback` 保护**，与同步 API 分开注册在更长的前缀上。

### Host — Client 角色

- Client **不打开权威存储域**，不 seed、不抓取、不跑后台任务。读走 Hub，写转发 Hub。
- 缺 endpoint 或缺令牌时**明确报错**；Hub 不可达时展示最后一次成功的缓存并标 `stale`，
  从没同步过则报错——绝不显示一个空仪表盘（AC-05）。
- 写入成功后失效缓存；`cacheMs`（默认 15s）内的重复读取不重复请求。

### Host — 迁移与恢复（PR3）

- **`GET /sooyo/export`** 导出个人数据（不含抓取的条目、不含 per-device 的已读状态）。
- **`POST /sooyo/import`** 默认是 dry-run，逐表列出新建/相同/覆盖/冲突/拒绝；只有带 `apply: true`
  才写，冲突永远不覆盖，除非显式 `overwrite: true`。中断后重跑不会产生重复实体。
- **`journal` 表**让多表命令（`board.remove` 等）在崩溃后可被检测；`recover()` 在存储域打开后、
  服务任何请求之前运行，并裁掉过期的幂等记录。不把多步写入说成事务。

### Host — Agent（PR4 / PR5）

- **七个新工具**：`sooyo_context_get`、`sooyo_task_list`、`sooyo_task_create`、`sooyo_task_update`、
  `sooyo_note_capture`、`sooyo_inbox_list`、`sooyo_proposal_create`，外加审阅入口
  `sooyo_review_run`。原来的三个工具名字与返回结构不变。
- **没有通用的 `sooyo_action` 工具**：模型不能自己指定命令名与任意 body。
- **`sooyo_task_update` 强制带 revision**：写入基于过期视图时返回 `conflict` 并提示重新读取。
- **`agent/pre-step` Context Bridge**：只在真人发言的批次注入一次、每轮一次、约 150–300 token，
  失败不阻塞整轮。注入消息带 `source.kind = plugin:sooyo`，所以既不会被当成用户原始发言，
  也不会被 OpenViking 收进长期记忆。只用工具结果组成的批次不重复注入。
- **后台审阅只在 Hub 上**：`sooyo_review_run` 做零成本的确定性扫描（比对每条记录的 revision 与游标），
  没有变化时提示模型立刻结束这一轮；`ack` 单独推进游标，所以失败不会吞掉积压。
- **Agent 收件箱**：建议写进 `agentInbox` 表并随仪表盘下发；`proposal.decide` **仅限本机**，
  同步 API 拒绝它，模型无法批准自己的建议。批准与执行是两个状态，执行失败标 `failed`。

### Client

- **Agent 收件箱 Widget**（S / M / L）：逐条显示建议、被提议的操作、证据数与时间，
  本机批准或拒绝。批准后如果执行失败，提示会说明"已批准，但执行失败"，不谎报成功。
- 「总览」Board 默认带一个 Agent 收件箱（S）。
- 新增 `--sy-t-agentInbox` 类型色。

### Tooling

- `npm run check` 覆盖 16 个文件。
- 离线自测从 83 条涨到 **188 条**，新增覆盖：同步 API 的认证/ETag/304/409/422/400/403/429、
  operationId 幂等、写队列、迁移 dry-run 与冲突、Agent 工具、审阅游标（AC-12）、
  Context Bridge 的注入条件与去重。
- 测试里的 Hub 是**真的 route handler**，Client 是真的 `RemoteSooyoService`，只把 `fetch` 换成
  直接打该 handler 的假实现——所以测的是 `webServer` 会调用的同一段代码。

### Fixed

- `SyncError` 曾经把 `'unsupported-operation'` 这类"码值"当成"键名"查表，于是未知命令被降级成
  `400 bad-request` 而不是 `422`。现在两种写法都接受。
- 审阅游标的写入与查询用了不同的 key 形状（`task-t-1` vs `task:t-1`），导致 ack 静默失效、
  每次扫描都重复返回同一批条目。现在两侧共用一个 `cursorKey()`（AC-12 的回归测试覆盖它）。

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
