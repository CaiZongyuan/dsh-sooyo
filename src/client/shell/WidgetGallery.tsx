import * as React from 'react'
import { I, SvgIcon, WidgetIcon } from '../widgets/shared.tsx'
import { computeWidgetCardView } from './WidgetFrame.tsx'
import { GAP, ROW, sizeOrder } from '../layout/breakpoints.ts'
import type { Board, WidgetRecord, WidgetSize } from '../../shared/domain.ts'
import type { WidgetRenderContext } from '../../shared/widget.ts'

const { useState } = React

export interface GalleryModalState {
  kind: 'gallery'
  type: string
  size?: WidgetSize
  sources?: string[]
  pres?: string | null
}

export interface GallerySheetProps {
  initial: GalleryModalState
  types: Record<string, any>
  context: WidgetRenderContext
  board: Board | null
  onAdd: (type: string, size: WidgetSize, settings: Record<string, unknown>, title?: string) => void
  onClose: () => void
}

export function GallerySheet({ initial, types, context, board, onAdd, onClose }: GallerySheetProps) {
  const [type, setType] = useState<string>(types[initial.type] ? initial.type : 'subscription')
  const [size, setSize] = useState<WidgetSize>(initial.size ?? 'M')
  const [sources, setSources] = useState<string[]>(initial.sources ?? ['aihot'])
  const [pres, setPres] = useState<string | null>(initial.pres ?? null)

  const definition = types[type] ?? { name: type, desc: '', sizes: {}, actions: [] }
  const available = sizeOrder.filter((entry) => definition.sizes?.[entry])
  const activeSize: WidgetSize = available.includes(size) ? size : (available[0] ?? 'M')

  const suggested =
    pres ?? context.sources.find((source) => source.id === sources[0])?.suggests?.pres ?? '图文'
  const settings =
    type === 'subscription'
      ? { sources, pres: suggested, sort: sources[0] === 'aihot-hot' ? 'rank' : 'new' }
      : {}
  const previewWidget: WidgetRecord = {
    id: 'preview',
    type,
    size: activeSize,
    settings,
    title: undefined,
  }
  const preview = computeWidgetCardView(previewWidget, activeSize, context, { preview: true })

  const [gridCols, gridRows] = (definition.sizes?.[activeSize] as [number, number] | undefined) ?? [3, 2]
  const previewWidth = gridCols * 68 + (gridCols - 1) * GAP
  const previewHeight = gridRows * ROW + (gridRows - 1) * GAP
  const scale = Math.min(0.9, 440 / previewWidth, 230 / previewHeight)

  const groups: ReadonlyArray<readonly [string, string]> = [
    ['P0', '常用'],
    ['P1', '更多'],
    ['P2', '即将推出'],
  ]

  return (
    <div className="sy-scrim" data-act="scrim">
      <div className="sy-sheet" role="dialog" aria-modal={true} aria-label="Widget 库">
        <header className="sy-sh-h">
          <h2>Widget 库</h2>
          <span className="meta">加到「{board?.name ?? ''}」</span>
          <button className="sy-icon-btn" data-act="modal-close" aria-label="关闭">
            <SvgIcon svg={I.x} />
          </button>
        </header>
        <div className="sy-gal">
          <div className="sy-gal-l">
            {groups.map(([priority, heading]) => (
              <React.Fragment key={priority}>
                <h3>{heading}</h3>
                {Object.entries(types)
                  .filter(([, value]) =>
                    priority === 'P2' ? value.soon : !value.soon && (value.pri ?? 'P0') === priority,
                  )
                  .map(([key, value]) => (
                    <button
                      key={key}
                      className="sy-gal-it"
                      aria-pressed={key === type}
                      onClick={() => {
                        setType(key)
                        const next = sizeOrder.filter((entry) => types[key]?.sizes?.[entry])
                        setSize((current) => (next.includes(current) ? current : (next[0] ?? 'M')))
                      }}
                    >
                      <WidgetIcon type={key} size={32} />
                      <span style={{ minWidth: 0 }}>
                        <b>{value.name}</b>
                        <small>{value.desc}</small>
                      </span>
                      {value.soon ? <span className="soon-b">SOON</span> : null}
                    </button>
                  ))}
              </React.Fragment>
            ))}
          </div>
          <div className="sy-gal-r">
            <div className="sy-pv">
              <div
                className="sy-pv-in"
                style={{ transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})` }}
              >
                <section className={preview.cls} style={{ width: previewWidth, height: previewHeight }}>
                  {preview.content}
                </section>
              </div>
              <span className="sy-pv-cap">
                {activeSize} · {gridCols}×{gridRows} 格（桌面）
              </span>
            </div>
            <div className="sy-gal-meta">
              <div className="sy-fld">
                <span>尺寸</span>
                <div className="sy-seg sm">
                  {sizeOrder.map((entry) => (
                    <button
                      key={entry}
                      aria-pressed={entry === activeSize}
                      disabled={!definition.sizes?.[entry]}
                      style={definition.sizes?.[entry] ? undefined : { opacity: 0.3, cursor: 'not-allowed' }}
                      onClick={() => setSize(entry)}
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </div>
              {type === 'subscription' ? (
                <div className="sy-fld">
                  <span>来源</span>
                  <div className="sy-chips">
                    {(context.sources ?? []).map((source) => (
                      <button
                        key={source.id}
                        className="sy-chipbtn"
                        aria-pressed={sources.includes(source.id)}
                        onClick={() => {
                          setPres(null)
                          setSources((current) =>
                            current.includes(source.id)
                              ? current.length > 1
                                ? current.filter((entry) => entry !== source.id)
                                : current
                              : [...current, source.id],
                          )
                        }}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {type === 'subscription' ? (
                <div className="sy-fld">
                  <span>呈现</span>
                  <div className="sy-seg sm">
                    {(['图文', '榜单', '论文', '产品', '视频'] as const).map((entry) => (
                      <button
                        key={entry}
                        aria-pressed={suggested === entry}
                        onClick={() => setPres(entry)}
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="sy-gal-acts">
              {(definition.actions ?? []).length
                ? `能直接做：${definition.actions.join(' · ')}`
                : '只展示，不需要操作。'}
            </div>
            <button
              className="sy-btn sy-btn-wide"
              disabled={Boolean(definition.soon)}
              onClick={() => {
                if (definition.soon) return
                onAdd(type, activeSize, type === 'subscription' ? { ...settings, deck: false } : {})
                onClose()
              }}
            >
              {definition.soon ? '即将推出' : `添加到「${board?.name ?? ''}」`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
