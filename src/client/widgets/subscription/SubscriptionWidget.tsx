import * as React from 'react'
import {
  CATEGORY_COLOUR,
  CategoryBadge,
  EmptyWidgetState,
  I,
  ItemActions,
  ItemLink,
  MatchChip,
  MonoTile,
  ScoreBadge,
  SvgIcon,
  WidgetIcon,
  categoryLabel,
  coverOf,
  fmtCount,
  matchOf,
  relTime,
  safeUrl,
  widgetTitle,
} from '../shared.tsx'
import type { FeedItem, SubscriptionWidgetSettings, WidgetRecord, WidgetSize } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRenderContext, WidgetRendererProps } from '../../../shared/widget.ts'

export const DECK_SIZE = 10

export const SUB_SORTS: ReadonlyArray<readonly [SubscriptionWidgetSettings['sort'], string]> = [
  ['match', '关注优先'],
  ['new', '最新'],
  ['score', '评分'],
  ['rank', '排名'],
]

export const isShort = (item: FeedItem | null | undefined): boolean =>
  item?.kind ? item.kind === 'short' : /\/shorts\//.test(item?.url ?? '')

export const cleanDesc = (text: string | null | undefined): string =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/https?:/.test(line) && !/^[*•\-–]/.test(line))
    .join(' ')
    .slice(0, 240)

export function sortItems(
  items: readonly FeedItem[],
  sort: SubscriptionWidgetSettings['sort'],
  interests: readonly string[],
): FeedItem[] {
  const recent = (a: FeedItem, b: FeedItem) =>
    Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? '')
  const list = [...items]
  if (sort === 'rank') list.sort((a, b) => (a.metrics?.rank ?? 99) - (b.metrics?.rank ?? 99))
  else if (sort === 'score') {
    list.sort((a, b) => (b.metrics?.upvotes ?? b.score ?? 0) - (a.metrics?.upvotes ?? a.score ?? 0))
  } else if (sort === 'match') {
    list.sort((a, b) => (matchOf(b, interests) ? 1 : 0) - (matchOf(a, interests) ? 1 : 0) || recent(a, b))
  } else list.sort(recent)
  return list
}

export function subItemsOf(
  widget: WidgetRecord,
  items: readonly FeedItem[],
  interests: readonly string[],
): FeedItem[] {
  const settings = (widget.settings ?? {}) as Partial<SubscriptionWidgetSettings>
  const sources = settings.sources?.length ? settings.sources : ['aihot']
  let list = items.filter((item) => Boolean(item.sourceId && sources.includes(item.sourceId)))
  if (settings.cat) list = list.filter((item) => item.category === settings.cat)
  return sortItems(list, settings.sort ?? 'new', interests)
}

const heatMax = (items: readonly FeedItem[]): number =>
  Math.max(1, ...items.map((item) => item.metrics?.signalCount ?? 0))

const metaLine = (item: FeedItem): string => {
  const metrics = item.metrics ?? {}
  if (item.sourceId === 'hf-papers') {
    return `▲ ${metrics.upvotes ?? 0} · ${metrics.comments ?? 0} 评论 · ${relTime(item.publishedAt)}`
  }
  if (item.sourceId === 'youtube') {
    return `${metrics.views ? `${fmtCount(metrics.views)} 次观看 · ` : ''}${relTime(item.publishedAt)}`
  }
  if (item.sourceId === 'aihot-hot') return item.origin ?? ''
  return `${item.origin ?? item.sourceLabel ?? ''} · ${relTime(item.publishedAt)}`
}

const authorsLine = (item: FeedItem): string =>
  item.tags?.length
    ? `${item.tags[0]}${(item.authorCount ?? item.tags.length) > 1 ? ` 等 ${item.authorCount ?? item.tags.length} 人` : ''}`
    : ''

const videoMeta = (item: FeedItem): string =>
  `${relTime(item.publishedAt)}${item.metrics?.views ? ` · ${fmtCount(item.metrics.views)} 次观看` : ''}${item.metrics?.likes ? ` · ${fmtCount(item.metrics.likes)} 赞` : ''}`

function UpvotesBadge({ item, className = '' }: { item: FeedItem; className?: string }) {
  return (
    <span className={`sy-up ${className}`.trim()} title="HuggingFace 点赞">
      <SvgIcon svg={I.up} />
      {item.metrics?.upvotes ?? item.score ?? 0}
    </span>
  )
}

