<p align="center">
  <img src="./icon.svg" width="96" height="96" alt="dsh-sooyo" />
</p>

<h1 align="center">sooyo daily</h1>

<p align="center"><b>一个可组合、本地优先的个人空间：每天打开就看到要做什么、有什么值得读、项目走到哪了。<br/>
A composable, local-first personal space for <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>.</b></p>

<p align="center">
  简体中文
  ·
  <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/dsh-%3E%3D0.2.0--rc.1-1a73e8?style=flat-square" alt="dsh >= 0.2.0-rc.1"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT"></a>
  <img src="https://img.shields.io/badge/build-none%20needed-brightgreen?style=flat-square" alt="no build step">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square" alt="zero dependencies">
</p>

![深色主题](./docs/screenshots/dark.png)

---

在 DSH 的侧栏多一个「sooyo daily」，点开就是你的主页：顶部是 Board 分段、命令栏与问候，下面一整块 bento 网格，每格是一个 Widget。

模型只有一句话：**Board 装着 Widget，Widget 是用户摆上去的一个实例，Source 只负责供内容。**

## 特性

- **Board / Widget 两层。** 总览、工作、生活、阅读四个 Board 开箱即用，也可以自己建；同一个 Widget Type 可以放好几份，各自选来源、呈现和尺寸。
- **Widget Type 选渲染器，Size 选信息密度。** S / M / L / Wide 是四种不同的信息层级，不是把一张卡拉伸；每种 Widget 只声明它真正支持的尺寸。
- **订阅 Widget 一种类型包打五种呈现。** 图文 / 榜单 / 论文 / 产品 / 视频 —— 加一个源不用写客户端代码，源只「建议」一个默认呈现。
- **卡片流（Deck）。** 一次一条、可拖动（右滑稍后读、左滑跳过）、论文卡翻面看摘要，S 尺寸自动轮播；方向键也能用。
- **关注词。** 命中标题、摘要、一句话总结或推荐理由的条目带标记，「关注优先」排序把它们排到前面。
- **缺图就去那个页面取封面。** AIHOT 和 Product Hunt 的接口本身不带图片，所以宿主半会去条目链接的页面读 `og:image`（也吃 `twitter:image` 和 JSON-LD），**每个页面只读一次**、只读前 160KB 就断开、结果永久缓存；读不到图的页面也会被记下来，不会反复请求。
- **个人数据落在 DSH 存储域上。** Board、布局、任务、Note、稍后读、关注词、习惯、番茄钟都持久化；换机器换进程都还在。
- **零依赖、零构建。** 纯 JavaScript，`package.json` 里没有 `dependencies`，没有打包步骤 —— 装完即用。
- **自带出网层。** 每源独立节奏、条件请求（ETag/304）、全局并发上限、失败按 1/2/4… 分钟递增重试，一个源坏掉不影响别人。
- **内容只当资料。** 抓到的第三方文本一律不执行其中的指令；每条都带来源与原文链接。
- **也能喂给模型。** 注册了 `sooyo_brief` / `sooyo_refresh` / `sooyo_sources` 三个工具，配合 DSH 自带的定时任务就能做每日早报。
- **多设备一份数据。** 一台机器当 Hub 持有权威数据并抓取信源，其它机器当 Client 代理读写；记录不启动模型，下次真人对话时按需注入一份有界的最新状态。详见 [docs/sync.md](./docs/sync.md)。

## 三种角色

| 角色 | 谁持有数据 | 抓取信源 | 适合 |
|---|---|---|---|
| `standalone`（默认） | 本机 | 本机 | 单机使用，行为与之前完全一致 |
| `hub` | 本机 | 本机 | 常驻服务器，对外提供受令牌保护的同步 API |
| `client` | Hub | 不抓 | 笔记本、手机等其它设备 |

```yaml
# Hub
sync:
  role: hub
  tokens:
    - { token: '至少-16-字符的随机串', device: macbook, access: write }
```

