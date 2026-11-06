import * as React from 'react'
import { I, SvgIcon, relTime } from '../shared.tsx'
import type { CaptureWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

export function CaptureWidget({ widget, size, context }: WidgetRendererProps<CaptureWidgetSettings>) {
  const form = (
    <form className="sy-cap" data-form="capture" data-w={widget.id}>
      <input name="t" placeholder="记下一个想法…" autoComplete="off" aria-label="快速记录" />
      <kbd>↵</kbd>
    </form>
  )
  const hint = (
    <div className="sy-cap-hint">
      回车存进收件箱 · 以 <code>#note</code> 开头存为 Note
    </div>
  )
  const recent = context.notes.slice(0, 6).map((note) => (
    <div key={note.id} className="sy-row" style={{ minHeight: 28 }}>
      <span className="sy-kind note">Note</span>
      <span className="c1 grow" style={{ fontSize: 13 }}>
        {note.text}
      </span>
      <span className="meta">{relTime(note.createdAt)}</span>
      <button className="sy-mini" data-act="note-remove" data-note={note.id} aria-label="删除" title="删除">
        <SvgIcon svg={I.x} />
      </button>
    </div>
  ))

  if (size === 'Wide') {
    return (
      <div className="sy-cap-wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form}
          {hint}
        </div>
        <div className="sy-list sy-fit" style={{ alignSelf: 'stretch' }}>
          {recent}
        </div>
      </div>
    )
  }

  return (
    <>
      {form}
      <div className="sy-list sy-fit">{recent}</div>
    </>
  )
}

export const captureWidgetDefinition: WidgetDefinition<CaptureWidgetSettings> = {
  type: 'capture',
  name: '快速记录',
  desc: '一行记下想法，回车存进收件箱',
  priority: 'P0',
  sizes: { M: [6, 2], Wide: [12, 2] },
  defaultSize: 'M',
  actions: ['记一条任务', '记一条 Note'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: CaptureWidget,
  computeLayoutMeta: ({ context }) => {
    const inbox = context.tasks.filter((task) => task.list === 'inbox').length
    return { sub: `收件箱 ${inbox}` }
  },
}
