import type { GridColumns, WidgetSize } from '../../shared/domain.js'

export const GAP = 14
export const ROW = 88
export const sizeOrder: readonly WidgetSize[] = ['S', 'M', 'L', 'Wide']

export const columnsFor = (width: number): GridColumns => (width >= 940 ? 12 : width >= 540 ? 6 : 4)

/** The footprint a Widget occupies, mirroring the Host's `personal.ts`. */
export function footprint(
  types: Record<string, { sizes?: Record<string, [number, number]> }>,
  type: string,
  size: string,
  cols: number,
): [number, number] {
  const sizes = types[type]?.sizes ?? { S: [3, 2] }
  const [width, height] = sizes[size] ?? Object.values(sizes)[0] ?? [3, 2]
  if (cols >= 12) return [width, height]
  if (cols === 6) return [width >= 6 ? 6 : 3, height]
  return [size === 'S' ? 2 : 4, height]
}

/**
 * Trim a card's content to the space its Size allocates.
 *
 * Uses `display: none` + `data-sy-fit-hidden="1"` so React can safely reconcile TSX children
 * without `NotFoundError: removeChild`, while achieving the exact same `ov=0` layout box.
 */
export function fitDom(root: HTMLElement | null): void {
  if (!root) return
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('.sy-fit, .sy-fit-x'))) {
    for (const child of Array.from(element.children)) {
      if (child instanceof HTMLElement && child.dataset.syFitHidden === '1') {
        child.style.display = ''
        delete child.dataset.syFitHidden
      }
    }
    const horizontal = element.classList.contains('sy-fit-x')
    const overflows = () =>
      horizontal
        ? element.scrollWidth > element.clientWidth + 1
        : element.scrollHeight > element.clientHeight + 1
    const visibleChildren = () =>
      Array.from(element.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.syFitHidden !== '1',
      )
    let guard = 60
    while (guard-- > 0) {
      const vis = visibleChildren()
      if (vis.length <= 1 || !overflows()) break
      const last = vis[vis.length - 1]
      if (last) {
        last.style.display = 'none'
        last.dataset.syFitHidden = '1'
      }
    }
    while (true) {
      const vis = visibleChildren()
      const last = vis[vis.length - 1]
      if (vis.length > 1 && last && last.classList.contains('sy-agenda-h')) {
        last.style.display = 'none'
        last.dataset.syFitHidden = '1'
      } else {
        break
      }
    }
  }
}