```yaml
# Client
sync:
  role: client
  endpoint: https://sooyo.example.com
  # 令牌建议走环境变量 SOOYO_SYNC_TOKEN
```

不写 `sync` 就是 `standalone`：老配置完全不用改。Client 缺 endpoint 或缺令牌时会明确报错，
**不会**悄悄起一个空的本地库。

## Agent 工具

| 工具 | 读/写 | 用途 |
|---|---|---|
| `sooyo_context_get` | 只读 | 今日/未完成/收件箱/最近笔记/待批建议的实时摘要 |
| `sooyo_task_list` | 只读 | 按列表、完成状态、Project 过滤任务 |
| `sooyo_task_create` | 写入 | 建任务（可带 Origin） |
| `sooyo_task_update` | 写入 | 改任务，**必须带 revision**：被别的设备改过会返回 conflict |
| `sooyo_note_capture` | 写入 | 记笔记，来源标记为 agent |
| `sooyo_inbox_list` | 只读 | 看待审批的建议 |
| `sooyo_proposal_create` | 写入建议 | 写一条待批准的建议，**不直接改数据** |
| `sooyo_review_run` | 只读+游标 | 后台审阅的确定性入口：先免费扫描，再 ack 看过的条目 |

保存 Todo 不调用任何模型；`sooyo_action` 这种能传任意命令名的通用工具**故意不做**。

## Widget 库

| Widget | 尺寸 | 说明 |
|---|---|---|
| 任务 | S / M / L | 今天要做的事，直接勾选完成；可以只看一个 Project |
| 订阅 | S / M / L / Wide | 一个或多个来源的最新内容，可选五种呈现与卡片流 |
| 快速记录 | M / Wide | 一行记下想法，回车进收件箱；`#note` 开头存为 Note |
| 书签 | S / M / Wide | 常去的网站一键直达 |
| 项目 | S / M / L | 按任务完成度算进度，不连外部服务 |
| 稍后读 | S / M / L | 存下来、晚点再读的文章 |
| Agent 收件箱 | S / M / L | 后台审阅给出的建议，逐条批准或拒绝 |
| 习惯 | S / M | 每天打卡，看连续天数 |
| 专注计时 | S / M | 番茄钟，可关联一个任务，倒计时由宿主保存 |
| 日程 / 天气 / 简报 / 嵌入 | — | 需要一个数据源，尚未接上；在库里标为「即将推出」而不是显示假数据 |

## 内置信息源

