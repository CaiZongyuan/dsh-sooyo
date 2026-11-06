import * as React from 'react'
import { I, SvgIcon, WidgetIcon, widgetTitle } from '../widgets/shared.tsx'
import { SUB_SORTS } from '../widgets/subscription/SubscriptionWidget.tsx'
import { GallerySheet, type GalleryModalState } from './WidgetGallery.tsx'
import type { Board, SubscriptionWidgetSettings, WidgetRecord, WidgetSize } from '../../shared/domain.ts'
import type { WidgetRenderContext } from '../../shared/widget.ts'

export interface SettingsModalState {
  kind: 'settings'
  id: string
}

export type ModalState = GalleryModalState | SettingsModalState

export interface ModalLayerProps {
  modal: ModalState
  widgets: Record<string, WidgetRecord>
  types: Record<string, any>
  context: WidgetRenderContext
  board: Board | null
  onClose: () => void
  onAdd: (type: string, size: WidgetSize, settings: Record<string, unknown>, title?: string) => void
  onRun: (name: string, body: Record<string, any>, options?: { toast?: string }) => Promise<any>
}

export function ModalLayer({
  modal,
  widgets,
  types,
  context,
  board,
  onClose,
  onAdd,
  onRun,
}: ModalLayerProps) {
  if (modal.kind === 'gallery') {
    return (
      <GallerySheet
        initial={modal}
        types={types}
        context={context}
        board={board}
        onAdd={onAdd}
        onClose={onClose}
      />
    )
  }

  if (modal.kind === 'settings') {
    const widget = widgets[modal.id]
    if (!widget) return null
    const settings = (widget.settings ?? {}) as Partial<SubscriptionWidgetSettings>
    return (
      <div className="sy-scrim" data-act="scrim">
        <div className="sy-sheet sm" role="dialog" aria-modal={true} aria-label="Widget 设置">
          <header className="sy-sh-h">
            <WidgetIcon type={widget.type} size={26} />
            <h2>{types[widget.type]?.name ?? ''}设置</h2>
            <button className="sy-icon-btn" data-act="modal-close" aria-label="关闭">
              <SvgIcon svg={I.x} />
            </button>
          </header>
          <div className="sy-sh-b">
            {widget.type === 'subscription' ? (
              <>
                <label className="sy-fld">
                  <span>标题</span>
                  <input
                    type="text"
                    name="title"
                    defaultValue={widget.title ?? ''}
                    placeholder={widgetTitle(widget, context)}
                  />
                </label>
                <div className="sy-fld">
                  <span>来源（可多选）</span>
                  <div className="sy-chips">
                    {(context.sources ?? []).map((source) => (
                      <button
                        key={source.id}
                        className="sy-chipbtn"
                        aria-pressed={(settings.sources ?? []).includes(source.id)}
                        onClick={() => {
                          const current = settings.sources ?? []
                          const next = current.includes(source.id)
                            ? current.length > 1
                              ? current.filter((entry) => entry !== source.id)
                              : current
                            : [...current, source.id]
                          void onRun('widget.update', { id: widget.id, settings: { ...settings, sources: next } })
                        }}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sy-fld">
                  <span>呈现</span>
                  <div className="sy-seg sm">
                    {(['图文', '榜单', '论文', '产品', '视频'] as const).map((entry) => (
                      <button
                        key={entry}
                        aria-pressed={(settings.pres ?? '图文') === entry}
                        onClick={() =>
                          void onRun('widget.update', { id: widget.id, settings: { ...settings, pres: entry } })
                        }
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sy-fld">
                  <span>布局</span>
                  <div className="sy-seg sm">
                    <button
                      aria-pressed={!settings.deck}
                      onClick={() =>
                        void onRun('widget.update', { id: widget.id, settings: { ...settings, deck: false } })
                      }
                    >
                      列表
                    </button>
                    <button
                      aria-pressed={Boolean(settings.deck)}
                      onClick={() =>
                        void onRun('widget.update', { id: widget.id, settings: { ...settings, deck: true } })
                      }
                    >
                      卡片流 · 一次一条
                    </button>
                  </div>
                </div>
                <div className="sy-fld">
                  <span>排序</span>
                  <div className="sy-seg sm">
                    {SUB_SORTS.map(([key, label]) => (
                      <button
                        key={key}
                        aria-pressed={(settings.sort ?? 'new') === key}
                        onClick={() =>
                          void onRun('widget.update', { id: widget.id, settings: { ...settings, sort: key } })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="sy-fld">
                  <span>关注词（逗号分隔，所有订阅共用）</span>
                  <input
                    type="text"
                    name="interests"
                    defaultValue={(context.interests ?? []).join('，')}
                    onBlur={(event) => void onRun('interests.set', { text: event.target.value })}
                  />
                  <span className="meta" style={{ whiteSpace: 'normal' }}>
                    命中的条目会带上标记；排序选「关注优先」时排在前面。
                  </span>
                </label>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--sy-ink2)', whiteSpace: 'normal' }}>
                「{types[widget.type]?.name ?? ''}」目前没有可配置项。尺寸在卡片菜单里改。
              </p>
            )}
          </div>
          <footer className="sy-sh-f">
            <button className="sy-btn sy-btn-ink" data-act="modal-close">
              完成
            </button>
          </footer>
        </div>
      </div>
    )
  }

  return null
}
