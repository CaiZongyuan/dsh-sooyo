import * as React from 'react'
import { API } from '../api/client.js'
import type { FeedItem, Task, WidgetRecord, WidgetSize } from '../../shared/domain.js'
import type { WidgetRenderContext } from '../../shared/widget.js'

export const ASSET = `${API}/assets/a`

export const BRAND_APP =
  '<rect width="320" height="320" rx="76" fill="#282D55"/><g transform="translate(15 36) scale(.8)"><path d="M205 23V44M162 42L173 56M249 38L237 54" fill="none" stroke="#DF793D" stroke-width="13" stroke-linecap="round"/><path d="M19 116C55 110 112 118 147 142C151 100 171 70 203 69C219 68 233 73 245 81C263 77 280 78 284 85C271 89 260 98 256 109L253 137C286 120 322 114 347 116Q361 116 357 132C345 191 306 221 244 219L215 217L221 250Q224 266 208 265Q199 274 189 266Q175 274 168 264Q152 269 147 260Q143 255 150 245L165 217C80 231 30 204 16 135Q10 119 19 116Z" fill="#F1D5BC"/><path d="M147 142C151 100 171 70 203 69C219 68 233 73 245 81C263 77 280 78 284 85C271 89 260 98 256 109C256 158 238 179 208 181C178 183 154 168 147 142Z" fill="#344DA8" opacity=".7"/><path d="M171 110C187 81 216 78 238 99C224 128 195 136 171 110Z" fill="#FFF6EC"/><path d="M190 106C190 91 215 86 220 101C224 116 197 123 191 111Z" fill="#282D55"/><path d="M58 134H75Q84 134 84 143V155Q84 163 76 163H58Q50 163 50 155V143Q50 134 58 134Z" fill="#344DA8"/><path d="M98 134H114Q123 134 123 143V155Q123 163 115 163H98Q90 163 90 155V143Q90 134 98 134Z" fill="#E9B68C"/><path d="M62 169H78Q87 169 87 178V190Q87 199 79 199H63Q54 199 54 190V178Q54 169 62 169Z" fill="#E9B68C"/><path d="M102 169H118Q127 169 127 178V190Q127 199 119 199H103Q94 199 94 190V178Q94 169 102 169Z" fill="#E9B68C"/><path d="M263 142L317 137Q333 136 326 153L313 181Q309 192 298 193L253 196Q239 197 244 182L252 153Q255 144 263 142Z" fill="#FFF6EC"/><path d="M270 156H310M264 176H299" fill="none" stroke="#344DA8" stroke-width="8" stroke-linecap="round"/><path d="M150 217C163 192 179 175 200 176C222 177 232 195 224 212C207 234 175 231 150 217Z" fill="#F1D5BC"/></g>'
export const BRAND_SMALL =
  '<path fill="currentColor" fill-rule="evenodd" d="M2 8.5C5 8 8 9 10 10.6C10.3 7.2 12 5 14.4 5C15.5 5 16.4 5.4 17 5.8C18.2 5.5 19.2 5.6 19.6 6.1L17.8 7.3L17.5 10.1C19.2 9.2 21.2 8.7 23 8.8C22.3 13.8 19.6 16.2 15 16L15.5 18.8Q15.8 20 14.5 19.8Q13.7 20.5 13 19.8Q11.5 20.5 10.8 19.5L12.1 16.4C6 17.5 2.2 14.7 1.3 9.5Q1.1 8.6 2 8.5ZM11.7 8.3Q13.5 5.5 16.3 7.6Q14.5 10.4 11.7 8.3ZM4 10H6V12H4ZM7 10H9V12H7ZM4.6 13H6.6V15H4.6ZM7.6 13H9.6V15H7.6ZM18 11H21V12.5H18Z"/><circle cx="14" cy="7.9" r=".85" fill="currentColor"/><path d="M14 1.4V3M10.6 2.5L11.5 3.6M17.3 2.4L16.4 3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'