| 源 | 默认呈现 | 封面来源 | 频率 |
|---|---|---|---|
| [AIHOT](https://aihot.news) 精选 | 图文 + 评分与推荐理由 | 原文页 `og:image` | 10 分钟 |
| AIHOT 热榜 | 榜单（多源热点 Top 10） | 无（编号即视觉） | 30 分钟 |
| [HuggingFace 论文](https://huggingface.co/papers) | 论文真实封面 + 一句话总结 + 关键词 + 赞数/评论 | HuggingFace CDN 或论文配图 | 6 小时 |
| [Product Hunt](https://www.producthunt.com) 今日 | 字母徽标 + 一句话 | 产品页 `og:image` | 3 小时 |
| YouTube · [Dwarkesh Patel](https://www.youtube.com/@DwarkeshPatel) | 完整节目 16:9，Shorts 竖屏货架 | YouTube 缩略图 | 3 小时 |

## 安装

前置：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) `>=0.2.0-rc.1`、Node.js `>=20`。

从 GitHub 直接装（Web profile）：

```sh
dsh plugin --profile web add github:CaiZongyuan/dsh-sooyo
```

桌面端可以在「设置 → 插件」里安装；本地开发时也可以用插件管理器指向本目录。

装好之后重启一次 DSH（宿主插件是按 specifier 缓存的，改动要新进程才生效），刷新页面，侧栏就会出现「sooyo daily」。

## 配置

`cordis.patch.yml` 的 `config`：

| 字段 | 默认 | 说明 |
|---|---|---|
| `mode` | `selected` | AIHOT 取 `selected`（编辑精选）还是 `all`（全部公开动态） |
| `sources` | 全部 | 只启用列出的源 id |
| `refreshMinutes` | — | 覆盖所有源的抓取节奏 |
| `thumbnailBatch` | `6` | 每轮补封面的页面上限（最大 20） |
| `sync.role` | `standalone` | `standalone` / `hub` / `client`，见 [docs/sync.md](./docs/sync.md) |
| `sync.tokens` / `sync.token` | 环境变量 | Hub 的设备令牌 / Client 的令牌，只存 Host 侧 |
| `sync.allowLoopbackOnly` | `true` | Hub 是否只接受本机连接 |
| `sync.context` | `true` | 是否在真人对话时注入 Sooyo Context |

## 后台审阅

只在 Hub 上跑一条 DSH Schedule（时间取自 `GET /sooyo/review/schedule` 的 `spec`）。它的第一步是
`sooyo_review_run` 的确定性扫描：没有新增或改动过的事项时提示模型立刻结束这一轮，不产出任何内容。

建议不会直接改数据，而是进 Agent 收件箱等你在界面上批准；**同步 API 拒绝批准操作**，
所以模型无法批准自己写的建议。审批后按条执行，失败的标为 `failed` 而不是假装成功。

## 备份与迁移

```sh
GET  /sooyo/export                       # 导出 JSON（不含抓取到的条目）
POST /sooyo/import                       # 不带 apply：dry-run，逐表列新建/相同/冲突/拒绝
POST /sooyo/import  { apply: true }      # 真正写入；冲突仍然不覆盖
POST /sooyo/import  { overwrite: true, apply: true }   # 显式覆盖
```

导入永不删除、永不覆盖未确认的记录，中断后重跑不会产生重复实体。切换设备到 `client` 之前先备份，
切换本身不删除任何本地数据。

## 加一个源

```js
{
  id: 'my-source',
  label: '我的源',
  cadenceMinutes: 180,
  suggests: { pres: '图文' },   // 只是新建订阅 Widget 时的默认呈现
  async load(signal, previous) {
    // 返回 { items: [{ nativeId, title, url, publishedAt, summary, score, category, origin }], etag }
  },
}
```

源不再声明卡片：它只供 Item，以及「建议」一个呈现。布局、尺寸、放在哪个 Board 都是用户数据。

想关掉某个源，编辑本包的 `SOURCES` 注册表把对应项注掉即可 —— 那就是唯一的信息源扩展点。

## 开发

```sh
npm run check         # 16 个文件的语法检查
npm run test          # 完整自测（会联网实拉 5 个源，并断言新卡片读的字段）
npm run test:offline  # 离线 fixture、个人数据接口、同步协议与结构断言（CI 用这个）
```

`dev/selftest.mjs` 用假 `ctx`（假的 `storageDomain.open` / `webServer.register` / `tools.register` / `effect`）直接跑真的 `apply()`，并用假 `req`/`res` 打自己注册的路由。**宿主的改动要重启才生效，所以先在本地把逻辑跑一遍比反复重启快得多。**

架构与取舍记录在 [`docs/design.md`](./docs/design.md)，术语见 [`GLOSSARY.md`](./GLOSSARY.md)。

## 数据来源与合规

- 抓到的内容版权归各原始来源。本插件只做个人非商业聚合与展示。
- [AIHOT](https://aihot.news) 明确允许个人非商业使用，并保留 `attribution` 与原文链接；其服务条款见 <https://aihot.news/terms>。
- 抓到的第三方文本一律视为资料，**不作为指令执行**。
- 请遵守各站点的 robots 与使用条款；默认节奏已经按各站公开的缓存与限流建议设置。

## 许可

[MIT](./LICENSE)
