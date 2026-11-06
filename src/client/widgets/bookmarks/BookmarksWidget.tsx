import * as React from 'react'
import { EmptyWidgetState, MonoTile, safeUrl } from '../shared.tsx'
import type { BookmarksWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

export function BookmarksWidget({ widget, size, context }: WidgetRendererProps<BookmarksWidgetSettings>) {
  const rows = context.bookmarks ?? []
  if (rows.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }
  if (size === 'S') {
    return (
      <div className="sy-bm-s">
        {rows.slice(0, 6).map((entry) => (
          <a
            key={`${entry.name}:${entry.url}`}
            className="sy-bm-tile"
            href={safeUrl(entry.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MonoTile name={entry.name} />
            <span>{entry.name}</span>
          </a>
        ))}
      </div>
    )
  }
  const count = size === 'Wide' ? (context.cols >= 12 ? 12 : 8) : 8
  const columns = size === 'Wide' ? (context.cols >= 12 ? 6 : 4) : context.cols >= 6 ? 4 : 2
  const limit = context.cols <= 4 ? 4 : count
  return (
    <div className="sy-bm-grid" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
      {rows.slice(0, limit).map((entry) => (
        <a
          key={`${entry.name}:${entry.url}`}
          className="sy-bm-chip"
          href={safeUrl(entry.url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MonoTile name={entry.name} />
          <span>{entry.name}</span>
        </a>
      ))}
    </div>
  )
}

export const bookmarksWidgetDefinition: WidgetDefinition<BookmarksWidgetSettings> = {
  type: 'bookmarks',
  name: '书签',
  desc: '常去的网站一键直达',
  priority: 'P0',
  sizes: { S: [3, 2], M: [6, 2], Wide: [12, 2] },
  defaultSize: 'S',
  actions: ['打开链接'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: BookmarksWidget,
  computeLayoutMeta: ({ size, context }) => {
    const rows = context.bookmarks ?? []
    if (rows.length === 0 || size === 'S') return {}
    return { sub: `${rows.length} 个` }
  },
}
