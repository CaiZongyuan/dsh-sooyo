import * as React from 'react'
import type {
  DailySnapshot,
  FeedItem,
  Proposal,
  RetrospectiveRecord,
} from '../../shared/domain.ts'
import { KIND_BADGE_LABELS, buildUnifiedEntries, type UnifiedCardEntry } from './Cards.tsx'
import { buildDayFootprintMap, computeActiveStreak, toDayKey } from './Stamps.tsx'

const { useState, useMemo, useEffect } = React

function currentWeekKey(today: string): string {
  const date = new Date(`${today}T00:00:00`)
  const jan1 = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - jan1.getTime()) / 86400000)
  const week = Math.ceil((days + jan1.getDay() + 1) / 7)
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function isoDayOffset(baseIso: string, deltaDays: number): string {
  const date = new Date(`${baseIso.slice(0, 10)}T12:00:00`)
  date.setDate(date.getDate() + deltaDays)
  return toDayKey(date)
}

function TrendChart({
  points,
}: {
  points: { date: string; tasks: number; captures: number; total: number }[]
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const width = 460
  const height = 170
  const padL = 26
  const padR = 12
  const padT = 16
  const padB = 26
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const maxVal = Math.max(4, ...points.map((point) => point.total))
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW

  const coords = points.map((point, index) => ({
    x: padL + index * stepX,
    y: padT + innerH - (point.total / maxVal) * innerH,
    yTask: padT + innerH - (point.tasks / maxVal) * innerH,
    ...point,
  }))

  const linePath = coords
    .map((pt, index) => `${index === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ')
  const lastCoord = coords[coords.length - 1]
  const firstCoord = coords[0]
  const areaPath =
    lastCoord && firstCoord
      ? `${linePath} L${lastCoord.x.toFixed(1)},${(padT + innerH).toFixed(1)} L${firstCoord.x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : ''

  const hovered = hoverIdx !== null ? coords[hoverIdx] : lastCoord

  return (
    <div className="sy-chart-wrap">
      {hovered ? (
        <div className="sy-chart-stat">
          <span className="mono">{hovered.date.slice(5)}</span>
          <span>
            完成 <b>{hovered.tasks}</b> 项 · 收录/速记 <b>{hovered.captures}</b> 条
          </span>
        </div>
      ) : null}
      <svg
        className="sy-chart"
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="syRetroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sy-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--sy-accent)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = padT + innerH * (1 - ratio)
          const val = Math.round(maxVal * ratio)
          return (
            <g key={idx}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--sy-line)"
                strokeDasharray={ratio === 0 ? undefined : '3 3'}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--sy-ink3)"
                fontFamily="var(--sy-mono)"
              >
                {val}
              </text>
            </g>
          )
        })}
        {areaPath ? <path d={areaPath} fill="url(#syRetroGrad)" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="var(--sy-accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {coords.map((pt, index) => (
          <g
            key={pt.date}
            onMouseEnter={() => setHoverIdx(index)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={pt.x - stepX / 2}
              y={padT}
              width={Math.max(12, stepX)}
              height={innerH}
              fill="transparent"
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === index ? 4.5 : 2.8}
              fill={hoverIdx === index ? 'var(--sy-accent)' : 'var(--sy-card)'}
              stroke="var(--sy-accent)"
              strokeWidth="2"
            />
            {index % 3 === 0 || index === coords.length - 1 ? (
              <text
                x={pt.x}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--sy-ink3)"
                fontFamily="var(--sy-mono)"
              >
                {pt.date.slice(5)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  )
}

export function RetroView({
  daily,
  items,
  onRun,
  onNavigate,
  onOpenEntry,
}: {
  daily: DailySnapshot | null
  items: readonly FeedItem[]
  onRun: (
    actionName: string,
    payload: Record<string, unknown>,
    options?: { toast?: string },
  ) => Promise<unknown>
  onNavigate: (view: 'home' | 'content' | 'schedule' | 'retro') => void
  onOpenEntry: (entry: UnifiedCardEntry) => void
}) {
  const today = toDayKey(new Date())
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [trendMode, setTrendMode] = useState<'chart' | 'table'>('chart')

  const periodKey = useMemo(() => {
    if (period === 'day') return today
    if (period === 'week') return currentWeekKey(today)
    return today.slice(0, 7)
  }, [period, today])

  const existingRetro: RetrospectiveRecord | undefined = daily?.retros?.[periodKey]

  const [highlights, setHighlights] = useState('')
  const [blockers, setBlockers] = useState('')
  const [nextFocus, setNextFocus] = useState('')

  useEffect(() => {
    setHighlights(existingRetro?.highlights ?? '')
    setBlockers(existingRetro?.blockers ?? '')
    setNextFocus(existingRetro?.nextFocus ?? '')
  }, [periodKey, existingRetro?.updatedAt])

  const dayMap = useMemo(
    () =>
      buildDayFootprintMap(
        daily?.notes ?? [],
        daily?.tasks ?? [],
        daily?.readLaterEntries ?? {},
        daily?.retros ?? {},
      ),
    [daily?.notes, daily?.tasks, daily?.readLaterEntries, daily?.retros],
  )
  const streak = useMemo(() => computeActiveStreak(dayMap), [dayMap])

  const entries = useMemo(
    () =>
      buildUnifiedEntries(
        daily?.notes ?? [],
        daily?.readLaterEntries ?? {},
        daily?.bookmarks ?? [],
        items,
        false,
      ),
    [daily?.notes, daily?.readLaterEntries, daily?.bookmarks, items],
  )
  const tasks = daily?.tasks ?? []
  const habits = daily?.habits ?? []
  const proposals: readonly Proposal[] = daily?.agentInbox ?? []

  const rangeDays = period === 'day' ? 1 : period === 'week' ? 7 : 30
  const cutoffIso = isoDayOffset(today, -(rangeDays - 1))

  const periodStats = useMemo(() => {
    let completedCount = 0
    let createdNotesAndCollections = 0
    for (let offset = -(rangeDays - 1); offset <= 0; offset += 1) {
      const date = isoDayOffset(today, offset)
      const list = dayMap.get(date) ?? []
      for (const item of list) {
        if (item.kind === 'task') completedCount += 1
        if (item.kind === 'note' || item.kind === 'collection') createdNotesAndCollections += 1
      }
    }
    const openTodayOrOverdue = tasks.filter(
      (task) => !task.done && (task.list === 'today' || (task.due && task.due <= today)),
    )
    const activeProjects = new Map<string, { total: number; done: number }>()
    for (const task of tasks) {
      const proj = task.project?.trim() || '未分类日常'
      const cur = activeProjects.get(proj) ?? { total: 0, done: 0 }
      cur.total += 1
      if (task.done) cur.done += 1
      activeProjects.set(proj, cur)
    }
    const sortedProjects = [...activeProjects.entries()].sort((a, b) => b[1].total - a[1].total)

    const kindCounts = new Map<string, number>()
    for (const entry of entries) {
      if (entry.createdAt.slice(0, 10) >= cutoffIso || period !== 'day') {
        kindCounts.set(entry.kind, (kindCounts.get(entry.kind) ?? 0) + 1)
      }
    }

    return {
      completedCount,
      createdNotesAndCollections,
      openTodayOrOverdue,
      sortedProjects,
      kindCounts,
      focusMin: daily?.focus?.totalMinutesToday ?? daily?.focus?.minutes ?? 0,
    }
  }, [
    rangeDays,
    today,
    dayMap,
    tasks,
    entries,
    cutoffIso,
    period,
    daily?.focus?.totalMinutesToday,
    daily?.focus?.minutes,
  ])

  const trendPoints = useMemo(() => {
    const out: { date: string; tasks: number; captures: number; total: number }[] = []
    for (let offset = -13; offset <= 0; offset += 1) {
      const date = isoDayOffset(today, offset)
      const list = dayMap.get(date) ?? []
      const t = list.filter((item) => item.kind === 'task').length
      const c = list.filter((item) => item.kind === 'note' || item.kind === 'collection').length
      out.push({
        date,
        tasks: t,
        captures: c,
        total: list.length,
      })
    }
    return out
  }, [dayMap, today])

  const topProjectName = periodStats.sortedProjects[0]?.[0] ?? '日常事项'
  const recentHighlights = useMemo(() => entries.slice(0, 3), [entries])

  const handleSaveRetro = (event: React.FormEvent) => {
    event.preventDefault()
    void onRun(
      'retro.save',
      {
        key: periodKey,
        period,
        highlights: highlights.trim(),
        blockers: blockers.trim(),
        nextFocus: nextFocus.trim(),
      },
      { toast: `已保存「${periodKey}」个人复盘` },
    )
  }

  const handleRolloverOpenTasks = async () => {
    for (const task of periodStats.openTodayOrOverdue) {
      await onRun('task.update', { id: task.id, due: today, list: 'today' })
    }
  }

  const handleNextFocusToTask = () => {
    const firstLine = nextFocus
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
      .find(Boolean)
    if (!firstLine) return
    void onRun(
      'task.add',
      { title: firstLine.slice(0, 80), list: 'today', due: today, priority: 'high' },
      { toast: `已加入今日排期：${firstLine.slice(0, 24)}` },
    )
  }

  return (
    <div className="sy-view-retro" data-view="retro">
      <div className="sy-view-toolbar">
        <div className="sy-view-toolbar-left">
          <div className="sy-seg sm" role="tablist" aria-label="复盘周期">
            <button
              type="button"
              role="tab"
              aria-selected={period === 'day'}
              onClick={() => setPeriod('day')}
            >
              今日复盘
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={period === 'week'}
              onClick={() => setPeriod('week')}
            >
              本周复盘
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={period === 'month'}
              onClick={() => setPeriod('month')}
            >
              本月复盘
            </button>
          </div>
          <span className="meta">{`周期标识：${periodKey} · 连续活跃 ${streak} 天`}</span>
        </div>
        <div className="sy-view-toolbar-right">
          {periodStats.openTodayOrOverdue.length > 0 ? (
            <button
              type="button"
              className="sy-btn"
              onClick={() => void handleRolloverOpenTasks()}
            >
              {`顺延 ${periodStats.openTodayOrOverdue.length} 项未完待办到今天`}
            </button>
          ) : null}
          <button
            type="button"
            className="sy-btn"
            onClick={() => onNavigate('schedule')}
          >
            打开排期日历 →
          </button>
        </div>
      </div>

      <div className="sy-retro-grid">
        {/* 1. Narrative Hero Tile (8 cols) */}
        <section className="sy-retro-tile sy-retro-hero">
          <div>
            <div className="sy-retro-eyebrow">
              {period === 'day'
                ? 'DAILY RETROSPECTIVE · 今日小结'
                : period === 'week'
                  ? 'WEEKLY RETROSPECTIVE · 本周复盘'
                  : 'MONTHLY RETROSPECTIVE · 月度复盘'}
            </div>
            <h2 className="sy-retro-title">
              {period === 'day' ? '今天' : period === 'week' ? '最近 7 天' : '最近 30 天'}共完成了{' '}
              <em>{periodStats.completedCount} 项任务</em>，收录了{' '}
              <b>{periodStats.createdNotesAndCollections} 条灵感与偏好收藏</b>；重心集中在「
              <b>{topProjectName}</b>」，当前还有{' '}
              <b>{periodStats.openTodayOrOverdue.length} 项今日待办</b>等待收尾。
            </h2>
          </div>

          <div className="sy-retro-metrics">
            <div className="sy-retro-metric">
              <span className="num">{periodStats.completedCount}</span>
              <span className="lbl">已完成任务</span>
            </div>
            <div className="sy-retro-metric">
              <span className="num">{periodStats.focusMin}</span>
              <span className="lbl">今日专注分钟</span>
            </div>
            <div className="sy-retro-metric">
              <span className="num">{entries.length}</span>
              <span className="lbl">偏好与速记总数</span>
            </div>
            <div className="sy-retro-metric">
              <span className="num">{`${streak}d`}</span>
              <span className="lbl">连续记录天数</span>
            </div>
          </div>
        </section>

        {/* 2. Trend Chart Tile (4 cols) */}
        <section className="sy-retro-tile sy-retro-trend">
          <div className="sy-retro-tile-h">
            <div>
              <h3>近 14 日节奏曲线</h3>
              <span className="meta">任务完成 + 灵感与收藏收录</span>
            </div>
            <div className="sy-seg sm">
              <button
                type="button"
                aria-selected={trendMode === 'chart'}
                onClick={() => setTrendMode('chart')}
              >
                图
              </button>
              <button
                type="button"
                aria-selected={trendMode === 'table'}
                onClick={() => setTrendMode('table')}
              >
                表
              </button>
            </div>
          </div>
          {trendMode === 'chart' ? (
            <TrendChart points={trendPoints} />
          ) : (
            <div className="sy-retro-mini-table">
              {trendPoints
                .slice()
                .reverse()
                .slice(0, 6)
                .map((row) => (
                  <div key={row.date} className="sy-retro-mini-row">
                    <span className="mono">{row.date}</span>
                    <span>{`完成 ${row.tasks} · 收录 ${row.captures}`}</span>
                    <b className="mono">{row.total}</b>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* 3. Distribution Tile (4 cols) */}
        <section className="sy-retro-tile sy-retro-dist">
          <div className="sy-retro-tile-h">
            <div>
              <h3>项目推进与收藏构成</h3>
              <span className="meta">工作进度与输入偏好分布</span>
            </div>
          </div>

          <div className="sy-dist-list">
            <div className="sy-dist-subhead">项目完成度</div>
            {periodStats.sortedProjects.slice(0, 3).map(([proj, stat]) => {
              const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0
              return (
                <div key={proj} className="sy-dist-row">
                  <div className="sy-dist-label">
                    <b>{proj}</b>
                    <span className="mono">{`${stat.done}/${stat.total} (${pct}%)`}</span>
                  </div>
                  <div className="sy-dist-bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}

            <div className="sy-dist-subhead" style={{ marginTop: 8 }}>
              偏好内容分布
            </div>
            {(['note', 'github', 'x', 'video', 'web'] as const).map((kind) => {
              const count = periodStats.kindCounts.get(kind) ?? 0
              const pct = entries.length > 0 ? Math.round((count / entries.length) * 100) : 0
              const label = KIND_BADGE_LABELS[kind] ?? kind
              return (
                <div key={kind} className="sy-dist-row">
                  <div className="sy-dist-label">
                    <span>{label}</span>
                    <span className="mono">{`${count} 条`}</span>
                  </div>
                  <div className="sy-dist-bar">
                    <i style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }} />
                  </div>
                </div>
              )
            })}

            {habits.length > 0 ? (
              <>
                <div className="sy-dist-subhead" style={{ marginTop: 8 }}>
                  习惯打卡
                </div>
                <div className="sy-chips">
                  {habits.map((habit) => {
                    const doneToday = habit.lastTickDate === today
                    return (
                      <button
                        key={habit.id}
                        type="button"
                        className="sy-chipbtn"
                        aria-pressed={doneToday}
                        data-act="habit-tick"
                        data-habit={habit.id}
                      >
                        {`${doneToday ? '✓ ' : ''}${habit.name} (${habit.streak ?? 0}d)`}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* 4. Personal Reflection Form & Recent Highlights (4 cols) */}
        <section className="sy-retro-tile sy-retro-reflect">
          <div className="sy-retro-tile-h">
            <div>
              <h3>个人复盘手记 · {periodKey}</h3>
              <span className="meta">沉淀关键收获，飞书长文可贴在内容库</span>
            </div>
          </div>

          <form className="sy-retro-form" onSubmit={handleSaveRetro}>
            <label className="sy-fld">
              <span>✨ 本期高光与关键产出</span>
              <textarea
                name="retro-highlights"
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
                rows={2}
                placeholder="这周/今天最有价值的一件事是什么？"
              />
            </label>
            <label className="sy-fld">
              <span>🚧 卡点与精力复盘</span>
              <textarea
                name="retro-blockers"
                value={blockers}
                onChange={(event) => setBlockers(event.target.value)}
                rows={2}
                placeholder="哪里拖慢了节奏？下次如何规避？"
              />
            </label>
            <label className="sy-fld">
              <span>🎯 下一阶段聚焦（可一键转待办）</span>
              <textarea
                name="retro-next-focus"
                value={nextFocus}
                onChange={(event) => setNextFocus(event.target.value)}
                rows={2}
                placeholder="写下接下来最重要的一件事..."
              />
            </label>
            <div className="sy-retro-form-foot">
              {nextFocus.trim() ? (
                <button
                  type="button"
                  className="sy-btn"
                  onClick={handleNextFocusToTask}
                >
                  转为今日任务
                </button>
              ) : null}
              <button type="submit" className="sy-btn sy-btn-ink" data-act="retro-save">
                保存复盘记录
              </button>
            </div>
          </form>

          {recentHighlights.length > 0 ? (
            <div className="sy-retro-recent">
              <div className="sy-dist-subhead">最新收录与闪念</div>
              {recentHighlights.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="sy-retro-recent-item"
                  onClick={() => onOpenEntry(entry)}
                >
                  <span className="badge">{KIND_BADGE_LABELS[entry.kind] ?? entry.kind}</span>
                  <span className="c1">{entry.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/* 5. Agent Review Advice & Inbox Proposals (4 cols) */}
        <section className="sy-retro-tile sy-retro-advice">
          <div className="sy-retro-tile-h">
            <div>
              <h3>Agent 复盘建议与行动</h3>
              <span className="meta">基于当前待办、收藏与复盘提议</span>
            </div>
          </div>

          <div className="sy-advice-list">
            {proposals.map((proposal) => {
              const applied = proposal.status === 'applied'
              return (
                <div key={proposal.id} className="sy-advice-card">
                  <div className="sy-advice-top">
                    <span className="sy-pill">{applied ? '已生效' : 'Agent 提议'}</span>
                    <b>{proposal.reason}</b>
                  </div>
                  <div className="sy-advice-acts">
                    {applied ? (
                      <button
                        type="button"
                        className="sy-btn"
                        data-act="proposal-rollback"
                        data-proposal={proposal.id}
                      >
                        撤销改动
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="sy-btn sy-btn-ink"
                          data-act="proposal-approve"
                          data-proposal={proposal.id}
                        >
                          采纳并执行
                        </button>
                        <button
                          type="button"
                          className="sy-btn"
                          data-act="proposal-reject"
                          data-proposal={proposal.id}
                        >
                          忽略
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="sy-advice-card">
              <div className="sy-advice-top">
                <span className="sy-pill">智能洞察</span>
                <b>
                  {periodStats.openTodayOrOverdue.length > 0
                    ? `今日还有 ${periodStats.openTodayOrOverdue.length} 项待办未收尾`
                    : '今日排期已全部清空'}
                </b>
              </div>
              <p>
                {periodStats.openTodayOrOverdue[0]
                  ? `建议优先完成「${periodStats.openTodayOrOverdue[0].title}」，或进入排期日历拖拽调整日期。`
                  : '可以前往「内容」库整理近期收藏的 GitHub Stars、X 书签与视频，或开启下一轮专注。'}
              </p>
              <div className="sy-advice-acts">
                <button
                  type="button"
                  className="sy-btn"
                  onClick={() =>
                    onNavigate(periodStats.openTodayOrOverdue.length > 0 ? 'schedule' : 'content')
                  }
                >
                  {periodStats.openTodayOrOverdue.length > 0
                    ? '去排期日历调整 →'
                    : '去内容库整理收藏 →'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
