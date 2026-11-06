import * as React from 'react'
import { I, ProgressBar, ProgressRing, SvgIcon, pad2 } from '../shared.tsx'
import type { FocusWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

const fmtClock = (seconds: number): string => `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`

export function FocusWidget({ size, context }: WidgetRendererProps<FocusWidgetSettings>) {
  const focus = context.focus ?? { total: 1500, left: 1500, running: false, sessions: 0, task: null }
  const task = context.tasks.find((entry) => entry.id === focus.task)
  const button = (
    <button
      className="sy-play-btn"
      data-act="focus-toggle"
      aria-label={focus.running ? '暂停' : '开始专注'}
    >
      <SvgIcon svg={focus.running ? I.pause : I.play} />
    </button>
  )

  if (size === 'S') {
    return (
      <>
        <div className="sy-s-lab">专注 · 第 {(focus.sessions ?? 0) + 1} 个番茄</div>
        <div className="sy-fx">
          <span className="sy-fd">{fmtClock(focus.left)}</span>
          {button}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ProgressBar pct={1 - focus.left / focus.total} colour="var(--sy-t-focus)" />
          <div className="meta c1" style={{ whiteSpace: 'normal' }}>
            {task ? task.title : '没有关联任务'}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="sy-fm">
      <ProgressRing
        pct={1 - focus.left / focus.total}
        size={96}
        stroke={8}
        colour="var(--sy-t-focus)"
        label={fmtClock(focus.left)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div className="meta">当前任务</div>
        <button
          className="c1"
          data-act="focus-next-task"
          style={{ textAlign: 'left', fontSize: 14, fontWeight: 500 }}
          title="换一个任务"
        >
          {task ? task.title : '选择一个任务'} <span className="meta">↻</span>
        </button>
        <div className="sy-sess">
          {[0, 1, 2, 3].map((index) => (
            <i key={index} className={index < (focus.sessions ?? 0) ? 'on' : ''} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {button}
          <button className="sy-play-btn ghost" data-act="focus-reset" aria-label="重置">
            <SvgIcon svg={I.reset} />
          </button>
        </div>
      </div>
    </div>
  )
}

export const focusWidgetDefinition: WidgetDefinition<FocusWidgetSettings> = {
  type: 'focus',
  name: '番茄专注',
  desc: '25 分钟专注倒计时，关联一件今天的任务',
  priority: 'P1',
  sizes: { S: [3, 2], M: [6, 2] },
  defaultSize: 'S',
  actions: ['开始或暂停', '重置'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: FocusWidget,
  computeLayoutMeta: ({ size, context }) => {
    if (size === 'S') return {}
    const focus = context.focus ?? { sessions: 0 }
    return { sub: `今天 ${focus.sessions ?? 0} 个番茄` }
  },
}
