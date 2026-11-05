# 多设备同步（Hub / Client）

一份权威数据，多台各自独立跑 DSH 的设备。这份文档是部署与排障手册；为什么这样设计见
[ADR 0002](./adr/0002-single-authoritative-hub.md)，协议字段见 §3。

> **速答**：一台机器 `role: hub` 持有全部数据并发抓取，其余机器 `role: client` 只做代理；
> 不配 `sync` 就是原来的单机行为。

## 1. 三种角色

| 角色 | 谁持有权威数据 | 抓取信源 | 提供 `/sooyo/sync/v1/*` | Agent 工具 |
|---|---|---|---|---|
| `standalone`（默认） | 本机存储域 | 本机 | 否 | 读写本机 |
| `hub` | 本机存储域 | 本机 | 是（需令牌） | 读写本机 |
| `client` | Hub | 不抓 | 否 | 经 Hub 代理 |

`client` 不打开本地 `sooyo` 权威域。这不是省事，而是刻意的：一份会分叉的第二副本比没有副本更糟。
所以 `client` 缺 endpoint 或缺令牌时会**明确报错**，而不是悄悄起一个空库。

## 2. 配置

### Hub（常驻服务器）

```yaml
- insert:
    - id: sooyo
      name: dsh-sooyo
      config:
        mode: selected
        sync:
          role: hub
          device: tencent
          # 每台 Client 一个令牌，可撤销；access 为 read 或 write。
          # 也可以只设环境变量 SOOYO_SYNC_TOKENS='tokenA,tokenB'。
          tokens:
            - { token: 'REPLACE-WITH-A-LONG-RANDOM-STRING', device: macbook, access: write }
            - { token: 'REPLACE-WITH-ANOTHER-LONG-RANDOM-STRING', device: phone, access: read }
          # 默认 true：只接受本机连接。放在 Tailscale/Caddy 之后才关掉。
          allowLoopbackOnly: true
          review:
            daily: { time: '21:30:00', timeZone: 'Asia/Shanghai' }
```

令牌至少 16 个字符，短的会被忽略并记一条警告——一个能猜到的令牌比没有更糟。

### Client（笔记本、手机）

