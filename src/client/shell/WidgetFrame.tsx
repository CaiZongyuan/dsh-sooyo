import * as React from 'react'
import { DecoImg, I, SvgIcon, WidgetIcon, widgetTitle } from '../widgets/shared.tsx'
import { UnknownWidgetFallback, getWidgetDefinition } from '../widgets/registry.ts'
import { fitDom, sizeOrder } from '../layout/breakpoints.ts'
import type { PackedPosition } from '../layout/bento-packer.ts'
import type { WidgetRecord, WidgetSize } from '../../shared/domain.ts'
import type { WidgetRenderContext } from '../../shared/widget.ts'

export interface MenuState {
  kind: 'board-new' | 'w-menu'
  id?: string
  rect: DOMRect
}

export function computeWidgetCardView(
  widget: WidgetRecord,
  size: WidgetSize,
  context: WidgetRenderContext,
  options: { preview?: boolean } = {},
) {
  const type = widget.type
  const definition = getWidgetDefinition(type)
  const settings = definition ? definition.normalizeSettings(widget.settings) : (widget.settings ?? {})
  const renderProps = {
    widget,
    size,
    settings,
    context,
    onAction: () => {},
  }
  const meta = definition?.computeLayoutMeta
    ? definition.computeLayoutMeta(renderProps)
    : { sub: '暂不支持' }
  const Component = definition ? definition.Component : UnknownWidgetFallback
  const titleText = widgetTitle(widget, context)

  const menu = options.preview ? null : (
    <button
      className={`sy-w-m${size === 'S' || meta.noHeader ? ' abs' : ''}`}
      data-act="w-menu"
      data-w={widget.id}
      aria-label={`${titleText}：更多操作`}
      aria-haspopup="menu"
    >
      <SvgIcon svg={I.dots} />
    </button>
  )

  const header =
    size !== 'S' && !meta.noHeader ? (
      <header className="sy-w-h">
        <WidgetIcon type={type} />
        <div className="sy-w-t">
          <b>{titleText}</b>
          {meta.sub ? <span>{meta.sub}</span> : null}
        </div>
        {menu}
      </header>
    ) : (
      menu
    )

  const edit = options.preview ? null : (
    <>
      <div className="sy-e-bar">
        {(context.sizesOf(type) ?? []).map((entry) => (
          <button
            key={entry}
            data-act="w-size"
            data-w={widget.id}
            data-size={entry}
            aria-pressed={entry === size}
            title={`尺寸 ${entry}`}
          >
            {entry === 'Wide' ? 'W' : entry}
          </button>
        ))}
        <span className="sep" />
        <button data-act="w-dup" data-w={widget.id} title="复制" aria-label="复制">
          <SvgIcon svg={I.copy} />
        </button>
        <button className="del" data-act="w-remove" data-w={widget.id} title="移除" aria-label="移除">
          <SvgIcon svg={I.x} />
        </button>
      </div>
      <div className="sy-e-rz" data-rz={widget.id} title="拖动改尺寸">
        <SvgIcon svg={I.resize} />
      </div>
    </>
  )

  const cls = `sy-w sy-w--${size === 'S' ? 's' : String(size).toLowerCase()} ${meta.cls ?? ''}`.trim()
  const content = (
    <>
      {meta.bg ?? null}
      {meta.deco ? <DecoImg name={meta.deco} /> : null}
      {header}
      <div className="sy-w-b">
        <Component {...renderProps} />
      </div>
      {edit}
    </>
  )

  return { cls, content }
}

export function WidgetFrame({
  widget,
  size,
  position,
  context,
}: {
  widget: WidgetRecord
  size: WidgetSize
  position: PackedPosition
  context: WidgetRenderContext
}) {
  const ref = React.useRef<HTMLElement | null>(null)
  const { cls, content } = computeWidgetCardView(widget, size, context)

  React.useLayoutEffect(() => {
    if (ref.current) {
      fitDom(ref.current)
    }
  })

  return (
    <section
      ref={ref}
      className={cls}
      data-id={widget.id}
      style={{
        gridColumn: `${position.x + 1} / span ${position.w}`,
        gridRow: `${position.y + 1} / span ${position.h}`,
      }}
    >
      {content}
    </section>
  )
}

export function MenuLayer({
  menu,
  widgets,
  types,
  context,
  onClose,
}: {
  menu: MenuState
  widgets: Record<string, WidgetRecord>
  types: Record<string, any>
  context: WidgetRenderContext
  onClose: () => void
}) {
  const style: React.CSSProperties = {
    left: Math.max(12, Math.min(menu.rect.right - 216, (window.innerWidth || 1200) - 228)),
    top: Math.min(menu.rect.bottom + 6, (window.innerHeight || 800) - 320),
  }
  if (menu.kind === 'board-new') {
    return (
      <div className="sy-pop" style={style} role="dialog" aria-label="新建 Board">
        <div className="sy-pop-h">新建 Board</div>
        <form className="sy-mi" data-form="board-new" style={{ cursor: 'default' }}>
          <input
            name="name"
            placeholder="例如：科研、旅行"
            autoComplete="off"
            aria-label="Board 名称"
            autoFocus
          />
          <button className="sy-btn sy-btn-ink" style={{ height: 30 }}>
            创建
          </button>
        </form>
        <div className="meta" style={{ padding: '2px 10px 8px', whiteSpace: 'normal' }}>
          新 Board 是空的，和其它 Board 共用同一份任务和订阅。
        </div>
      </div>
    )
  }

  const widget = menu.id ? widgets[menu.id] : undefined
  if (!widget) return null
  const currentSize = (menu.id ? context.layoutSizes?.[menu.id] : undefined) ?? 'M'
  return (
    <div className="sy-pop" style={style} role="menu">
      <div className="sy-pop-h">
        <span>尺寸</span>
        <span className="meta">{context.cols} 列布局</span>
      </div>
      <div className="sizes">
        {sizeOrder.map((entry) => (
          <button
            key={entry}
            className="sy-sz"
            data-act="w-size"
            data-w={menu.id}
            data-size={entry}
            aria-pressed={currentSize === entry}
            disabled={!types[widget.type]?.sizes?.[entry]}
            title={types[widget.type]?.sizes?.[entry] ? `尺寸 ${entry}` : '这个 Widget 没有这个尺寸'}
          >
            {entry}
          </button>
        ))}
      </div>
      <hr />
      <button className="sy-mi" data-act="w-refresh" data-w={menu.id}>
        刷新
      </button>
      <button className="sy-mi" data-act="w-settings" data-w={menu.id}>
        设置…
      </button>
      <button className="sy-mi" data-act="w-dup" data-w={menu.id}>
        复制
      </button>
      <button className="sy-mi danger" data-act="w-remove" data-w={menu.id}>
        移除
      </button>
      <button className="sy-mi" onClick={onClose}>
        关闭
      </button>
    </div>
  )
}
