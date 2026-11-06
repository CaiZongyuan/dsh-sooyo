import * as React from 'react'
import { EmptyWidgetState, I, ItemLink, SvgIcon, ThumbBox, relTime } from '../shared.tsx'
import type { FeedItem, ReadLaterWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

function resolveReadLaterItems(context: WidgetRendererProps['context']): FeedItem[] {
  return context.readLater
    .map((id) => context.byId.get(id) ?? context.readLaterEntries?.[id])
    .filter((item): item is FeedItem => Boolean(item))
}

function ReadLaterActions({ item }: { item: FeedItem }) {
  return (
    <span className="sy-acts">
      <button data-act="rl-note" data-item={item.id} title="转为 Note" aria-label="转为 Note">
        <SvgIcon svg={I.note} />
      </button>
      <button data-act="item-task" data-item={item.id} title="转为任务" aria-label="转为任务">
        <SvgIcon svg={I.toTask} />
      </button>
      <button data-act="item-later" data-item={item.id} data-off="1" title="移出稍后读" aria-label="移出稍后读">
        <SvgIcon svg={I.x} />
      </button>
    </span>
  )
}

export function ReadLaterWidget({ widget, size, context }: WidgetRendererProps<ReadLaterWidgetSettings>) {
  const items = resolveReadLaterItems(context)
  if (items.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }
  const first = items[0]!
  if (size === 'S') {
    return (
      <>
        <div className="sy-s-lab">稍后读</div>
        <div className="sy-s-main">
          <div className="sy-s-big">{items.length}</div>
          <div className="sy-s-sub">篇等你读</div>
        </div>
        <div className="sy-s-narrow">
          <ItemLink item={first} className="c1">
            <span style={{ fontSize: 13 }}>{first.title}</span>
          </ItemLink>
        </div>
      </>
    )
  }

  if (size === 'M') {
    return (
      <div className="sy-list sy-fit">
        {items.map((item) => (
          <div key={item.id} className="sy-row">
            <ItemLink item={item} className="sy-it-a">
              <span className="tt c1">{item.title}</span>
              <span className="meta">
                {item.sourceLabel ?? ''} · {relTime(item.publishedAt)}
              </span>
            </ItemLink>
            <ReadLaterActions item={item} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="sy-list sy-fit" style={{ gap: 3 }}>
        {items.map((item) => (
          <div key={item.id} className="sy-row" style={{ gap: 12 }}>
            <div className="sy-thumb" style={{ width: 68, height: 42 }}>
              <ThumbBox item={item} label={item.sourceLabel ?? undefined} />
            </div>
            <ItemLink item={item} className="sy-it-a">
              <span className="tt c2">{item.title}</span>
              <span className="meta">
                {item.sourceLabel ?? ''} · {relTime(item.publishedAt)}
              </span>
            </ItemLink>
            <ReadLaterActions item={item} />
          </div>
        ))}
      </div>
      <div className="meta" style={{ flex: 'none' }}>
        在订阅里点书签图标，文章就会存到这里
      </div>
    </>
  )
}

export const readLaterWidgetDefinition: WidgetDefinition<ReadLaterWidgetSettings> = {
  type: 'readlater',
  name: '稍后读',
  desc: '存下来、晚点再读的文章',
  priority: 'P0',
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: 'M',
  actions: ['转为 Note', '转为任务', '移出'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: ReadLaterWidget,
  computeLayoutMeta: ({ size, context }) => {
    const items = resolveReadLaterItems(context)
    if (items.length === 0) return { sub: '空' }
    if (size === 'S') return { deco: 'ill-readlater' }
    return { sub: `${items.length} 篇` }
  },
}