export const safeUrl = (value: unknown): string => (/^https?:\/\//i.test(String(value ?? '')) ? String(value) : '#')

export const pad2 = (n: number): string => String(n).padStart(2, '0')
export const WEEK = ['日', '一', '二', '三', '四', '五', '六'] as const

export const fmtCount = (n: number | undefined | null): string => {
  const v = Number(n || 0)
  return v >= 1e4 ? `${(v / 1e4).toFixed(v >= 1e5 ? 0 : 1)} 万` : v.toLocaleString('en-US')
}

export const relTime = (iso: string | null | undefined): string => {
  const parsed = Date.parse(iso ?? '')
  if (!Number.isFinite(parsed)) return ''
  const minutes = Math.max(1, Math.round((Date.now() - parsed) / 60000))
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} 小时前`
  return `${Math.round(minutes / 1440)} 天前`
}

export const hueOf = (text: unknown): number => {
  let hue = 0
  for (const char of String(text ?? '')) hue = (hue * 31 + char.charCodeAt(0)) % 360
  return hue
}

export const tint = (text: unknown): string => `hsl(${hueOf(text)} 42% 52%)`

export const greeting = (): string => {
  const hour = new Date().getHours()
  return hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
}

export const dayIdx = (): number => (new Date().getDay() + 6) % 7

export const CATEGORY_LABELS: Record<string, string> = {
  'ai-models': '模型',
  'ai-products': '产品',
  industry: '行业',
  paper: '论文',
  opinion: '观点',
  tip: '技巧',
  hot: '热榜',
  product: '产品',
  podcast: '视频',
}

export const CATEGORY_COLOUR: Record<string, string> = {
  'ai-models': 'var(--sy-t-task)',
  'ai-products': 'var(--sy-t-subscription)',
  industry: 'var(--sy-t-bookmarks)',
  paper: 'var(--sy-t-project)',
  opinion: 'var(--sy-t-habit)',
  tip: 'var(--sy-t-readlater)',
}

export const categoryLabel = (value: string | undefined | null): string | null =>
  value ? CATEGORY_LABELS[value] ?? null : null

export const OPERATION_LABELS: Record<string, string> = {
  'task.add': '新建任务',
  'task.update': '修改任务',
  'note.add': '记录笔记',
  'readlater.set': '稍后读',
  'board.create': '新建看板',
  'widget.add': '添加组件',
  'widget.update': '调整组件',
  'layout.set': '调整布局',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: '待批准',
  approved: '已批准',
  rejected: '已拒绝',
  applied: '已执行',
  rolled_back: '已撤销',
  failed: '执行失败',
  expired: '已过期',
}

export const I = {
  dots: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>',
  check:
    '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>',
  search:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  bookmark:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5l-4 3z"/></svg>',
  bookmarkOn:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5l-4 3z"/></svg>',
  toTask:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.6"/><path d="M5.6 8.1l1.7 1.7 3.2-3.5"/></svg>',
  out: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7M13 3L4 12"/></svg>',
  note: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M6 8h4M6 10.5h3" stroke-linecap="round"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  copy: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 3.2A1.8 1.8 0 0 0 9.3 2H4a2 2 0 0 0-2 2v5.3A1.8 1.8 0 0 0 3.2 11"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M13.2 10A5.6 5.6 0 0 1 6 2.8a5.6 5.6 0 1 0 7.2 7.2z"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>',
  pause:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="2.8" height="10" rx=".8"/><rect x="9.2" y="3" width="2.8" height="10" rx=".8"/></svg>',
  reset:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.8v2.6h2.6"/></svg>',
  resize:
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10.5 4.5v6h-6M10.5 10.5L5 5"/></svg>',
  warn: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 3l7.5 13h-15z"/><path d="M10 8v3.6M10 14v.2" stroke-linecap="round"/></svg>',
  home: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6"/></svg>',
  work: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2.5" y="6" width="15" height="10.5" rx="2.2"/><path d="M7 6V4.6A1.6 1.6 0 0 1 8.6 3h2.8A1.6 1.6 0 0 1 13 4.6V6M2.5 10.5h15"/></svg>',
  life: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5C9 3.5 4 7 4 12.5c0 1.6.6 3 1.4 4M16.5 3.5c0 7.5-4 12-9.6 12.4M8.5 11.5L4 16"/></svg>',
  read: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 5.2C8.4 4 6 3.5 3 3.6v11.6c3-.1 5.4.4 7 1.6 1.6-1.2 4-1.7 7-1.6V3.6c-3-.1-5.4.4-7 1.6zM10 5.2v11.6"/></svg>',
  spark:
    '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 .8l1.2 3.6a1 1 0 0 0 .5.5L11.2 6l-3.5 1.2a1 1 0 0 0-.5.5L6 11.2 4.8 7.7a1 1 0 0 0-.5-.5L.8 6l3.5-1.2a1 1 0 0 0 .5-.5z"/></svg>',
  up: '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4.5 7h-9z"/></svg>',
  board:
    '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M3 8h14M8 8v9"/></svg>',
} as const

export function SvgIcon({ svg }: { svg: string }) {
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function WidgetIcon({ type, size = 22 }: { type: string; size?: number }) {
  const [fallback, setFallback] = React.useState(false)
  return (
    <span
      className="sy-ic"
      data-fallback={fallback ? '1' : undefined}
      style={{ '--s': `${size}px`, '--ic-c': `var(--sy-t-${type})` } as React.CSSProperties}
    >
      {!fallback ? <img src={`${ASSET}/${type}.webp`} alt="" onError={() => setFallback(true)} /> : null}
    </span>
  )
}

export function DecoImg({ name }: { name: string }) {
  const [hidden, setHidden] = React.useState(false)
  if (hidden) return <div className="sy-deco" />
  return (
    <div className="sy-deco">
      <img src={`${ASSET}/${name}.webp`} alt="" onError={() => setHidden(true)} />
    </div>
  )
}

export function ProgressBar({ pct, colour }: { pct: number; colour: string }) {
  return (
    <div className="sy-bar" style={{ '--c': colour } as React.CSSProperties}>
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` }} />
    </div>
  )
}

