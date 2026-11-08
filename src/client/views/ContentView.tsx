import * as React from 'react'
import { safeUrl } from '../widgets/shared.tsx'
import {
  buildUnifiedEntries,
  KIND_BADGE_LABELS,
  KIND_FILTER_OPTIONS,
  MediaCollectionCard,
  relativeTimeShort,
  STATUS_OPTIONS,
  type UnifiedCardEntry,
} from './Cards.tsx'
import type { ContentStatus, FeedItem, ItemSnapshot, Note } from '../../shared/domain.ts'

const { useState, useMemo } = React

export function ContentView({
  notes,
  readLaterEntries,
  bookmarks,
  feedItems,
  onOpenEntry,
  onOpenCapture,
  onRun,
}: {
  notes: readonly Note[]
  readLaterEntries: Record<string, ItemSnapshot>
  bookmarks: readonly { name: string; url: string }[]
  feedItems: readonly FeedItem[]
  onOpenEntry: (entry: UnifiedCardEntry) => void
  onOpenCapture: (tab: 'note' | 'collection' | 'batch') => void
  onRun: (name: string, body: Record<string, any>, opts?: { toast?: string }) => Promise<any>
}) {
  const [mode, setMode] = useState<'board' | 'table'>('board')
  const [boardGroup, setBoardGroup] = useState<'kind' | 'status'>('kind')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: 'title' | 'kind' | 'status' | 'createdAt'; dir: 1 | -1 }>({
    key: 'createdAt',
    dir: -1,
  })

  const allEntries = useMemo(
    () => buildUnifiedEntries(notes, readLaterEntries, bookmarks, feedItems, false),
    [notes, readLaterEntries, bookmarks, feedItems],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allEntries.filter((entry) => {
      if (kindFilter !== 'all' && entry.kind !== kindFilter) return false
      if (!q) return true
      return [
        entry.title,
        entry.body,
        entry.sourceLabel,
        KIND_BADGE_LABELS[entry.kind],
        ...entry.tags,
        entry.meta?.language,
        entry.meta?.author,
      ].some((v) => String(v ?? '').toLowerCase().includes(q))
    })
  }, [allEntries, kindFilter, search])

  const noteCount = allEntries.filter((e) => e.entryType === 'note').length
  const colCount = allEntries.filter((e) => e.entryType === 'collection').length
  const curatedCount = allEntries.filter((e) => e.status === 'curated').length

  const handleDragStart = (event: React.DragEvent<HTMLElement>, entry: UnifiedCardEntry) => {
    event.dataTransfer.setData('text/sooyo-entry-id', entry.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDropStatus = async (status: ContentStatus, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragOverCol(null)
    const id = event.dataTransfer.getData('text/sooyo-entry-id')
    const entry = allEntries.find((e) => e.id === id)
    if (!entry || entry.status === status) return
    if (entry.entryType === 'note' && entry.rawNote) {
      await onRun('note.update', { id: entry.rawNote.id, status }, { toast: `已移至「${STATUS_OPTIONS.find((s) => s.value === status)?.label}」` })
    } else if (entry.rawCollection?.id) {
      await onRun(
        'collection.save',
        {
          ...entry.rawCollection,
          id: entry.rawCollection.id,
          status,
        },
        { toast: `已移至「${STATUS_OPTIONS.find((s) => s.value === status)?.label}」` },
      )
    }
  }

  const handleQuickTask = (entry: UnifiedCardEntry) => {
    void onRun(
      'task.add',
      {
        title: entry.title.slice(0, 120),
        origin: { title: entry.title, url: entry.url || undefined, source: entry.sourceLabel },
      },
      { toast: '已加入待排期收件箱（Inbox）' },
    )
  }

  const kindColumns = [
    {
      id: 'memo',
      title: '速记与灵感备忘',
      dot: 'note',
      rows: filtered.filter((e) => e.kind === 'note'),
    },
    {
      id: 'code-social',
      title: 'GitHub Stars & X 收藏',
      dot: 'github',
      rows: filtered.filter((e) => e.kind === 'github' || e.kind === 'x'),
    },
    {
      id: 'web-article',
      title: '收藏网站与文章',
      dot: 'web',
      rows: filtered.filter((e) => e.kind === 'web' || e.kind === 'article'),
    },
    {
      id: 'media',
      title: '图片 · 音乐 · 视频元信息',
      dot: 'media',
      rows: filtered.filter((e) => e.kind === 'image' || e.kind === 'music' || e.kind === 'video'),
    },
  ]

  const sortedTable = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = String(a[sort.key] ?? '')
      const bv = String(b[sort.key] ?? '')
      return av.localeCompare(bv) * sort.dir
    })
  }, [filtered, sort])

  return (
    <div className="sy-app-page" data-view="content">
      <header className="sy-view-head">
        <div>
          <h1 className="sy-view-title">内容 · 收藏与速记库</h1>
          <p className="sy-view-sub">
            {`共 ${allEntries.length} 条记录 · ${noteCount} 条速记备忘 · ${colCount} 条多媒介收藏 · ${curatedCount} 条精选常看`}
          </p>
        </div>
        <div className="sy-view-controls">
          <label className="sy-search-pill">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题、说明、标签、GitHub/X…"
              aria-label="搜索内容"
            />
          </label>
          <div className="sy-seg">
            <button
              type="button"
              aria-pressed={mode === 'board'}
              onClick={() => setMode('board')}
            >
              看板
            </button>
            <button
              type="button"
              aria-pressed={mode === 'table'}
              onClick={() => setMode('table')}
            >
              表格
            </button>
          </div>
          {mode === 'board' ? (
            <div className="sy-seg">
              <button
                type="button"
                aria-pressed={boardGroup === 'kind'}
                onClick={() => setBoardGroup('kind')}
              >
                按媒介
              </button>
              <button
                type="button"
                aria-pressed={boardGroup === 'status'}
                onClick={() => setBoardGroup('status')}
              >
                按状态
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="sy-btn"
            onClick={() => onOpenCapture('batch')}
          >
            批量导入
          </button>
          <button
            type="button"
            className="sy-btn sy-btn-ink"
            onClick={() => onOpenCapture('collection')}
          >
            + 录入收藏 / 速记
          </button>
        </div>
      </header>

      <div className="sy-filter-bar" role="toolbar" aria-label="按媒介类型筛选">
        {KIND_FILTER_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            className={`sy-chip${kindFilter === opt.value ? ' is-on' : ''}`}
            onClick={() => setKindFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="sy-empty-box">
          <b>{search ? '没有匹配的收藏或速记' : '还没有收藏或速记记录'}</b>
          <p>在首页一句话记下备忘灵感，或把你的 GitHub Stars、X 收藏、网站、图片、音视频元信息存进来。</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
            <button type="button" className="sy-btn sy-btn-ink" onClick={() => onOpenCapture('collection')}>
              + 录入第一条收藏
            </button>
            <button type="button" className="sy-btn" onClick={() => onOpenCapture('batch')}>
              粘贴 JSON/CSV 批量入库
            </button>
          </div>
        </div>
      ) : mode === 'board' ? (
        boardGroup === 'status' ? (
          <div className="sy-kanban-board" data-cols="3">
            {STATUS_OPTIONS.map((col) => {
              const rows = filtered.filter((e) => e.status === col.value)
              return (
                <section
                  key={col.value}
                  className={`sy-kanban-col${dragOverCol === col.value ? ' is-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverCol(col.value)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null)
                  }}
                  onDrop={(e) => void handleDropStatus(col.value, e)}
                >
                  <header className="sy-kanban-head">
                    <span className={`sy-mcard-dot status-${col.value}`} />
                    <h3>{col.label}</h3>
                    <span className="meta">{rows.length}</span>
                  </header>
                  <div className="sy-kanban-list">
                    {rows.map((entry) => (
                      <MediaCollectionCard
                        key={entry.id}
                        entry={entry}
                        draggable
                        onDragStart={handleDragStart}
                        onOpen={onOpenEntry}
                        onQuickTask={handleQuickTask}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="sy-kanban-board" data-cols="4">
            {kindColumns.map((col) => (
              <section key={col.id} className="sy-kanban-col">
                <header className="sy-kanban-head">
                  <span className={`sy-mcard-dot kind-${col.dot}`} />
                  <h3>{col.title}</h3>
                  <span className="meta">{col.rows.length}</span>
                </header>
                <div className="sy-kanban-list">
                  {col.rows.map((entry) => (
                    <MediaCollectionCard
                      key={entry.id}
                      entry={entry}
                      onOpen={onOpenEntry}
                      onQuickTask={handleQuickTask}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="sy-table-wrap">
          <table className="sy-data-table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: 'title', dir: s.key === 'title' ? (s.dir === 1 ? -1 : 1) : 1 }))}
                  >
                    标题与说明
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: 'kind', dir: s.key === 'kind' ? (s.dir === 1 ? -1 : 1) : 1 }))}
                  >
                    类别 / 来源
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: 'status', dir: s.key === 'status' ? (s.dir === 1 ? -1 : 1) : 1 }))}
                  >
                    状态
                  </button>
                </th>
                <th>标签 / 元信息</th>
                <th>链接 / 飞书</th>
                <th>
                  <button
                    type="button"
                    onClick={() =>
                      setSort((s) => ({ key: 'createdAt', dir: s.key === 'createdAt' ? (s.dir === 1 ? -1 : 1) : -1 }))
                    }
                  >
                    记录于
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTable.map((entry) => (
                <tr key={entry.id} onClick={() => onOpenEntry(entry)} tabIndex={0}>
                  <td className="sy-td-main">
                    <span className="sy-td-thumb">
                      {entry.thumbnail ? (
                        <img src={entry.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{entry.title.slice(0, 1)}</span>
                      )}
                    </span>
                    <div>
                      <strong>{entry.title}</strong>
                      {entry.body ? <small>{entry.body.slice(0, 90)}</small> : null}
                    </div>
                  </td>
                  <td>
                    <span className={`sy-mcard-pill kind-${entry.kind}`}>
                      {KIND_BADGE_LABELS[entry.kind] ?? entry.kind}
                    </span>
                    <div className="meta">{entry.sourceLabel}</div>
                  </td>
                  <td>
                    <span className={`sy-status-pill status-${entry.status}`}>
                      {STATUS_OPTIONS.find((s) => s.value === entry.status)?.label ?? entry.status}
                    </span>
                  </td>
                  <td>
                    <div className="sy-mcard-tags">
                      {entry.tags.map((t) => (
                        <span key={t} className="sy-mcard-tag">
                          #{t}
                        </span>
                      ))}
                      {entry.meta?.language ? <span className="sy-mcard-meta-tag">{entry.meta.language}</span> : null}
                      {entry.meta?.stars ? <span className="sy-mcard-meta-tag">★ {entry.meta.stars}</span> : null}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row">
                      {entry.url ? (
                        <a className="sy-mini-act" href={safeUrl(entry.url)} target="_blank" rel="noopener noreferrer">
                          源链 ↗
                        </a>
                      ) : null}
                      {entry.externalUrl ? (
                        <a
                          className="sy-mini-act"
                          href={safeUrl(entry.externalUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          飞书 ↗
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="meta">{relativeTimeShort(entry.createdAt) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
