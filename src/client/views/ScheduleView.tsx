import * as React from 'react'
import { computeActiveStreak, Stamp, toDayKey, type DayFootprintItem } from './Stamps.tsx'
import type { Task, TaskPriority, TaskSubtask } from '../../shared/domain.ts'

const { useState, useMemo } = React

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEK_HEADERS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DRAG_TASK_MIME = 'text/sooyo-task-id'

const PRIORITY_LABELS: Record<string, string> = {
  high: '高优',
  medium: '中优',
  low: '低优',
}

export function TaskDetailModal({
  task,
  onClose,
  onRun,
}: {
  task: Task
  onClose: () => void
  onRun: (name: string, body: Record<string, any>, opts?: { toast?: string }) => Promise<any>
}) {
  const [title, setTitle] = useState(task.title)
  const [due, setDue] = useState(task.due ? task.due.slice(0, 10) : '')
  const [priority, setPriority] = useState<TaskPriority | ''>(task.priority ?? '')
  const [project, setProject] = useState(task.project ?? '')
  const [note, setNote] = useState(task.note ?? '')
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>(Array.isArray(task.subtasks) ? task.subtasks : [])
  const [newSub, setNewSub] = useState('')

  const addSubtask = () => {
    const t = newSub.trim()
    if (!t) return
    setSubtasks((prev) => [...prev, { id: `sub-${Date.now().toString(36)}`, title: t, done: false }])
    setNewSub('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onRun(
      'task.update',
      {
        id: task.id,
        title: title.trim(),
        due: due || null,
        priority: priority || null,
        project: project.trim() || '',
        note: note.trim(),
        subtasks,
      },
      { toast: '已更新任务排期与详情' },
    )
    onClose()
  }

  const handleDelete = async () => {
    await onRun('task.remove', { id: task.id }, { toast: '已删除任务' })
    onClose()
  }

  return (
    <div className="sy-scrim" data-act="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sy-modal sy-capture-modal" role="dialog" aria-label="任务排期与详情">
        <div className="sy-modal-h">
          <div>
            <b>任务排期与子步骤</b>
            <div className="meta">
              {due ? `已排期至 ${due}` : '未排期（位于收件箱 Inbox）'}
              {task.origin?.url ? ` · 来源：${task.origin.source || task.origin.title || '外链'}` : ''}
            </div>
          </div>
          <button type="button" className="sy-icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <form className="sy-modal-b sy-form-stack" onSubmit={handleSave}>
          <label className="sy-field">
            <span>任务标题</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <div className="sy-form-row3">
            <label className="sy-field">
              <span>排期日期（清空则回 Inbox）</span>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="sy-field">
              <span>优先级</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | '')}>
                <option value="">无优先级</option>
                <option value="high">高优先级 (High)</option>
                <option value="medium">中优先级 (Medium)</option>
                <option value="low">低优先级 (Low)</option>
              </select>
            </label>
            <label className="sy-field">
              <span>所属项目 (Project)</span>
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="如：插件重构" />
            </label>
          </div>

          <label className="sy-field">
            <span>备注说明</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="记录执行要点、上下文或相关链接……"
            />
          </label>

          <div className="sy-field">
            <span>子步骤清单 ({subtasks.filter((s) => s.done).length}/{subtasks.length})</span>
            <div className="sy-subtask-list">
              {subtasks.map((sub, idx) => (
                <div key={sub.id} className="sy-subtask-row">
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onChange={() =>
                      setSubtasks((prev) => prev.map((s, i) => (i === idx ? { ...s, done: !s.done } : s)))
                    }
                  />
                  <span className={sub.done ? 'is-done' : ''}>{sub.title}</span>
                  <button
                    type="button"
                    className="sy-mini-act"
                    onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="sy-subtask-add">
                <input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  placeholder="添加子步骤，按加号确认"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                />
                <button type="button" className="sy-btn" onClick={addSubtask}>
                  + 添加步骤
                </button>
              </div>
            </div>
          </div>

          <div className="sy-modal-f">
            <button type="button" className="sy-btn" onClick={handleDelete}>
              删除任务
            </button>
            <button
              type="button"
              className="sy-btn"
              onClick={async () => {
                await onRun('task.update', { id: task.id, done: !task.done })
                onClose()
              }}
            >
              {task.done ? '标记为未完成' : '✓ 标记完成'}
            </button>
            <span className="grow" />
            <button type="button" className="sy-btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="sy-btn sy-btn-ink">
              保存排期
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ScheduleView({
  tasks,
  dayMap,
  initialFocusDay,
  onCaptureToday,
  onRun,
}: {
  tasks: readonly Task[]
  dayMap: Map<string, DayFootprintItem[]>
  initialFocusDay?: string | null
  onCaptureToday: () => void
  onRun: (name: string, body: Record<string, any>, opts?: { toast?: string }) => Promise<any>
}) {
  const todayKey = toDayKey(new Date())
  const [calMode, setCalMode] = useState<'month' | 'week'>('month')
  const [cursor, setCursor] = useState<Date>(() => {
    if (initialFocusDay && /^\d{4}-\d{2}-\d{2}/.test(initialFocusDay)) {
      const d = new Date(`${initialFocusDay.slice(0, 10)}T12:00:00`)
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string>(initialFocusDay || todayKey)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [dragOverTray, setDragOverTray] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [inboxDraft, setInboxDraft] = useState('')
  const [dayDraft, setDayDraft] = useState('')

  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}`

  const cells = useMemo(() => {
    if (calMode === 'week') {
      const anchor = selectedDay ? new Date(`${selectedDay}T12:00:00`) : new Date()
      const start = new Date(anchor)
      start.setDate(anchor.getDate() - anchor.getDay())
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return d
      })
    }
    const firstDow = new Date(y, m, 1).getDay()
    const raw: Date[] = []
    for (let i = 0; i < 42; i += 1) raw.push(new Date(y, m, i - firstDow + 1))
    if (raw[28] && raw[28].getMonth() !== m) return raw.slice(0, 28)
    if (raw[35] && raw[35].getMonth() === m) return raw
    return raw.slice(0, 35)
  }, [calMode, y, m, selectedDay])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    const pRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    for (const task of tasks) {
      const effectiveDay = task.due
        ? task.due.slice(0, 10)
        : task.list === 'today'
          ? todayKey
          : null
      if (!effectiveDay) continue
      const arr = map.get(effectiveDay) ?? []
      arr.push(task)
      map.set(effectiveDay, arr)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return (pRank[a.priority ?? ''] ?? 3) - (pRank[b.priority ?? ''] ?? 3)
      })
    }
    return map
  }, [tasks, todayKey])

  const unscheduledInbox = useMemo(
    () => tasks.filter((t) => !t.due && t.list === 'inbox' && !t.done),
    [tasks],
  )

  const todayAndOverdue = useMemo(
    () =>
      tasks
        .filter((t) => !t.done && (t.list === 'today' || (t.due && t.due.slice(0, 10) <= todayKey)))
        .sort((a, b) => {
          const pRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
          return (pRank[a.priority ?? ''] ?? 3) - (pRank[b.priority ?? ''] ?? 3)
        }),
    [tasks, todayKey],
  )

  const nextFocusTask = todayAndOverdue[0] ?? tasks.find((t) => !t.done && t.due && t.due >= todayKey) ?? null

  const streak = useMemo(() => computeActiveStreak(dayMap), [dayMap])
  const monthScheduledCount = useMemo(
    () =>
      [...tasksByDay.entries()]
        .filter(([k]) => k.startsWith(monthPrefix))
        .reduce((sum, [, list]) => sum + list.length, 0),
    [tasksByDay, monthPrefix],
  )
  const monthDoneCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.done &&
          ((t.due && t.due.startsWith(monthPrefix)) ||
            (t.completedAt && t.completedAt.startsWith(monthPrefix))),
      ).length,
    [tasks, monthPrefix],
  )

  const startDragTask = (event: React.DragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.setData(DRAG_TASK_MIME, taskId)
    event.dataTransfer.effectAllowed = 'move'
  }

  const scheduleTaskToDate = async (taskId: string, dayKeyStr: string) => {
    await onRun(
      'task.update',
      {
        id: taskId,
        due: dayKeyStr,
        list: dayKeyStr <= todayKey ? 'today' : 'later',
      },
      { toast: dayKeyStr === todayKey ? '已排期到今天' : `已排期至 ${dayKeyStr}` },
    )
  }

  const unscheduleTaskToInbox = async (taskId: string) => {
    await onRun(
      'task.update',
      { id: taskId, due: null, list: 'inbox' },
      { toast: '已取消排期，移回待排期收件箱' },
    )
  }

  const handleAddInbox = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = inboxDraft.trim()
    if (!val) return
    setInboxDraft('')
    await onRun('task.add', { title: val, list: 'inbox' }, { toast: '已加入待排期收件箱' })
  }

  const handleAddOnSelectedDay = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = dayDraft.trim()
    if (!val) return
    setDayDraft('')
    await onRun(
      'task.add',
      {
        title: val,
        due: selectedDay,
        list: selectedDay <= todayKey ? 'today' : 'later',
      },
      { toast: `已排期至 ${selectedDay}` },
    )
  }

  const selectedDayTasks = tasksByDay.get(selectedDay) ?? []

  return (
    <div className="sy-app-page" data-view="schedule">
      <div className="sy-schedule-layout">
        <section className="sy-cal-tile">
          <header className="sy-cal-head">
            <div className="sy-cal-num">{String(m + 1).padStart(2, '0')}</div>
            <div className="sy-cal-month">
              <span>{y}</span>
              <em>{MONTHS_EN[m]}</em>
            </div>
            <dl className="sy-cal-stats">
              <div>
                <dt>连续记录</dt>
                <dd>
                  {streak}
                  <small>天</small>
                </dd>
              </div>
              <div>
                <dt>本月排期</dt>
                <dd>
                  {monthScheduledCount}
                  <small>项</small>
                </dd>
              </div>
              <div>
                <dt>本月完成</dt>
                <dd>
                  {monthDoneCount}
                  <small>项</small>
                </dd>
              </div>
            </dl>
            <span className="grow" />
            <div className="sy-seg">
              <button
                type="button"
                aria-pressed={calMode === 'month'}
                onClick={() => setCalMode('month')}
              >
                月历
              </button>
              <button
                type="button"
                aria-pressed={calMode === 'week'}
                onClick={() => setCalMode('week')}
              >
                周视图
              </button>
            </div>
            <button
              type="button"
              className="sy-icon-btn"
              aria-label="上个月"
              onClick={() => setCursor(new Date(y, m - 1, 1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="sy-btn"
              onClick={() => {
                const now = new Date()
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
                setSelectedDay(todayKey)
              }}
            >
              今天
            </button>
            <button
              type="button"
              className="sy-icon-btn"
              aria-label="下个月"
              onClick={() => setCursor(new Date(y, m + 1, 1))}
            >
              ›
            </button>
          </header>

          <div className="sy-cal-weeks">
            {WEEK_HEADERS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div
            className={`sy-cal-grid${calMode === 'week' ? ' is-week' : ''}`}
            role="grid"
            style={{ '--cal-rows': Math.max(1, cells.length / 7) } as React.CSSProperties}
          >
            {cells.map((date) => {
              const key = toDayKey(date)
              const dayTasks = tasksByDay.get(key) ?? []
              const stamps = dayMap.get(key)
              const isToday = key === todayKey
              const isSelected = key === selectedDay
              const isOutside = calMode === 'month' && date.getMonth() !== m
              const maxShow = calMode === 'week' ? 8 : 3

              return (
                <div
                  key={key}
                  role="gridcell"
                  data-day={key}
                  className={`sy-cal-cell${isOutside ? ' is-outside' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${dragOverCell === key ? ' is-over' : ''}`}
                  onClick={() => setSelectedDay(key)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverCell(key)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverCell((cur) => (cur === key ? null : cur))
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverCell(null)
                    const taskId = e.dataTransfer.getData(DRAG_TASK_MIME)
                    if (taskId) void scheduleTaskToDate(taskId, key)
                  }}
                >
                  <div className="sy-cal-cell-top">
                    <span className="sy-cal-date">
                      {date.getDate()}
                      {isToday ? <small>今日</small> : null}
                    </span>
                    {stamps?.length || isToday ? (
                      <div className="sy-cal-stamp" onClick={(e) => e.stopPropagation()}>
                        <Stamp
                          list={stamps}
                          today={isToday}
                          label={`${date.getMonth() + 1}月${date.getDate()}日`}
                          onCaptureToday={onCaptureToday}
                          onOpen={() => setSelectedDay(key)}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="sy-cal-tasks" onClick={(e) => e.stopPropagation()}>
                    {dayTasks.slice(0, maxShow).map((task) => {
                      const subDone = (task.subtasks ?? []).filter((s) => s.done).length
                      const subTotal = (task.subtasks ?? []).length
                      return (
                        <div
                          key={task.id}
                          className={`sy-cal-chip${task.done ? ' is-done' : ''} prio-${task.priority || 'none'}`}
                          draggable
                          onDragStart={(e) => startDragTask(e, task.id)}
                          onClick={() => setEditingTask(task)}
                          title={task.title}
                        >
                          <button
                            type="button"
                            className={`sy-chk${task.done ? ' on' : ''}`}
                            aria-label={task.done ? '标记未完成' : '标记完成'}
                            onClick={(e) => {
                              e.stopPropagation()
                              void onRun('task.update', { id: task.id, done: !task.done })
                            }}
                          />
                          <span className="sy-cal-chip-title">{task.title}</span>
                          {subTotal > 0 ? (
                            <small className="sy-cal-chip-sub">
                              {subDone}/{subTotal}
                            </small>
                          ) : null}
                        </div>
                      )
                    })}
                    {dayTasks.length > maxShow ? (
                      <button
                        type="button"
                        className="sy-cal-more"
                        onClick={() => setSelectedDay(key)}
                      >
                        还有 {dayTasks.length - maxShow} 项
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sy-day-agenda">
            <div className="sy-day-agenda-head">
              <b>
                {selectedDay === todayKey ? `今日日程 (${selectedDay})` : `${selectedDay} 排期事项`}
              </b>
              <span className="meta">共 {selectedDayTasks.length} 项任务 · 点击任务可编辑优先级与子步骤</span>
            </div>
            <form className="sy-day-add-form" onSubmit={handleAddOnSelectedDay}>
              <input
                value={dayDraft}
                onChange={(e) => setDayDraft(e.target.value)}
                placeholder={`在 ${selectedDay} 新建一项排期任务，回车保存…`}
                aria-label={`在 ${selectedDay} 新建排期任务`}
              />
              <button type="submit" className="sy-btn sy-btn-ink" disabled={!dayDraft.trim()}>
                + 排入当天
              </button>
            </form>
            {selectedDayTasks.length > 0 ? (
              <div className="sy-day-agenda-list">
                {selectedDayTasks.map((task) => (
                  <div key={task.id} className={`sy-agenda-item${task.done ? ' is-done' : ''}`}>
                    <button
                      type="button"
                      className={`sy-chk${task.done ? ' on' : ''}`}
                      onClick={() => void onRun('task.update', { id: task.id, done: !task.done })}
                    />
                    <div className="sy-agenda-main" onClick={() => setEditingTask(task)}>
                      <b>{task.title}</b>
                      {task.note ? <p>{task.note}</p> : null}
                    </div>
                    {task.priority ? (
                      <span className={`sy-prio-badge prio-${task.priority}`}>
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </span>
                    ) : null}
                    {task.project ? <span className="sy-pill">{task.project}</span> : null}
                    <button type="button" className="sy-mini-act" onClick={() => setEditingTask(task)}>
                      详情
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="sy-schedule-rail">
          {nextFocusTask ? (
            <div className="sy-next-card" onClick={() => setEditingTask(nextFocusTask)} role="button" tabIndex={0}>
              <div className="sy-next-top">
                <span>今日聚焦 · 下一件事</span>
                <span>{nextFocusTask.due || '今天'}</span>
              </div>
              <strong className="sy-next-title">{nextFocusTask.title}</strong>
              {nextFocusTask.note ? <p className="sy-next-note">{nextFocusTask.note}</p> : null}
              <div className="sy-next-foot" onClick={(e) => e.stopPropagation()}>
                <span>
                  {nextFocusTask.project ? `${nextFocusTask.project} · ` : ''}
                  {nextFocusTask.priority ? `${PRIORITY_LABELS[nextFocusTask.priority]} · ` : ''}
                  {todayAndOverdue.length} 项今日待办
                </span>
                <button
                  type="button"
                  className="sy-btn sy-btn-ink"
                  onClick={() =>
                    void onRun('task.update', { id: nextFocusTask.id, done: true }, { toast: '已完成今日聚焦事项' })
                  }
                >
                  ✓ 完成
                </button>
              </div>
            </div>
          ) : (
            <div className="sy-next-card is-calm">
              <div className="sy-next-top">
                <span>今日聚焦</span>
                <span>{todayKey}</span>
              </div>
              <strong className="sy-next-title">今天的排期已经全部清空</strong>
              <p className="sy-next-note">可以从下方待排期收件箱把任务拖到日历任意一天。</p>
            </div>
          )}

          <section
            className={`sy-inbox-tray${dragOverTray ? ' is-over' : ''}`}
            aria-label="待排期收件箱"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverTray(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTray(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverTray(false)
              const taskId = e.dataTransfer.getData(DRAG_TASK_MIME)
              if (taskId) void unscheduleTaskToInbox(taskId)
            }}
          >
            <header className="sy-tray-head">
              <div>
                <h2>待排期 · Inbox ({unscheduledInbox.length})</h2>
                <span className="meta">拖到左侧日历即可排期；从日历拖回此处取消排期</span>
              </div>
            </header>

            <form className="sy-tray-add" onSubmit={handleAddInbox}>
              <input
                value={inboxDraft}
                onChange={(e) => setInboxDraft(e.target.value)}
                placeholder="先记下待办，稍后再拖上日历排期…"
                aria-label="新建待排期任务"
              />
              <button type="submit" className="sy-btn" disabled={!inboxDraft.trim()}>
                + 记入
              </button>
            </form>

            <div className="sy-tray-scroll">
              {unscheduledInbox.length === 0 ? (
                <p className="meta" style={{ padding: '16px 4px', textAlign: 'center' }}>
                  收件箱为空，所有待办均已排入日历。
                </p>
              ) : (
                unscheduledInbox.map((task) => (
                  <div
                    key={task.id}
                    className={`sy-tray-item prio-${task.priority || 'none'}`}
                    draggable
                    onDragStart={(e) => startDragTask(e, task.id)}
                    onClick={() => setEditingTask(task)}
                  >
                    <span className="sy-drag-grip" aria-hidden="true">
                      ⋮⋮
                    </span>
                    <div className="sy-tray-item-body">
                      <b>{task.title}</b>
                      <small>
                        {task.project ? `#${task.project} · ` : ''}
                        {task.priority ? PRIORITY_LABELS[task.priority] : '待排期'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="sy-mini-act"
                      title="排到今天"
                      onClick={(e) => {
                        e.stopPropagation()
                        void scheduleTaskToDate(task.id, todayKey)
                      }}
                    >
                      今天
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      {editingTask ? (
        <TaskDetailModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onRun={onRun}
        />
      ) : null}
    </div>
  )
}
