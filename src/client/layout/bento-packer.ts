import { GAP, ROW, footprint } from './breakpoints.js'
import type { LayoutEntry, WidgetRecord } from '../../shared/domain.js'

export interface PackedPosition {
  x: number
  y: number
  w: number
  h: number
}

/** First-fit placement with no holes, in the order the layout gives. */
export function pack(
  types: Record<string, { sizes?: Record<string, [number, number]> }>,
  widgets: Record<string, WidgetRecord>,
  order: readonly LayoutEntry[],
  cols: number,
): Record<string, PackedPosition> {
  const occupied: number[][] = []
  const positions: Record<string, PackedPosition> = {}
  const free = (x: number, y: number, width: number, height: number) => {
    for (let row = y; row < y + height; row += 1) {
      for (let col = x; col < x + width; col += 1) {
        if (occupied[row]?.[col]) return false
      }
    }
    return true
  }
  for (const entry of order) {
    const widget = widgets[entry.id]
    if (!widget) continue
    const [width, height] = footprint(types, widget.type, entry.size, cols)
    let placed = false
    for (let y = 0; !placed; y += 1) {
      for (let x = 0; x <= cols - width; x += 1) {
        if (!free(x, y, width, height)) continue
        for (let row = y; row < y + height; row += 1) {
          occupied[row] = occupied[row] ?? []
          for (let col = x; col < x + width; col += 1) {
            occupied[row]![col] = 1
          }
        }
        positions[entry.id] = { x, y, w: width, h: height }
        placed = true
        break
      }
    }
  }
  return positions
}

export function startDrag(
  event: { clientX: number; clientY: number },
  card: HTMLElement,
  widgetId: string,
  layout: readonly LayoutEntry[],
  boardId: string | null,
  commit: (order: LayoutEntry[]) => void,
): void {
  const rect = card.getBoundingClientRect()
  const start = { x: event.clientX, y: event.clientY }
  let ghost: HTMLElement | null = null
  let lockUntil = 0
  const order = [...layout]

  const move = (moveEvent: PointerEvent) => {
    if (!ghost) {
      if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 5) return
      ghost = card.cloneNode(true) as HTMLElement
      ghost.classList.add('sy-ghost')
      ghost.style.width = `${rect.width}px`
      ghost.style.height = `${rect.height}px`
      ghost.style.gridColumn = ''
      ghost.style.gridRow = ''
      document.body.appendChild(ghost)
      card.classList.add('is-ph')
    }
    ghost.style.left = `${moveEvent.clientX - (start.x - rect.left)}px`
    ghost.style.top = `${moveEvent.clientY - (start.y - rect.top)}px`
    if (performance.now() < lockUntil) return
    const over = document
      .elementsFromPoint(moveEvent.clientX, moveEvent.clientY)
      .find((element): element is HTMLElement => element instanceof HTMLElement && element.matches('.sy-grid > .sy-w') && element !== card)
    if (!over) return
    const overRect = over.getBoundingClientRect()
    const inX = (moveEvent.clientX - overRect.left) / overRect.width
    const inY = (moveEvent.clientY - overRect.top) / overRect.height
    if (inX < 0.15 || inX > 0.85 || inY < 0.15 || inY > 0.85) return
    const from = order.findIndex((entry) => entry.id === widgetId)
    const to = order.findIndex((entry) => entry.id === over.dataset.id)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = order.splice(from, 1)
    if (!moved) return
    order.splice(to, 0, moved)
    lockUntil = performance.now() + 280
    commit(order)
  }

  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    ghost?.remove()
    card.classList.remove('is-ph')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
  void boardId
}

export function startResize(
  _event: { clientX: number; clientY: number },
  card: HTMLElement,
  widgetId: string,
  cols: number,
  types: Record<string, { sizes?: Record<string, [number, number]> }>,
  widgets: Record<string, WidgetRecord>,
  layout: readonly LayoutEntry[],
  commit: (id: string, size: string) => void,
): void {
  const rect = card.getBoundingClientRect()
  const gridElement = card.parentElement
  const style = gridElement ? window.getComputedStyle(gridElement) : null
  const gap = Number.parseFloat(style?.columnGap ?? `${GAP}`) || GAP
  const rowPx = Number.parseFloat(style?.gridAutoRows ?? `${ROW}`) || ROW
  const colWidth = ((gridElement?.clientWidth ?? 1200) - gap * (cols - 1)) / cols
  const widget = widgets[widgetId]
  const sizes = Object.keys((widget ? types[widget.type]?.sizes : undefined) ?? {})

  const move = (moveEvent: PointerEvent) => {
    if (!widget) return
    const usedCols = (moveEvent.clientX - rect.left + gap / 2) / (colWidth + gap)
    const usedRows = (moveEvent.clientY - rect.top + gap / 2) / (rowPx + gap)
    let best: string | null = null
    let bestDistance = Infinity
    for (const size of sizes) {
      const [width, height] = footprint(types, widget.type, size, cols)
      const distance = (width - usedCols) ** 2 + (height - usedRows) ** 2 * 1.4
      if (distance < bestDistance) {
        bestDistance = distance
        best = size
      }
    }
    const current = layout.find((entry) => entry.id === widgetId)?.size
    if (best && best !== current) commit(widgetId, best)
  }
  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
}
