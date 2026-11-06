import * as React from 'react'
import { I, ProgressBar, SvgIcon, safeUrl } from '../shared.tsx'
import type { Task, TaskList, TaskWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

function tasksIn(tasks: readonly Task[], settings: TaskWidgetSettings, list: TaskList): Task[] {
  return tasks.filter((task) => task.list === list && (!settings?.project || task.project === settings.project))
}

function TaskRow({ task, showProject }: { task: Task; showProject?: boolean }) {
  return (
    <div className={`sy-row sy-t-row${task.done ? ' sy-done' : ''}`}>
      <button
        className="sy-chk"
        data-act="task-toggle"
        data-task={task.id}
        aria-label={`${task.done ? '标记为未完成' : '完成'}：${task.title}`}
      >
        <SvgIcon svg={I.check} />
      </button>
      <span className="sy-t-title c1 grow">{task.title}</span>
      {task.origin?.url ? (
        <a
          className="sy-chip"
          href={safeUrl(task.origin.url)}
          target="_blank"
          rel="noopener noreferrer"
          title={`来自 ${task.origin.source ?? ''}，点开原文`}
        >
          {task.origin.source ?? ''}
        </a>
      ) : null}
      {showProject && task.project ? <span className="sy-chip">{task.project}</span> : null}
      <button className="sy-mini" data-act="task-remove" data-task={task.id} aria-label="删除任务" title="删除">
        <SvgIcon svg={I.x} />
      </button>
    </div>
  )
}

export function TaskWidget({ widget, size, settings, context }: WidgetRendererProps<TaskWidgetSettings>) {
  const tasks = context.tasks
  const list = tasksIn(tasks, settings, 'today')
  const open = list.filter((task) => !task.done)
  const done = list.filter((task) => task.done)
  const inbox = tasksIn(tasks, settings, 'inbox')
  const later = tasksIn(tasks, settings, 'later')
  const scope = settings?.project ? `${settings.project} · ` : ''

  if (size === 'S') {
    if (open.length === 0) {
      return (
        <>
          <div className="sy-s-lab">{scope}今天</div>
          <div className="sy-s-main sy-s-narrow">
            <div className="sy-s-big">
              {done.length}
              <small>/{list.length}</small>
            </div>
            <div className="sy-s-sub">今天的事都做完了</div>
          </div>
          <div />
        </>
      )
    }
    const first = open[0]!
    return (
      <>
        <div className="sy-s-lab">{scope}今天</div>
        <div className="sy-s-main">
          <div className="sy-s-big">{open.length}</div>
          <div className="sy-s-sub">件事还没做</div>
        </div>
        <button
          className="sy-s-next"
          data-act="task-toggle"
          data-task={first.id}
          aria-label={`完成：${first.title}`}
        >
          <span className="sy-chk">
            <SvgIcon svg={I.check} />
          </span>
          <span className="c1">{first.title}</span>
        </button>
      </>
    )
  }

  const progress = list.length ? done.length / list.length : 0

  if (size === 'M') {
    const shown = [...open, ...done].slice(0, 3)
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="sy-s-big" style={{ fontSize: 36 }}>
              {done.length}
              <small>/{list.length}</small>
            </span>
            <span className="meta">今天已完成</span>
          </div>
          <ProgressBar pct={progress} colour="var(--sy-t-task)" />
        </div>
        <div className="sy-list sy-fit" style={{ gap: 3 }}>
          {shown.map((task) => (
            <div key={task.id} className={`sy-row sy-t-row sy-t-m${task.done ? ' sy-done' : ''}`}>
              <button
                className="sy-chk"
                data-act="task-toggle"
                data-task={task.id}
                aria-label={`完成：${task.title}`}
              >
                <SvgIcon svg={I.check} />
              </button>
              <span className="sy-t-title c2 grow">{task.title}</span>
            </div>
          ))}
        </div>
        <div className="meta" style={{ flex: 'none' }}>
          收件箱 {inbox.length} · 之后 {later.length}
        </div>
      </>
    )
  }

  const single = context.cols <= 4
  return (
    <>
      <form className="sy-cap" data-form="task-add" data-w={widget.id} style={{ height: 36 }}>
        <input name="t" placeholder="新建任务，回车加入今天" autoComplete="off" aria-label="新建任务" />
        <kbd>↵</kbd>
      </form>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: single ? '1fr' : '1fr 1fr',
          gap: 18,
          flex: 1,
          minHeight: 0,
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="sy-agenda-h">
            今天 · {open.length}/{list.length}
          </div>
          <div className="sy-list sy-fit">
            {[...open, ...done].map((task) => (
              <TaskRow key={task.id} task={task} showProject={!single} />
            ))}
          </div>
        </section>
        {!single ? (
          <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="sy-agenda-h">收件箱 · {inbox.length}</div>
            <div className="sy-list sy-fit">
              {inbox.length ? (
                inbox.map((task) => (
                  <div key={task.id} className="sy-row">
                    <span className="sy-t-title c1 grow">{task.title}</span>
                    <button className="sy-mini" data-act="task-today" data-task={task.id}>
                      移到今天
                    </button>
                  </div>
                ))
              ) : (
                <div className="meta" style={{ padding: '8px 0' }}>
                  收件箱是空的
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}

export const taskWidgetDefinition: WidgetDefinition<TaskWidgetSettings> = {
  type: 'task',
  name: '任务',
  desc: '今天要做的事，直接勾选完成',
  priority: 'P0',
  sizes: { S: [3, 2], M: [3, 4], L: [6, 4] },
  defaultSize: 'M',
  actions: ['勾选完成', '移到今天', '新建任务'],
  defaultSettings: () => ({}),
  normalizeSettings: (raw) => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    return {
      ...(typeof obj.project === 'string' && obj.project ? { project: obj.project } : {}),
    }
  },
  Component: TaskWidget,
  computeLayoutMeta: ({ size, settings, context }) => {
    const list = tasksIn(context.tasks, settings, 'today')
    const open = list.filter((task) => !task.done)
    if (size === 'S') {
      return open.length === 0 ? { deco: 'ill-done' } : {}
    }
    return { sub: `${open.length} 件待办` }
  },
}