function KeywordChips({
  item,
  count,
  interests,
}: {
  item: FeedItem
  count: number
  interests: readonly string[]
}) {
  const keyword = matchOf(item, interests)
  const rest = (item.keywords ?? [])
    .filter((value) => !keyword || !String(value).toLowerCase().includes(keyword.toLowerCase()))
    .slice(0, keyword ? count - 1 : count)
  return (
    <div className="sy-kws">
      {keyword ? (
        <span className="sy-chip match">
          <SvgIcon svg={I.spark} />
          {keyword}
        </span>
      ) : null}
      {rest.map((value, idx) => (
        <span key={idx} className="sy-chip">
          {value}
        </span>
      ))}
    </div>
  )
}

function PaperLinks({ item }: { item: FeedItem }) {
  const id = String(item.url ?? '').match(/papers\/([\d.]+)/)?.[1]
  return (
    <div className="sy-links">
      <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer">
        论文{id ? <code> {id}</code> : null} <SvgIcon svg={I.out} />
      </a>
      {item.altUrl ? (
        <a href={safeUrl(item.altUrl)} target="_blank" rel="noopener noreferrer">
          代码{item.metrics?.stars ? ` ★ ${fmtCount(item.metrics.stars)}` : ''} <SvgIcon svg={I.out} />
        </a>
      ) : null}
      {item.project ? (
        <a href={safeUrl(item.project)} target="_blank" rel="noopener noreferrer">
          项目页 <SvgIcon svg={I.out} />
        </a>
      ) : null}
    </div>
  )
}

