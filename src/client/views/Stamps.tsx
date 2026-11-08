import * as React from 'react'
import type { ItemSnapshot, Note, RetrospectiveRecord, Task } from '../../shared/domain.ts'

const { useMemo } = React

export interface DayFootprintItem {
  id: string
  kind: 'note' | 'task' | 'collection' | 'retro'
  title: string
  thumbnail?: string | null
  createdAt: string
}

export function toDayKey(input: string | Date | null | undefined): string {
  if (!input) return ''
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input.slice(0, 10)
  }
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function hashCode(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function buildDayFootprintMap(
  notes: readonly Note[],
  tasks: readonly Task[],
  readLaterEntries: Record<string, ItemSnapshot>,
  retros: Record<string, RetrospectiveRecord>,
): Map<string, DayFootprintItem[]> {
  const map = new Map<string, DayFootprintItem[]>()
  const push = (day: string, entry: DayFootprintItem) => {
    if (!day) return
    const list = map.get(day) ?? []
    list.push(entry)
    map.set(day, list)
  }

  for (const note of notes) {
    const day = toDayKey(note.createdAt)
    push(day, {
      id: note.id,
      kind: 'note',
      title: note.title || note.text.slice(0, 40),
      thumbnail: null,
      createdAt: note.createdAt,
    })
  }

  for (const [id, snap] of Object.entries(readLaterEntries ?? {})) {
    if (!snap) continue
    const day = toDayKey(snap.savedAt || snap.publishedAt)
    push(day, {
      id,
      kind: 'collection',
      title: snap.title,
      thumbnail: snap.thumbnail ?? snap.cover ?? null,
      createdAt: snap.savedAt || snap.publishedAt || '',
    })
  }

  for (const task of tasks) {
    if (task.done && (task.completedAt || task.updatedAt || task.createdAt)) {
      const day = toDayKey(task.completedAt || task.updatedAt || task.createdAt)
      push(day, {
        id: task.id,
        kind: 'task',
        title: task.title,
        thumbnail: null,
        createdAt: task.completedAt || task.updatedAt || task.createdAt,
      })
    }
  }

  for (const retro of Object.values(retros ?? {})) {
    if (!retro?.updatedAt) continue
    const day = toDayKey(retro.updatedAt)
    push(day, {
      id: retro.key,
      kind: 'retro',
      title: retro.highlights || retro.nextFocus || '个人复盘',
      thumbnail: null,
      createdAt: retro.updatedAt,
    })
  }

  return map
}

export function computeActiveStreak(dayMap: Map<string, DayFootprintItem[]>): number {
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 365; i += 1) {
    const key = toDayKey(cursor)
    const hasActivity = (dayMap.get(key)?.length ?? 0) > 0
    if (hasActivity) {
      streak += 1
    } else if (i > 0) {
      break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function useDayFootprintMap(
  notes: readonly Note[],
  tasks: readonly Task[],
  readLaterEntries: Record<string, ItemSnapshot>,
  retros: Record<string, RetrospectiveRecord>,
) {
  return useMemo(
    () => buildDayFootprintMap(notes, tasks, readLaterEntries, retros),
    [notes, tasks, readLaterEntries, retros],
  )
}

export function Stamp({
  list,
  today,
  label,
  onOpen,
  onCaptureToday,
}: {
  list?: DayFootprintItem[]
  today?: boolean
  label: string
  onOpen?: () => void
  onCaptureToday?: () => void
}) {
  if (!list || list.length === 0) {
    return (
      <button
        type="button"
        className={`sy-stamp is-blank${today ? ' is-today' : ''}`}
        aria-label={today ? '今天还没有记录，记一条' : `${label} 没有记录`}
        title={today ? '今天还没有记录，点击记一条' : `${label} 无记录`}
        onClick={today ? onCaptureToday : undefined}
        disabled={!today}
      >
        {today ? <span>+</span> : null}
      </button>
    )
  }

  const cover = list.find((item) => Boolean(item.thumbnail)) ?? list[0]!
  const tone = hashCode(cover.id) % 6
  const glyph = (cover.title || '记').replace(/^[#*\s]+/, '').slice(0, 1) || '记'

  return (
    <button
      type="button"
      className={`sy-stamp ${cover.thumbnail ? 'has-img' : `is-type tone-${tone}`}${today ? ' is-today' : ''}`}
      aria-label={`${label}：${cover.title}，共 ${list.length} 条`}
      title={`${label}：${cover.title}（共 ${list.length} 条记录）`}
      onClick={onOpen}
    >
      {cover.thumbnail ? (
        <img src={cover.thumbnail} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer" />
      ) : (
        <span>{glyph}</span>
      )}
      {list.length > 1 ? <i>{list.length}</i> : null}
    </button>
  )
}

export function MiniStamps({
  dayMap,
  onOpenSchedule,
  onCaptureToday,
}: {
  dayMap: Map<string, DayFootprintItem[]>
  onOpenSchedule: (dayKey?: string) => void
  onCaptureToday: () => void
}) {
  const streak = useMemo(() => computeActiveStreak(dayMap), [dayMap])
  const todayKey = toDayKey(new Date())
  const cells = useMemo(() => {
    const out: Date[] = []
    const now = new Date()
    for (let i = 9; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      out.push(d)
    }
    return out
  }, [])

  return (
    <div className="sy-ministamps" aria-label={`最近 10 天活动邮票，已连续记录 ${streak} 天`}>
      <div className="sy-ministamps-row">
        {cells.map((d) => {
          const key = toDayKey(d)
          const list = dayMap.get(key)
          const label = `${d.getMonth() + 1}月${d.getDate()}日`
          return (
            <Stamp
              key={key}
              list={list}
              today={key === todayKey}
              label={label}
              onCaptureToday={onCaptureToday}
              onOpen={() => onOpenSchedule(key)}
            />
          )
        })}
      </div>
      <button
        type="button"
        className="sy-ministamps-more"
        onClick={() => onOpenSchedule(todayKey)}
        title={`打开排期日历（已连续记录 ${streak} 天）`}
        aria-label={`打开排期日历，已连续记录 ${streak} 天`}
      >
        <span>{streak}天</span>
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}