export function ProgressRing({
  pct,
  size,
  stroke,
  colour,
  label,
}: {
  pct: number
  size: number
  stroke: number
  colour: string
  label: string
}) {
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const dash = length * (1 - Math.max(0, Math.min(1, pct)))
  return (
    <div className="sy-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--sy-well)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      <b>{label}</b>
    </div>
  )
}

export function MonoTile({ name, colour }: { name: string; colour?: string }) {
  const first = [...String(name).replace(/^(Sample|示例)\s*/, '')][0] ?? '·'
  return (
    <span className="sy-mono-t" style={{ '--c': colour || tint(name) } as React.CSSProperties}>
      {first}
    </span>
  )
}

export const EMPTY_TEXT: Record<string, { ill?: string; text: string }> = {
  task: { ill: 'ill-done', text: '今天的事都做完了。新任务会先进收件箱。' },
  subscription: { text: '这个订阅暂时没有新内容，到下次刷新再看看。' },
  readlater: { ill: 'ill-readlater', text: '还没有稍后读。在订阅里点书签图标，文章就会存到这里。' },
  capture: { text: '还没有记录。在上面输入一行，回车就存好了。' },
  notes: { text: '还没有笔记。在快速记录里用 #note 开头输入即可创建。' },
  project: { text: '还没有项目。把任务归到一个项目下，这里就会显示它的进度。' },
  habit: { text: '还没有习惯。' },
  bookmarks: { text: '还没有书签。' },
  focus: { ill: 'ill-focus', text: '准备好了就开始一个番茄。' },
}

export function widgetTitle(widget: WidgetRecord | null | undefined, ctx: WidgetRenderContext): string {
  if (widget?.title) return widget.title
  if (widget?.type === 'subscription') {
    const sources = Array.isArray((widget.settings as any)?.sources) ? ((widget.settings as any).sources as string[]) : []
    const labels = sources
      .map((id) => ctx.sources.find((source) => source.id === id)?.label)
      .filter(Boolean)
    return labels.join(' + ') || '订阅'
  }
  return (widget?.type ? ctx.types?.[widget.type]?.name : undefined) ?? widget?.type ?? 'Widget'
}

