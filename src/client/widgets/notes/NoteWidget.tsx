import * as React from 'react'
import { EmptyWidgetState, I, SvgIcon, relTime, safeUrl } from '../shared.tsx'
import type { NoteWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

export function NoteWidget({ widget, size, context }: WidgetRendererProps<NoteWidgetSettings>) {
  const notes = context.notes ?? []
  if (notes.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }
  if (size === 'S') {
    const first = notes[0]!
    return (
      <>
        <div className="sy-s-lab">随手记</div>
        <div className="sy-s-main">
          <div className="sy-s-big">{notes.length}</div>
          <div className="sy-s-sub">条笔记</div>
        </div>
        <div className="sy-s-narrow">
          <span className="c1" style={{ fontSize: 13 }}>
            {first.text}
          </span>
        </div>
      </>
    )
  }
  return (
    <div className="sy-list sy-fit" style={{ gap: 4 }}>
      {notes.slice(0, size === 'L' ? 10 : 5).map((note) => (
        <div key={note.id} className="sy-row">
          <span className="sy-kind note">Note</span>
          <span className="c1 grow" style={{ fontSize: 13.5 }}>
            {note.text}
          </span>
          {note.origin?.url ? (
            <a
              className="sy-chip"
              href={safeUrl(note.origin.url)}
              target="_blank"
              rel="noopener noreferrer"
              title={`来自 ${note.origin.source ?? ''}`}
            >
              {note.origin.source ?? '原文'}
            </a>
          ) : null}
          <span className="meta">{relTime(note.createdAt)}</span>
          <button className="sy-mini" data-act="note-remove" data-note={note.id} aria-label="删除" title="删除">
            <SvgIcon svg={I.x} />
          </button>
        </div>
      ))}
    </div>
  )
}

export const noteWidgetDefinition: WidgetDefinition<NoteWidgetSettings> = {
  type: 'notes',
  name: '笔记',
  desc: '你存下来的随手记与阅读摘录',
  priority: 'P1',
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: 'M',
  actions: ['查看笔记', '删除笔记'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: NoteWidget,
  computeLayoutMeta: ({ context }) => ({
    sub: context.notes.length ? `${context.notes.length} 条` : '空',
  }),
}
