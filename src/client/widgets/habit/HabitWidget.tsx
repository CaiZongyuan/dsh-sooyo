import * as React from 'react'
import { EmptyWidgetState, I, SvgIcon, WidgetIcon, dayIdx } from '../shared.tsx'
import type { Habit, HabitWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

function Dots7({ habit }: { habit: Habit }) {
  const week = habit.week ?? [0, 0, 0, 0, 0, 0, 0]
  const todayIndex = dayIdx()
  return (
    <div className="sy-dots7">
      {week.map((value, index) =>
        index === todayIndex ? (
          <button
            key={index}
            className={`${value ? 'on' : ''} today`.trim()}
            data-act="habit-tick"
            data-habit={habit.id}
            aria-label={`今天${value ? '已打卡，点击取消' : '打卡'}：${habit.name}`}
          >
            {value ? <SvgIcon svg={I.check} /> : null}
          </button>
        ) : (
          <span
            key={index}
            className={index > todayIndex ? 'future' : value ? 'on' : ''}
            aria-hidden="true"
          >
            {'一二三四五六日'[index]}
          </span>
        ),
      )}
    </div>
  )
}

export function HabitWidget({ widget, size, context }: WidgetRendererProps<HabitWidgetSettings>) {
  const habits = context.habits ?? []
  if (habits.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }
  if (size === 'S') {
    const habit = habits[0]!
    return (
      <>
        <div className="sy-s-lab">
          <WidgetIcon type="habit" size={16} />
          {habit.name}
        </div>
        <div className="sy-s-main">
          <div className="sy-s-big">
            {habit.streak ?? 0}
            <small>天</small>
          </div>
          <div className="sy-s-sub">连续打卡</div>
        </div>
        <Dots7 habit={habit} />
      </>
    )
  }

  return (
    <div className="sy-list sy-fit" style={{ gap: 3 }}>
      {habits.map((habit) => (
        <div key={habit.id} className="sy-hb-row">
          <span className="c1 grow" style={{ fontSize: 13.5, fontWeight: 500 }}>
            {habit.name}
          </span>
          <span className="meta">{habit.streak ?? 0} 天</span>
          <Dots7 habit={habit} />
        </div>
      ))}
    </div>
  )
}

export const habitWidgetDefinition: WidgetDefinition<HabitWidgetSettings> = {
  type: 'habit',
  name: '习惯打卡',
  desc: '每天点一下，看这周做到了几天',
  priority: 'P1',
  sizes: { S: [3, 2], M: [6, 2] },
  defaultSize: 'M',
  actions: ['今日打卡'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: HabitWidget,
  computeLayoutMeta: ({ size, context }) => {
    const habits = context.habits ?? []
    if (habits.length === 0) return { sub: '空' }
    if (size === 'S') return {}
    const today = habits.filter((habit) => habit.week?.[dayIdx()]).length
    return { sub: `今天 ${today}/${habits.length}` }
  },
}