export function EmptyWidgetState({
  widget,
  size,
  context,
}: {
  widget: WidgetRecord
  size: WidgetSize
  context: WidgetRenderContext
}) {
  const entry = EMPTY_TEXT[widget.type] ?? { text: '这里还没有内容。' }
  const [illErr, setIllErr] = React.useState(false)
  if (size === 'S') {
    return (
      <>
        <div className="sy-s-lab">{widgetTitle(widget, context)}</div>
        <div className="sy-state">
          <p style={{ fontSize: 13 }}>{entry.text}</p>
        </div>
      </>
    )
  }
  if (entry.ill) {
    return (
      <div className="sy-state-ill">
        {!illErr ? <img src={`${ASSET}/${entry.ill}.webp`} alt="" onError={() => setIllErr(true)} /> : null}
        <p className="sy-reason-plain" style={{ margin: 0, fontSize: 13.5 }}>
          {entry.text}
        </p>
      </div>
    )
  }
  return (
    <div className="sy-state">
      <p>{entry.text}</p>
    </div>
  )
}

export interface ProjectSummary {
  name: string
  total: number
  done: number
  open: number
  progress: number
}

export function projectsOf(tasks: readonly Task[]): ProjectSummary[] {
  const names = [...new Set(tasks.map((task) => task.project).filter((p): p is string => Boolean(p)))]
  return names.map((name) => {
    const rows = tasks.filter((task) => task.project === name)
    const done = rows.filter((task) => task.done).length
    return {
      name,
      total: rows.length,
      done,
      open: rows.length - done,
      progress: rows.length ? done / rows.length : 0,
    }
  })
}

export const coverOf = (item: FeedItem | null | undefined): string | null =>
  item?.thumbnail ?? item?.cover ?? null

export const matchOf = (item: FeedItem | null | undefined, interests: readonly string[]): string | null => {
  if (!Array.isArray(interests) || interests.length === 0 || !item) return null
  const hay = [item.title, item.summary, item.tldr, item.reason, ...(item.keywords ?? [])]
    .join(' ')
    .toLowerCase()
  return interests.find((keyword) => keyword && hay.includes(String(keyword).toLowerCase())) ?? null
}

export function MatchChip({ item, interests }: { item: FeedItem; interests: readonly string[] }) {
  const keyword = matchOf(item, interests)
  if (!keyword) return null
  return (
    <span className="sy-chip match" title="命中你的关注词">
      <SvgIcon svg={I.spark} />
      {keyword}
    </span>
  )
}

export function ScoreBadge({ item }: { item: FeedItem }) {
  if (typeof item?.score !== 'number') return null
  return (
    <span className={`sy-score${item.score >= 80 ? ' hi' : ''}`} title="AIHOT 评分">
      {item.score}
    </span>
  )
}

export function CategoryBadge({ item }: { item: FeedItem }) {
  const label = categoryLabel(item?.category)
  if (!label) return null
  const colour = (item.category ? CATEGORY_COLOUR[item.category] : undefined) ?? 'var(--sy-ink3)'
  return (
    <span className="sy-cat" style={{ '--c': colour } as React.CSSProperties}>
      {label}
    </span>
  )
}

export function ItemActions({ item, saved }: { item: FeedItem; saved: boolean }) {
  return (
    <span className="sy-acts">
      <button
        data-act="item-later"
        data-item={item.id}
        aria-pressed={saved ? 'true' : 'false'}
        aria-label={saved ? '已在稍后读' : '稍后读'}
        title="稍后读"
      >
        <SvgIcon svg={saved ? I.bookmarkOn : I.bookmark} />
      </button>
      <button data-act="item-task" data-item={item.id} aria-label="转为任务" title="转为任务">
        <SvgIcon svg={I.toTask} />
      </button>
      <a
        href={safeUrl(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="打开原文"
        title="打开原文"
      >
        <SvgIcon svg={I.out} />
      </a>
    </span>
  )
}

export function ItemLink({
  item,
  className,
  children,
}: {
  item: FeedItem
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      className={className}
      data-open={item.id}
      href={safeUrl(item.url)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

export function ThumbBox({ item, label }: { item: FeedItem; label?: string }) {
  const cover = coverOf(item)
  if (cover) {
    return <img src={cover} alt="" loading="lazy" />
  }
  return (
    <div className="sy-gen" style={{ '--c': tint(item.sourceId + (label ?? '')) } as React.CSSProperties}>
      {label ?? ''}
    </div>
  )
}
