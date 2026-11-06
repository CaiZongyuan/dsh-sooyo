import * as React from 'react'
import { WidgetFrame } from './WidgetFrame.tsx'
import type { PackedPosition } from '../layout/bento-packer.ts'
import type { GridColumns, LayoutEntry, WidgetRecord } from '../../shared/domain.ts'
import type { WidgetRenderContext } from '../../shared/widget.ts'

export interface WidgetGridProps {
  gridRef: React.RefObject<HTMLDivElement | null>
  cols: GridColumns
  layout: readonly LayoutEntry[]
  widgets: Record<string, WidgetRecord>
  positions: Record<string, PackedPosition>
  context: WidgetRenderContext
}

export function WidgetGrid({ gridRef, cols, layout, widgets, positions, context }: WidgetGridProps) {
  return (
    <div
      className="sy-grid"
      ref={gridRef}
      style={{ '--cols': cols } as React.CSSProperties}
    >
      {layout.map((entry) => {
        const widget = widgets[entry.id]
        const position = positions[entry.id]
        if (!widget || !position) return null
        return (
          <WidgetFrame
            key={entry.id}
            widget={widget}
            size={entry.size}
            position={position}
            context={context}
          />
        )
      })}
      {layout.length === 0 ? (
        <div className="sy-grid-empty">
          <div>
            <b style={{ fontSize: 16, color: 'var(--sy-ink)', display: 'block' }}>这个 Board 还是空的</b>
            <div className="meta" style={{ marginTop: 4, whiteSpace: 'normal' }}>
              从 Widget 库里挑几个。
            </div>
          </div>
          <div className="row-btns">
            <button className="sy-btn sy-btn-ink" data-act="gallery-open">
              添加 Widget
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