function NewsRow({ item, context }: { item: FeedItem; context: WidgetRenderContext }) {
  const colour = (item.category ? CATEGORY_COLOUR[item.category] : undefined) ?? 'var(--sy-ink3)'
  const catLabel = categoryLabel(item.category)
  return (
    <div className={`sy-row nr${item.state?.seen ? ' sy-seen' : ''}`}>
      <i className="sy-cdot" style={{ '--c': colour } as React.CSSProperties} />
      <ItemLink item={item} className="sy-it-a">
        <span className="tt c1">{item.title}</span>
        <span className="meta c1" style={{ whiteSpace: 'normal' }}>
          {catLabel ? `${catLabel} · ` : ''}
          {item.origin ?? ''} · {relTime(item.publishedAt)}
        </span>
      </ItemLink>
      <MatchChip item={item} interests={context.interests} />
      {typeof item.score === 'number' ? <span className="sy-sc">{item.score}</span> : null}
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function NewsLead({ item, context, big }: { item: FeedItem; context: WidgetRenderContext; big: boolean }) {
  const cover = coverOf(item)
  return (
    <div className={`sy-lead sy-nl${item.state?.seen ? ' sy-seen' : ''}`}>
      {big && cover ? (
        <ItemLink item={item} className="sy-nl-cover">
          <img src={cover} alt="" />
        </ItemLink>
      ) : null}
      <div className="sy-nl-t">
        <div className="sy-nl-top">
          <ScoreBadge item={item} />
          <CategoryBadge item={item} />
          <MatchChip item={item} interests={context.interests} />
        </div>
        <ItemLink item={item} className={`sy-lead-t ${big ? 'lg' : ''} c${big ? 2 : 3}`.trim()}>
          {item.title}
        </ItemLink>
        {big && item.reason ? <div className="sy-reason c2">{item.reason}</div> : null}
        <span className="meta c1" style={{ whiteSpace: 'normal' }}>
          {item.origin ?? ''} · {relTime(item.publishedAt)}
        </span>
      </div>
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function NewsCard({ item, context }: { item: FeedItem; context: WidgetRenderContext }) {
  return (
    <div className={`sy-ncard${item.state?.seen ? ' sy-seen' : ''}`}>
      <div className="sy-nl-top">
        <ScoreBadge item={item} />
        <CategoryBadge item={item} />
        <MatchChip item={item} interests={context.interests} />
      </div>
      <ItemLink item={item} className="sy-lead-t c3">
        {item.title}
      </ItemLink>
      {item.reason ? <div className="sy-reason-plain c4">{item.reason}</div> : null}
      <span className="meta c1 foot" style={{ whiteSpace: 'normal' }}>
        {item.origin ?? ''} · {relTime(item.publishedAt)}
      </span>
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function RankRow({ item, index, max }: { item: FeedItem; index: number; max: number }) {
  return (
    <div className={`sy-row sy-rk-row${item.state?.seen ? ' sy-seen' : ''}`}>
      <span className={`sy-rk-n${index < 3 ? ' top' : ''}`}>{item.metrics?.rank ?? index + 1}</span>
      <ItemLink item={item} className="grow c1 tt">
        {item.title}
      </ItemLink>
      {item.metrics?.signalCount ? (
        <span className="sy-heat" title={item.origin ?? ''}>
          <i style={{ width: `${Math.round((item.metrics.signalCount / max) * 100)}%` }} />
        </span>
      ) : null}
    </div>
  )
}

function ProdRow({ item, context }: { item: FeedItem; context: WidgetRenderContext }) {
  return (
    <div className="sy-row">
      <MonoTile name={item.title} />
      <ItemLink item={item} className="sy-it-a">
        <span className="tt c1">{item.title}</span>
        <span className="meta c1" style={{ whiteSpace: 'normal' }}>
          {item.summary ?? ''}
        </span>
      </ItemLink>
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function ProdCard({ item, context }: { item: FeedItem; context: WidgetRenderContext }) {
  return (
    <div className="sy-ncard">
      <MonoTile name={item.title} />
      <ItemLink item={item} className="sy-lead-t c1">
        {item.title}
      </ItemLink>
      <div className="meta c3" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
        {item.summary ?? ''}
      </div>
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function PaperRow({
  item,
  index,
  withSummary,
  context,
}: {
  item: FeedItem
  index: number
  withSummary: boolean
  context: WidgetRenderContext
}) {
  return (
    <div className={`sy-row sy-pr${item.state?.seen ? ' sy-seen' : ''}`}>
      <span className="sy-rk-n">{index}</span>
      <ItemLink item={item} className="sy-it-a">
        <span className="tt c1">{item.title}</span>
        {withSummary ? (
          <span className="meta c1" style={{ whiteSpace: 'normal' }}>
            {item.tldr || authorsLine(item)}
          </span>
        ) : null}
      </ItemLink>
      <MatchChip item={item} interests={context.interests} />
      <UpvotesBadge item={item} />
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function PaperLead({ item, context }: { item: FeedItem; context: WidgetRenderContext }) {
  const cover = coverOf(item)
  return (
    <div className="sy-lead sy-pl">
      {cover ? (
        <ItemLink item={item} className="sy-pl-fig">
          <img src={cover} alt="论文配图" />
        </ItemLink>
      ) : null}
      <div className="sy-pl-t">
        <div className="sy-nl-top">
          <span className="mono-l">#1 今日</span>
          <UpvotesBadge item={item} />
          <span className="meta">
            {item.metrics?.comments ?? 0} 条讨论 · {authorsLine(item)}
          </span>
        </div>
        <ItemLink item={item} className="sy-lead-t lg c2">
          {item.title}
        </ItemLink>
        {item.tldr ? <div className="sy-tldr c2">{item.tldr}</div> : null}
        <KeywordChips item={item} count={4} interests={context.interests} />
        <PaperLinks item={item} />
      </div>
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function PaperCard({
  item,
  index,
  context,
}: {
  item: FeedItem
  index: number
  context: WidgetRenderContext
}) {
  return (
    <div className="sy-ncard">
      <div className="sy-nl-top">
        <span className="mono-l">#{index + 1}</span>
        <UpvotesBadge item={item} />
        <span className="meta">{item.metrics?.comments ?? 0} 条讨论</span>
      </div>
      <ItemLink item={item} className="sy-lead-t c2">
        {item.title}
      </ItemLink>
      <div className="sy-reason-plain c4">{item.tldr || item.summary}</div>
      <div className="foot">
        <KeywordChips item={item} count={3} interests={context.interests} />
      </div>
      <ItemActions item={item} saved={context.saved.has(item.id)} />
    </div>
  )
}

function VideoImg({ item }: { item: FeedItem }) {
  const cover = coverOf(item)
  if (cover) return <img src={cover} alt="" loading="lazy" />
  return (
    <div className="sy-gen" style={{ '--c': 'var(--sy-t-subscription)' } as React.CSSProperties}>
      {item.sourceLabel ?? ''}
    </div>
  )
}

function VideoThumb({ item, className = '' }: { item: FeedItem; className?: string }) {
  return (
    <ItemLink item={item} className={`sy-vt ${className}`.trim()}>
      <VideoImg item={item} />
      <span className="sy-vplay">
        <SvgIcon svg={I.play} />
      </span>
      {item.metrics?.views ? <span className="sy-vbadge">{fmtCount(item.metrics.views)} 次观看</span> : null}
    </ItemLink>
  )
}

function ShortCard({ item }: { item: FeedItem }) {
  return (
    <ItemLink item={item} className="sy-s916">
      <VideoImg item={item} />
      <span>
        <em className="c2">{item.title}</em>
        <b>{fmtCount(item.metrics?.views ?? 0)} 次观看</b>
      </span>
    </ItemLink>
  )
}

function EpisodeCard({ item }: { item: FeedItem }) {
  return (
    <ItemLink item={item} className="sy-ep">
      <VideoImg item={item} />
      <span className="sy-vplay">
        <SvgIcon svg={I.play} />
      </span>
      <span className="sy-ep-t">
        <span className="mono-l">{isShort(item) ? 'SHORTS' : '最新节目'}</span>
        <b className="c2">{item.title}</b>
        <span>{videoMeta(item)}</span>
      </span>
    </ItemLink>
  )
}

function CategoryTabs({ widget, context }: { widget: WidgetRecord; context: WidgetRenderContext }) {
  const settings = (widget.settings ?? {}) as Partial<SubscriptionWidgetSettings>
  const all = subItemsOf({ ...widget, settings: { ...settings, cat: null } }, context.items, context.interests)
  const present = [...new Set(all.map((item) => item.category).filter((v): v is string => Boolean(categoryLabel(v))))]
  if (present.length < 2) return null
  const current = settings.cat ?? ''
  const tabs: Array<[string, string, number]> = [
    ['', '全部', all.length],
    ...present.map((v): [string, string, number] => [
      v,
      categoryLabel(v) ?? v,
      all.filter((item) => item.category === v).length,
    ]),
  ]
  return (
    <div className="sy-tabs" role="tablist">
      {tabs.map(([key, label, count]) => (
        <button
          key={key}
          role="tab"
          data-act="sub-cat"
          data-w={widget.id}
          data-v={key}
          aria-pressed={current === key}
        >
          {label}
          <span>{count}</span>
        </button>
      ))}
    </div>
  )
}

function SubscriptionDeck({
  widget,
  size,
  items,
  context,
}: {
  widget: WidgetRecord
  size: WidgetSize
  items: readonly FeedItem[]
  context: WidgetRenderContext
}) {
  const list = items.slice(0, DECK_SIZE)
  const settings = (widget.settings ?? {}) as Partial<SubscriptionWidgetSettings>
  const vertical = size === 'S'
  const max = heatMax(list)
  if (list.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }

  const index = context.deckIndex[widget.id] ?? 0
  const flipped = Boolean(context.deckFlipped[widget.id])
  const at = Math.min(index, list.length - 1)
  const big = size !== 'M'

  return (
    <div
      className={`sy-deck${vertical ? ' v' : ''}`}
      data-deck={widget.id}
      tabIndex={0}
      role="group"
      aria-roledescription="卡片流"
      aria-label={`${widgetTitle(widget, context)}，左右方向键切换`}
    >
      {vertical ? (
        <div className="sy-s-lab" style={{ marginBottom: 8 }}>
          <WidgetIcon type="subscription" size={16} />
          {widgetTitle(widget, context)}
        </div>
      ) : null}
      {vertical ? (
        <div className={`sy-segs${settings.auto ? ' auto' : ''}`}>
          {list.map((_, i) => (
            <i key={i} className={i < at ? 'done' : i === at ? 'run' : ''} />
          ))}
        </div>
      ) : null}
      <div className="sy-dk-stage">
        {list.map((item, position) => {
          const pos =
            position < at
              ? 'past'
              : position === at
                ? 'cur'
                : position === at + 1
                  ? 'n1'
                  : position === at + 2
                    ? 'n2'
                    : 'hide'
          if (settings.pres === '论文') {
            return (
              <article
                key={item.id}
                data-pos={pos}
                className={`sy-dk-card paper${flipped ? ' flipped' : ''}`}
                data-k={position}
                data-item={item.id}
              >
                <div className="sy-flip">
                  <div className="face front">
                    <div className="sy-dk-art paper" />
                    <div className="sy-dk-big">#{position + 1}</div>
                    <div className="sy-dk-in">
                      <div className="sy-dk-top">
                        <span className="sy-dk-src">HF 论文 · #{position + 1}</span>
                        <UpvotesBadge item={item} />
                        <span className="sy-dk-time">{item.metrics?.comments ?? 0} 条讨论</span>
                      </div>
                      <div className="sy-dk-main">
                        <ItemLink item={item} className="sy-dk-title c2">
                          {item.title}
                        </ItemLink>
                        {item.tldr ? <p className="sy-dk-sum tl c3">{item.tldr}</p> : null}
                        {big ? <KeywordChips item={item} count={4} interests={context.interests} /> : null}
                        {big ? (
                          <span className="sy-dk-hint">
                            <SvgIcon svg={I.reset} /> 点卡片翻面看摘要
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="face back">
                    <div className="sy-dk-in">
                      <div className="sy-dk-top">
                        <span className="sy-dk-src">摘要</span>
                        <span className="grow" />
                        <span className="sy-dk-time">{authorsLine(item)}</span>
                      </div>
                      <p className="sy-dk-abs c8">{item.summary || item.tldr || ''}</p>
                      {big ? <PaperLinks item={item} /> : null}
                    </div>
                  </div>
                </div>
              </article>
            )
          }
          if (vertical || settings.pres === '榜单') {
            return (
              <article
                key={item.id}
                data-pos={pos}
                className="sy-dk-card hot"
                data-k={position}
                data-item={item.id}
              >
                <div className="sy-dk-in">
                  <div className="sy-hot-l">
                    <span className="sy-hot-n">{item.metrics?.rank ?? position + 1}</span>
                    <span className="sy-dk-time">{relTime(item.publishedAt)}</span>
                  </div>
                  <ItemLink item={item} className="sy-dk-title c3">
                    {item.title}
                  </ItemLink>
                  <div className="sy-hot-m">
                    <span className="sy-heat wide">
                      <i style={{ width: `${Math.round(((item.metrics?.signalCount ?? 0) / max) * 100)}%` }} />
                    </span>
                    <span>{item.origin ?? ''}</span>
                  </div>
                </div>
              </article>
            )
          }
          const cover = coverOf(item)
          const colour = (item.category ? CATEGORY_COLOUR[item.category] : undefined) ?? 'var(--sy-t-subscription)'
          return (
            <article
              key={item.id}
              data-pos={pos}
              className={`sy-dk-card news${cover ? ' sy-on-photo' : ''}`}
              data-k={position}
              data-item={item.id}
              style={{ '--c': colour } as React.CSSProperties}
            >
              {cover ? (
                <div className="sy-dk-bg">
                  <img src={cover} alt="" />
                </div>
              ) : (
                <>
                  <div className="sy-dk-art" />
                  {typeof item.score === 'number' ? <div className="sy-dk-big">{item.score}</div> : null}
                </>
              )}
              <div className="sy-dk-in">
                <div className="sy-dk-top">
                  <span className="sy-dk-src">{item.sourceLabel ?? ''}</span>
                  <CategoryBadge item={item} />
                  <MatchChip item={item} interests={context.interests} />
                  <span className="grow" />
                  <span className="sy-dk-time">{relTime(item.publishedAt)}</span>
                </div>
                <div className="sy-dk-main">
                  {big && cover ? <ScoreBadge item={item} /> : null}
                  <ItemLink item={item} className={`sy-dk-title c2${big ? ' lg' : ''}`}>
                    {item.title}
                  </ItemLink>
                  {big && item.reason ? <p className="sy-dk-sum c2">{item.reason}</p> : null}
                  {big ? <span className="sy-dk-meta c1">{item.origin ?? ''}</span> : null}
                </div>
              </div>
            </article>
          )
        })}
        {size === 'M' ? (
          <>
            <button className="sy-dk-arrow l" data-act="dk-prev" data-w={widget.id} aria-label="上一条">
              ‹
            </button>
            <button className="sy-dk-arrow r" data-act="dk-next" data-w={widget.id} aria-label="下一条">
              ›
            </button>
          </>
        ) : null}
      </div>
      {size === 'L' || size === 'Wide' ? (
        <div className="sy-ctl">
          <button className="sy-nav" data-act="dk-prev" data-w={widget.id} aria-label="上一条">
            ‹
          </button>
          <div className="sy-dots">
            {list.map((_, i) => (
              <i key={i} className={i === at ? 'on' : i < at ? 'done' : ''} />
            ))}
          </div>
          <button className="sy-nav" data-act="dk-next" data-w={widget.id} aria-label="下一条">
            ›
          </button>
          <span className="sy-tip">拖动卡片：右滑稍后读，左滑跳过</span>
          <span className="grow" />
          {settings.pres === '论文' ? (
            <button className="sy-dk-b" data-act="dk-flip" data-w={widget.id}>
              <SvgIcon svg={I.reset} />
              翻面
            </button>
          ) : (
            <button className="sy-dk-b" data-act="dk-task" data-w={widget.id}>
              <SvgIcon svg={I.toTask} />
              转为任务
            </button>
          )}
          <button className="sy-dk-b pri" data-act="dk-later" data-w={widget.id}>
            <SvgIcon svg={I.bookmark} />
            稍后读
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function SubscriptionWidget({
  widget,
  size,
  settings,
  context,
}: WidgetRendererProps<SubscriptionWidgetSettings>) {
  const items = subItemsOf(widget, context.items, context.interests)
  const pres = settings?.pres ?? '图文'
  const title = widgetTitle(widget, context)

  if (settings?.deck) {
    return (
      <SubscriptionDeck
        widget={{ ...widget, settings: { ...settings, pres } }}
        size={size}
        items={items}
        context={context}
      />
    )
  }

  if (items.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }

  const max = heatMax(items)

  if (pres === '视频') {
    const episodes = items.filter((item) => !isShort(item))
    const shorts = items.filter(isShort)
    const lead = (episodes[0] ?? items[0])!
    const rest = shorts.filter((item) => item !== lead)
    if (size === 'S') {
      return (
        <>
          <div className="sy-s-lab">
            {isShort(lead) ? 'Shorts' : '最新节目'} · {title}
          </div>
          <div>
            <ItemLink item={lead} className="sy-s-title c2">
              {lead.title}
            </ItemLink>
            <div className="meta" style={{ marginTop: 4 }}>
              {videoMeta(lead)}
            </div>
          </div>
          <ItemActions item={lead} saved={context.saved.has(lead.id)} />
        </>
      )
    }
    const description = cleanDesc(lead.description || lead.summary)
    if (size === 'M') {
      return (
        <div className="sy-vm">
          <VideoThumb item={lead} />
          <div className="sy-vm-t">
            <span className="mono-l">
              {isShort(lead) ? 'SHORTS' : '最新节目'} · {lead.origin ?? ''}
            </span>
            <ItemLink item={lead} className="sy-lead-t c2">
              {lead.title}
            </ItemLink>
            <span className="meta">{videoMeta(lead)}</span>
            {rest.length ? <span className="meta">还有 {rest.length} 条 Shorts</span> : null}
          </div>
        </div>
      )
    }
    if (size === 'Wide') {
      return (
        <div className="sy-fit-x sy-reel">
          <EpisodeCard item={lead} />
          {rest.map((item) => (
            <ShortCard key={item.id} item={item} />
          ))}
        </div>
      )
    }
    return (
      <div className="sy-vL">
        <div className="sy-vL-ep">
          <VideoThumb item={lead} />
          <div className="sy-vm-t" style={{ justifyContent: 'flex-start' }}>
            <span className="mono-l">
              {isShort(lead) ? 'SHORTS' : '最新节目'} · {relTime(lead.publishedAt)}
            </span>
            <ItemLink item={lead} className="sy-lead-t c2">
              {lead.title}
            </ItemLink>
            {description ? <div className="sy-reason-plain c2">{description}</div> : null}
          </div>
        </div>
        {rest.length ? (
          <div className="sy-vL-sh">
            <div className="sy-agenda-h" style={{ paddingTop: 0 }}>
              SHORTS · {rest.length}
            </div>
            <div className="sy-fit sy-reel2">
              {rest.map((item) => (
                <ShortCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (pres === '论文') {
    const lead = items[0]!
    if (size === 'S') {
      return (
        <>
          <div className="sy-s-lab">{title} · #1</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <UpvotesBadge item={lead} className="big" />
            <ItemLink item={lead} className="sy-s-title c3">
              {lead.title}
            </ItemLink>
          </div>
          <KeywordChips item={lead} count={2} interests={context.interests} />
        </>
      )
    }
    if (size === 'M') {
      return (
        <div className="sy-m-split">
          <div className="sy-lead">
            <div className="sy-nl-top">
              <span className="mono-l">#1 今日</span>
              <UpvotesBadge item={lead} />
            </div>
            <ItemLink item={lead} className="sy-lead-t c2">
              {lead.title}
            </ItemLink>
            {lead.tldr ? (
              <div className="meta c2" style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>
                {lead.tldr}
              </div>
            ) : null}
            <ItemActions item={lead} saved={context.saved.has(lead.id)} />
          </div>
          <div className="sy-list sy-fit">
            {items.slice(1, 6).map((item, idx) => (
              <PaperRow key={item.id} item={item} index={idx + 2} withSummary={false} context={context} />
            ))}
          </div>
        </div>
      )
    }
    if (size === 'Wide') {
      return (
        <div className="sy-fit-x" style={{ gap: 12 }}>
          {items.slice(0, 8).map((item, idx) => (
            <PaperCard key={item.id} item={item} index={idx} context={context} />
          ))}
        </div>
      )
    }
    return (
      <>
        <PaperLead item={lead} context={context} />
        <div className="sy-list sy-fit">
          {items.slice(1, 8).map((item, idx) => (
            <PaperRow key={item.id} item={item} index={idx + 2} withSummary={true} context={context} />
          ))}
        </div>
      </>
    )
  }

  if (pres === '榜单') {
    if (size === 'S') {
      return (
        <>
          <div className="sy-s-lab">
            <WidgetIcon type="subscription" size={16} />
            {title}
          </div>
          <div className="sy-list sy-fit" style={{ marginTop: 8 }}>
            {items.slice(0, 5).map((item, idx) => (
              <RankRow key={item.id} item={item} index={idx} max={max} />
            ))}
          </div>
        </>
      )
    }
    if (size === 'M') {
      return (
        <div className="sy-grid2 r3">
          {items.slice(0, 6).map((item, idx) => (
            <RankRow key={item.id} item={item} index={idx} max={max} />
          ))}
        </div>
      )
    }
    if (size === 'Wide') {
      return (
        <div
          className="sy-grid2 r3"
          style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gridTemplateRows: 'repeat(4,auto)' }}
        >
          {items.slice(0, 12).map((item, idx) => (
            <RankRow key={item.id} item={item} index={idx} max={max} />
          ))}
        </div>
      )
    }
    return (
      <div className="sy-list sy-fit">
        {items.slice(0, 10).map((item, idx) => (
          <RankRow key={item.id} item={item} index={idx} max={max} />
        ))}
      </div>
    )
  }

  if (pres === '产品') {
    const lead = items[0]!
    if (size === 'S') {
      return (
        <>
          <div className="sy-s-lab">{title}</div>
          <div className="sy-s-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MonoTile name={lead.title} />
            <ItemLink item={lead} className="sy-s-title c1">
              {lead.title}
            </ItemLink>
            <div className="meta c2" style={{ whiteSpace: 'normal' }}>
              {lead.summary ?? ''}
            </div>
          </div>
        </>
      )
    }
    if (size === 'M') {
      return (
        <div className="sy-grid2" style={{ rowGap: 4 }}>
          {items.slice(0, 4).map((item) => (
            <ProdRow key={item.id} item={item} context={context} />
          ))}
        </div>
      )
    }
    if (size === 'Wide') {
      return (
        <div className="sy-fit-x" style={{ gap: 12 }}>
          {items.slice(0, 8).map((item) => (
            <ProdCard key={item.id} item={item} context={context} />
          ))}
        </div>
      )
    }
    return (
      <div className="sy-list sy-fit">
        {items.slice(0, 9).map((item) => (
          <ProdRow key={item.id} item={item} context={context} />
        ))}
      </div>
    )
  }

  // 图文
  const lead = items[0]!
  if (size === 'S') {
    if (coverOf(lead)) {
      return (
        <>
          <div className="sy-s-lab">{title}</div>
          <div>
            <ItemLink item={lead} className="sy-s-title c3">
              {lead.title}
            </ItemLink>
            <div className="meta" style={{ marginTop: 4 }}>
              {metaLine(lead)}
            </div>
          </div>
          <ItemActions item={lead} saved={context.saved.has(lead.id)} />
        </>
      )
    }
    return (
      <>
        <div className="sy-s-lab">{title}</div>
        <div className="sy-s-narrow">
          <div className="sy-nl-top" style={{ marginBottom: 6 }}>
            <ScoreBadge item={lead} />
            <MatchChip item={lead} interests={context.interests} />
          </div>
          <ItemLink item={lead} className="sy-s-title c3">
            {lead.title}
          </ItemLink>
        </div>
        <div className="meta">{relTime(lead.publishedAt)}</div>
      </>
    )
  }
  if (size === 'M') {
    return (
      <div className="sy-m-split">
        <NewsLead item={lead} context={context} big={false} />
        <div className="sy-list sy-fit">
          {items.slice(1, 6).map((item) => (
            <NewsRow key={item.id} item={item} context={context} />
          ))}
        </div>
      </div>
    )
  }
  if (size === 'Wide') {
    return (
      <div className="sy-fit-x" style={{ gap: 12 }}>
        {items.slice(0, 8).map((item) => (
          <NewsCard key={item.id} item={item} context={context} />
        ))}
      </div>
    )
  }
  return (
    <>
      <CategoryTabs widget={widget} context={context} />
      <NewsLead item={lead} context={context} big={true} />
      <div className="sy-list sy-fit">
        {items.slice(1, 10).map((item) => (
          <NewsRow key={item.id} item={item} context={context} />
        ))}
      </div>
    </>
  )
}

export const subscriptionWidgetDefinition: WidgetDefinition<SubscriptionWidgetSettings> = {
  type: 'subscription',
  name: '订阅',
  desc: '一个或多个来源的最新内容',
  priority: 'P0',
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4], Wide: [12, 3] },
  defaultSize: 'M',
  actions: ['稍后读', '转为任务', '打开原文'],
  defaultSettings: () => ({
    sources: ['aihot'],
    pres: '图文',
    sort: 'new',
    deck: false,
    auto: false,
    cat: null,
  }),
  normalizeSettings: (raw) => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const sources =
      Array.isArray(obj.sources) && obj.sources.length > 0 ? obj.sources.map(String) : ['aihot']
    const pres = (['图文', '榜单', '论文', '产品', '视频'] as const).includes(obj.pres as any)
      ? (obj.pres as SubscriptionWidgetSettings['pres'])
      : '图文'
    const sort = (['match', 'new', 'score', 'rank'] as const).includes(obj.sort as any)
      ? (obj.sort as SubscriptionWidgetSettings['sort'])
      : 'new'
    return {
      sources,
      pres,
      sort,
      deck: Boolean(obj.deck),
      auto: Boolean(obj.auto),
      cat: typeof obj.cat === 'string' && obj.cat ? obj.cat : null,
    }
  },
  Component: SubscriptionWidget,
  computeLayoutMeta: ({ widget, size, settings, context }) => {
    const items = subItemsOf(widget, context.items, context.interests)
    const pres = settings?.pres ?? '图文'
    const matches = items.filter((item) => matchOf(item, context.interests)).length
    const sub = `${items.length} 条${matches ? ` · ${matches} 条命中关注` : ''}`

    if (settings?.deck) {
      const vertical = size === 'S'
      const list = items.slice(0, DECK_SIZE)
      if (list.length === 0) return { sub, noHeader: vertical }
      return { sub, noHeader: vertical, cls: ' sy-w-deck' }
    }
    if (items.length === 0) return { sub: '空' }

    if (pres === '视频') {
      const episodes = items.filter((item) => !isShort(item))
      const lead = (episodes[0] ?? items[0])!
      if (size === 'S') {
        const cover = coverOf(lead)
        return {
          cls: cover ? 'sy-w--photo' : '',
          bg: cover ? (
            <div className="bgimg">
              <img src={cover} alt="" />
            </div>
          ) : undefined,
        }
      }
      return { sub }
    }
    if (pres === '产品') {
      if (size === 'S') return { deco: 'subscription' }
      return { sub }
    }
    if (pres === '论文' || pres === '榜单') {
      if (size === 'S') return {}
      return { sub }
    }
    // 图文
    const lead = items[0]!
    if (size === 'S') {
      const cover = coverOf(lead)
      if (cover) {
        return {
          cls: 'sy-w--photo',
          bg: (
            <div className="bgimg">
              <img src={cover} alt="" />
            </div>
          ),
        }
      }
      return { deco: 'subscription' }
    }
    return { sub }
  },
}
