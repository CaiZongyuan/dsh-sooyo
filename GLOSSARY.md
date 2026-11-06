# sooyo daily

A composable, local-first personal space: the page you open each day to see what to do, what is worth reading, and where your projects stand.

## Layout

**Board**:
A named container of Widgets with its own layout, such as 总览, 工作, 生活 or 阅读. Boards share the same underlying data.
_Avoid_: Dashboard, 场景, 页面, 工作台

**Widget Type**:
A kind of Widget, such as 订阅, 任务 or 习惯, that declares its supported Sizes, settings and actions.
_Avoid_: Component, kind, card type

**Widget**:
One placed instance of a Widget Type on a Board, with its own settings and Size. Two 订阅 Widgets are two instances of one Widget Type.
_Avoid_: Card, 卡片, 组件

**Size**:
The footprint a Widget occupies, one of S, M, L or Wide; each Size shows a different level of information, not a stretched copy.
_Avoid_: Span, colSpan, rowSpan

**订阅 (Subscription Widget Type)**:
The single Widget Type that shows Items from one or more Sources, whatever protocol those Sources use.
_Avoid_: RSS 组件, Feed widget

**呈现 (Presentation)**:
A 订阅 Widget's setting for how its Items look: 图文, 榜单, 论文, 产品 or 视频. A Source suggests the default.
_Avoid_: kind, 卡片形态, layout

**卡片流 (Deck)**:
A layout of a 订阅 Widget that shows one Item at a time as a stack of cards the user swipes through, instead of a list.
_Avoid_: 轮播, carousel, slider

**App**:
The full page for one kind of data, such as the RSS reader or the task manager, that a Widget opens into.
_Avoid_: Module, 完整页面

## Information

**Source**:
An external origin of Items, such as AIHOT or one RSS address. A Widget may draw from one or more Sources.
_Avoid_: Feed, 信息源 (when meaning a card)

**Item**:
One piece of content fetched from a Source, always carrying its Source and original link.
_Avoid_: Article, post, entry

**关注词 (Interest)**:
A keyword the user cares about; Items that match one are marked and can be ranked first. Interests are shared by all 订阅 Widgets.
_Avoid_: 标签, tag, 偏好

**Read Later**:
The list of Items the user has set aside to read, retaining each Item's essential summary and link even after it ages out of its Source.
_Avoid_: 收藏夹, bookmarks, favourites

## Personal data

**Task**:
One thing the user intends to do; it lives in exactly one of Inbox, Today or Later, and may belong to a Project.
_Avoid_: Todo, 待办, 清单项

**Inbox**:
Where a Task lands before it has been scheduled.
_Avoid_: 未分类, backlog

**Today**:
The Tasks the user has committed to doing today.
_Avoid_: 今日重点, focus list

**Later**:
Tasks that are scheduled but not for today.
_Avoid_: Upcoming, someday

**Project**:
A body of ongoing work that Tasks belong to and whose progress is summarised on a Board.
_Avoid_: 项目组, workspace

**Note**:
A piece of knowledge the user keeps, written directly or derived from an Item.
_Avoid_: 知识条目, 灵感, memo

**Origin**:
The Item a Task or Note was made from, kept with its Source and original link so the user can always go back to it.
_Avoid_: 来源 (ambiguous with Source), reference

**Capture**:
The act of recording a thought in one line; it produces a Task in the Inbox, or a Note when marked as one.
_Avoid_: 快速笔记, quick add

## Sync and reliability

**Hub**:
The single authoritative instance that owns the user's personal data, fetches Sources, and runs scheduled Reviews.
_Avoid_: Master, primary, server, cloud

**Client**:
A non-authoritative device instance that reads and writes through a Hub, holding only a local Replica and Outbox.
_Avoid_: Slave, follower, secondary, 浏览器端 (when meaning the sync role)

**Standalone**:
The default single-device role that owns its own authoritative data locally without exposing remote sync.
_Avoid_: Local mode, offline mode

**Revision**:
The monotonic number stamped on the workspace and on each personal record after a confirmed write, used to detect concurrent edits and validate caches.
_Avoid_: Version, timestamp, ETag

**Operation**:
One named, idempotent command identified by a stable operation ID that produces the same entities and result when retried.
_Avoid_: Action (on the sync wire), transaction, event

**Intent**:
The durable record of a planned Operation written before its changes are applied, so an interrupted write finishes deterministically on recovery.
_Avoid_: WAL, redo log, transaction log

**Precondition**:
The expected Revision of an entity attached to an edit so a stale write is refused as a Conflict instead of overwriting newer changes.
_Avoid_: Lock, CAS, optimistic lock

**Conflict**:
A refused Operation whose Precondition no longer matches the Hub's current Revision, preserved with both versions until the user resolves it.
_Avoid_: Merge error, sync failure

**Replica**:
A Client's local read-only cache of the last confirmed Hub snapshot, explicitly marked stale when the Hub cannot be reached.
_Avoid_: Local database, local store, secondary authority

**Outbox**:
A Client's durable queue of pending Operations recorded locally while offline or awaiting Hub acknowledgement.
_Avoid_: Write buffer, mutation queue

**Operational Backup**:
A complete point-in-time snapshot of the Hub's authoritative state used to restore an instance after hardware or storage failure.
_Avoid_: Export, dump

**Portable Export**:
A versioned, self-contained package of the user's personal data and referenced Items for moving across profiles or leaving the platform.
_Avoid_: Backup, raw dump

## Agent collaboration

**Proposal**:
A structured batch of suggested workspace changes with rationale, evidence, and before/after preview, held in the Agent Inbox until a human decides.
_Avoid_: Suggestion, draft, auto-edit

**Agent Inbox**:
The queue of pending and decided Proposals where a human reviews diffs, approves or rejects changes, and rolls back applied Proposals.
_Avoid_: Notification center, Inbox (which is a Task list)

**Review**:
The scheduled, deterministic scan of Tasks and Notes changed since the last cursor that invokes the Agent to propose improvements only when new changes exist.
_Avoid_: Cron job, auto-summary, background agent

**Context Bridge**:
The compact digest of current workspace state injected at the start of a human-initiated Agent turn so the model knows what the user is working on.
_Avoid_: System prompt injection, memory recall