```yaml
- insert:
    - id: sooyo
      name: dsh-sooyo
      config:
        mode: selected
        sync:
          role: client
          device: macbook
          endpoint: https://sooyo.example.com   # 只写 origin，不要带路径
          # token 从环境变量读更安全：SOOYO_SYNC_TOKEN
          token: 'REPLACE-WITH-THE-HUB-ISSUED-TOKEN'
          cacheMs: 15000
          timeoutMs: 6000
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `role` | `standalone` | `standalone` / `hub` / `client`；未知值退回 standalone |
| `device` | `local` | 出现在 revision 的 `writer` 与审计里，`[a-zA-Z0-9_-]{1,64}` |
| `endpoint` | — | Hub 的 origin。路径被忽略：插件自己拼 `/sooyo/sync/v1` |
| `token` | `SOOYO_SYNC_TOKEN` | 只存在 Host 侧，永不下发浏览器 |
| `tokens` | `SOOYO_SYNC_TOKENS` | Hub 的设备表，见上 |
| `allowLoopbackOnly` | `true` | Hub 是否只接受 `127.0.0.1`/`::1` |
| `cacheMs` | `15000` | Client 快照缓存时长；0 = 每次直连 |
| `timeoutMs` | `6000` | 单次 Hub 调用的超时 |
| `context` | `true` | 是否在真人对话时注入 Sooyo Context |
| `review.daily` | `21:30 Asia/Shanghai` | 后台审阅的时间，见 §5 |

## 3. 协议 v1

所有路由在 `/sooyo/sync/v1/` 下，认证为 `Authorization: Bearer <token>`，**认证先于读取请求体**。

| 方法与路径 | 用途 |
|---|---|
| `GET /health` | 协议版本、角色、就绪状态、`dataRevision`；不含任何数据 |
| `GET /snapshot` | 仪表盘快照；带 `ETag`，支持 `If-None-Match` → `304` |
| `GET /items?limit=&kind=&source=&unread=&starred=&q=` | 一页条目 |
| `GET /context?scope=&limit=` | 给 Agent 的有界摘要 |
| `POST /command` | 唯一的写入入口 |

### 写入

```json
{
  "protocolVersion": 1,
  "operationId": "macbook-01JXXX0001",
  "name": "task.update",
  "body": { "id": "t-example", "done": true },
  "precondition": { "entity": "task", "id": "t-example", "revision": 3 }
}
```

- **`operationId` 必须复用。** 同一次语义重试要用同一个 id，Hub 会从幂等日志里回放第一次的结果
  （并标 `replayed: true`），所以断网重试不会产生第二条任务。
- **`precondition` 是可选的冲突检测。** 它和你读到的 `revision` 比较；不一致就是 `409`，响应里带
  当前记录与 revision，**绝不覆盖**。
- 创建型命令（`task.add`、`note.add`、`capture`、`board.create`、`widget.add`…）的实体 id 在计划
  阶段就已确定，重试不会 `newId()` 出第二个。

### 错误

| 状态 | code | 含义 |
|---|---|---|
| 400 | `bad-request` | 字段校验失败、`protocolVersion` 不支持、id 非路径安全 |
| 401 | `unauthorized` | 缺令牌或令牌无效 |
| 403 | `forbidden` | 只有读权限；或非 loopback 而 `allowLoopbackOnly` 为真；或调用了本机专属命令 |
| 409 | `conflict` | `precondition.revision` 与当前不一致，`details.current` 是当前记录 |
| 422 | `unsupported-operation` | 命令不在白名单 |
| 429 | `rate-limited` | 单设备 60s 内超过 240 次 |
| 503 | `not-ready` / `hub-unavailable` | Hub 存储域未就绪 / Client 连不上 Hub |

## 4. 一致性与恢复

- **单一写队列。** 所有命令在一条 promise 链上串行，所以两台设备的写不会在同一条命令的多步写入之间
  穿插。快照读取等到该队列排空后再报 revision——读写屏障，不是全局锁。
- **revision 只在写入落盘后前进。** 一条命令里的多条记录共用一个 revision；被拒绝的命令不消耗编号。
- **多表命令有日志。** `board.remove` 要删 Widget、删多个布局、删 Board、改设置——存储域没有跨表事务。
  所以命令执行前先写一条 `journal` 记录命名全部步骤，逐步执行并推进 `done`，最后删除该记录。
  启动时 `recover()` 会把没做完的记录**报告出来**（绝不猜测已完成），并把过期的幂等记录裁掉。
- **单 Hub 约束。** 不要让两个 DSH 进程以 `hub` 身份写同一份数据。Storage Domain 的单记录写入是持久的，
  但没有跨进程的修订协议。

## 5. 后台审阅

只在 Hub 上跑。Command 形式：

```js
schedule_create({
  title: 'sooyo 每日审阅',
  prompt: (取自 GET /sooyo/review/schedule 的 spec.prompt),
  daily: { time: '21:30:00', time_zone: 'Asia/Shanghai' },
})
```

为什么不是"当晚没变化就别叫模型"：DSH Schedule **总是**投递并激活模型，它没有条件触发。所以
`sooyo_review_run` 把条件检查做成一个免费工具调用：

1. 确定性比较每条任务/笔记的 `revision` 与 `agentReviews` 里的游标，**零模型调用**；
2. `shouldReview: false` 时提示词要求模型立刻结束这一轮；
3. 只对看过的事项 `ack`，游标才前进——失败或部分处理不会吞掉积压；
4. 建议写成 proposal 进 `agentInbox`，**批准是本机界面上的操作**，同步 API 拒绝 `proposal.decide`。

## 6. 迁移：从多台单机到单 Hub

1. 每台设备先 `GET /sooyo/export` 备份，记下各自的 `source.device` 与 `dataRevision`。
2. 选定 Server 的数据作为权威；Server 是空的时候，明确挑一台设备当来源，别让默认 seed 覆盖。
3. 在 Server 上 `POST /sooyo/import`（**不带 `apply`**）做 dry-run：它逐表列出新建/相同/覆盖/冲突/拒绝的条数。
   - 相同：跳过。
   - 冲突：**不覆盖**，列出来给你判断。
   - 需要覆盖时显式加 `overwrite: true`，再带 `apply: true` 才写入。
4. 确认 Hub 数据无误后，其它设备改成 `client`。**切换不删除任何旧本地数据。**
5. 导入中断就重跑：已经落地的记录会变成"相同"，不会产生重复实体。

默认 Board（`home/work/life/read`）的 id 在每台设备上一样，这正是不做"简单拼接"的原因：拼接会造出
四份重复 Board，而覆盖会悄悄丢掉一台设备的 Widget。

## 7. 排障

| 现象 | 原因与处理 |
|---|---|
| 面板显示"未同步"但内容还在 | Client 连不上 Hub，展示的是最后一次成功的缓存并标了 `stale`。查 `GET /sooyo/ping` 的 `sync.health`。 |
| 面板是空的且报"连不上 Hub" | Client 从未成功同步过。没有缓存可展示，也不会造一份本地数据。 |
| `403 sync API 只接受本机连接` | Hub 的 `allowLoopbackOnly` 还是 `true`。放到私网/HTTPS 之后才改。 |
| `403 这个凭证只有读权限` | 该设备的令牌是 `access: read`。 |
| `409 conflict` | 另一台设备先改了。UI 会刷新到最新；Agent 工具会提示重新读取 revision。 |
| 改了 Host 代码但行为没变 | Host 模块按 specifier 缓存，需要重启 DSH（AGENTS.md 规则 2）。 |
| Hub 重启后 Client 一直 503 | Hub 存储域还在打开，或 `journal` 里有需要人工确认的记录——看日志里的 `sooyo: journal ...`。 |
