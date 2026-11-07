# Changelog

## Unreleased — 上游感知：AIHOT 能力说明与更新检测

插件此前对"上游"一无所知：AIHOT 新增周报、月报、重置监控时，Agent 只会照旧回答"查不到"；
插件自己有新提交时，也没有任何地方会说。这次把两件事都变成 Agent 的上下文。

### Added

- **`sooyo_aihot`**：读 AIHOT 的 Agent 能力说明（`/api/v1/agent`，Markdown）与更新日志
  （`/changelog`）。取 `what: 'guide' | 'changelog' | 'both'`，日志按 `days` / `limit` 截断。
  这是"AIHOT 支持什么"的权威答案，不用再靠猜端点。
- **`sooyo_update_check`**：把运行中的构建与上游默认分支对比，并给出**这个安装方式**下该跑的命令。
  只读——真的更新仍由人执行。
- **Context Bridge 多一行**：AIHOT 最新一条改动 + 有更新时的 `a-b → c-d` 提示。两者都只在
  有话说时出现（已是最新、或日志没变，就不占 token）。
- **`__SOOYO_BUILD__`**：`dev/build.mjs` 在构建时内联 `version` / `commit` / `dirty`。
  装出来的包没有 `.git`，只有构建那一刻同时读得到两者。

### Design notes

- **更新日志不是 Source。** Source 产出的是带封面、评分、已读状态的条目；发布记录会把
  dashboard 塞满 Release Notes。它属于"Agent 该知道的事"，所以走上下文与工具，不进卡片流。
- **`commit` 保持裸 40 位十六进制。** 未提交改动单独放在 `dirty`：`-dirty` 后缀会让每个
  带本地修改的构建都判定为"落后于上游"，这正是更新检测最容易给错答案的地方。
- **检测不到就说检测不到。** 拿不到本地 commit（tarball 安装）时 `updateAvailable` 是
  `null` 而不是 `false`——"我没看出来"和"你已是最新"是两回事，绿色徽章挂在错的答案上比没有更糟。
- **GitHub refs 而不是 REST API。** `info/refs` 是 `git ls-remote` 的请求，没有 60 次/小时的
  匿名额度；REST 的额度是**按 IP 全机共享**的，几个 GitHub 装的插件就能把它耗尽，
  然后整份更新列表静默失灵（`dshmarket` 的 #349）。
- **只有权威角色读。** client 会读到 Hub 的日志和 Hub 的构建，把另一台机器的版本当成自己的，
  比不报更糟。

## Unreleased — 手机端布局修复与暗色磨砂

手机浏览器截图暴露了两个真问题，都不是"渲染失败"而是"渲染得很糟"：面板照常显示，只是顶栏占了
18% 的屏幕，并且把滚动到它下面的标题切断了。

### Fixed

- **粘性顶栏不再切断标题。** 顶栏原来是完全不透明的 `background: var(--sy-bg)`。手机上它折成
  四行、高 156px（844px 视口的 18%），标题滚到下面就被从字形中间切开——截图里
  "持，6 个书签常去"少了一半就是这个原因。现在改成半透明底色 + `backdrop-filter` 磨砂，
  内容从下面模糊透出而不是被硬切。带 `@supports not` 回退：不支持滤镜的浏览器仍用不透明底色，
  否则这个 bug 会原样回来。
- **手机顶栏从四行压到两行（156px → 101px）。** Board 条不再独占一行，而是与品牌同行并在
  溢出时横向滚动——手机 tab 栏本来就这样。右缘加 `mask-image` 渐隐，因为"按钮被切一半"
  读起来是坏了，而"渐隐"读起来是"右边还有，滑一下"。
- **标题在手机上降级为导语（20px / 19px）。** 24px 会折成四行并把第一张卡挤出屏幕。
- **`.sy-page` 的内边距改用 media query。** 它是 `sy` 容器的**父级**，容器查询永远够不到它；
  第一版写进 `@container` 里，什么也没发生。

### Changed

- **暗色主题换成暖中性深色。** `#0E0F12`（偏蓝的黑）→ `#121211` 地面 / `#181816` 卡面。
  偏蓝的黑读起来像"屏幕"，微暖的黑读起来像"材质"——这正是上面那层磨砂能看出玻璃感的前提。
  层次靠发丝线与内高光，而不是大幅亮度差，这样密集网格才安静。
- **加了颗粒层。** 平涂深色在 OLED 上会有色带，和照片卡并排时显得假。一层内联 SVG 湍流
  （3% / 暗色 5%，overlay 混合）打散它，代价是一次缓存的绘制，没有贴图文件、没有额外请求。
  它挂在一个真实节点 `.sy-grain` 上而不是伪元素：伪元素离一次规则冲突只差一行，
  而且真实节点可以开关、可以断言。
- 投影改成"内高光在前"：深色表面上那 1px 受光边缘才是材质的来源。

### Tooling

- `dev/mobile-harness.mjs` + `dev/measure-mobile.mjs` + `dev/shoot-themes.mjs`：从 `client.js`
  里抽出真实 CSS，在真实 DOM 形状上按 390×844 排版，再用 CDP 量几何（不是靠截图目测）。
  两处 bug 都是这样定位的：`agent-browser` 在这台机器上会挂，而截图说不出"为什么"。
- 自测加 6 条布局守卫（196 条）：容器查询必须排在它覆盖的基础规则之后、`.sy-page` 必须用
  media query、顶栏必须磨砂且带回退、暗色必须是暖调、颗粒层必须有对应节点。
  这些都是"能渲染但很难用"的退化，普通断言抓不到。

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
