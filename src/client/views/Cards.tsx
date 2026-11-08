import * as React from 'react'
import { safeUrl } from '../widgets/shared.tsx'
import { hashCode } from './Stamps.tsx'
import type {
  CollectionKind,
  ContentStatus,
  FeedItem,
  ItemSnapshot,
  Note,
  TaskPriority,
} from '../../shared/domain.ts'

const { useState, useEffect } = React

export interface UnifiedCardEntry {
  id: string
  entryType: 'note' | 'collection' | 'feed'
  kind: 'note' | CollectionKind
  status: ContentStatus
  title: string
  body: string
  url: string
  externalUrl: string | null
  thumbnail: string | null
  sourceLabel: string
  tags: string[]
  meta: Record<string, any> | null
  createdAt: string
  rawNote?: Note
  rawCollection?: ItemSnapshot
  rawFeed?: FeedItem
}

export const KIND_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'note', label: '速记备忘' },
  { value: 'github', label: 'GitHub' },
  { value: 'x', label: 'X 收藏' },
  { value: 'web', label: '网站' },
  { value: 'image', label: '图片' },
  { value: 'music', label: '音乐' },
  { value: 'video', label: '视频' },
]

export const KIND_BADGE_LABELS: Record<string, string> = {
  note: '速记备忘',
  github: 'GitHub',
  x: 'X 收藏',
  web: '网站',
  image: '图片',
  music: '音乐',
  video: '视频',
  article: '精选资讯',
}

export const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: 'inbox', label: '待看 / 未整理' },
  { value: 'curated', label: '精选常看' },
  { value: 'archived', label: '已归档' },
]

export function detectKindFromUrl(url: string, fallback: CollectionKind = 'web'): CollectionKind {
  const u = String(url ?? '').trim()
  if (!u) return fallback
  if (/github\.com\//i.test(u)) return 'github'
  if (/(^|\/\/|\.)(x\.com|twitter\.com)\//i.test(u)) return 'x'
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u)) return 'image'
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /(youtube\.com|youtu\.be|bilibili\.com|b23\.tv|vimeo\.com)/i.test(u)) return 'video'
  if (/\.(mp3|flac|wav|ogg|m4a)(\?|$)/i.test(u) || /(music\.163\.com|y\.qq\.com|spotify\.com|music\.apple\.com|soundcloud\.com)/i.test(u)) return 'music'
  return fallback
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function relativeTimeShort(iso?: string | null): string {
  if (!iso) return ''
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
  const days = Math.floor(diffSec / 86400)
  if (days < 30) return `${days}天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function buildUnifiedEntries(
  notes: readonly Note[],
  readLaterEntries: Record<string, ItemSnapshot>,
  bookmarks: readonly { name: string; url: string }[],
  feedItems: readonly FeedItem[],
  includeFeed = true,
): UnifiedCardEntry[] {
  const list: UnifiedCardEntry[] = []
  const seenUrls = new Set<string>()

  for (const note of notes) {
    const firstLine = (note.title || note.text.split(/[。！？\n]/)[0] || note.text).slice(0, 64)
    const restBody = note.title ? note.text : (note.text.length > firstLine.length ? note.text : '')
    list.push({
      id: `note:${note.id}`,
      entryType: 'note',
      kind: 'note',
      status: (note.status as ContentStatus) || 'inbox',
      title: firstLine || '速记',
      body: restBody,
      url: note.origin?.url ?? '',
      externalUrl: note.externalUrl ?? null,
      thumbnail: null,
      sourceLabel: note.origin?.source ?? note.origin?.title ?? '灵感速记',
      tags: Array.isArray(note.tags) ? note.tags : [],
      meta: null,
      createdAt: note.createdAt || new Date().toISOString(),
      rawNote: note,
    })
  }

  for (const [id, snap] of Object.entries(readLaterEntries ?? {})) {
    if (!snap || typeof snap !== 'object') continue
    const k = (snap.kind as CollectionKind) || detectKindFromUrl(snap.url || '', 'article')
    if (snap.url) seenUrls.add(snap.url)
    list.push({
      id: `col:${id}`,
      entryType: 'collection',
      kind: k,
      status: (snap.status as ContentStatus) || 'inbox',
      title: snap.title || '(未命名收藏)',
      body: snap.summary || snap.tldr || snap.reason || '',
      url: snap.url || '',
      externalUrl: snap.externalUrl ?? null,
      thumbnail: snap.thumbnail ?? snap.cover ?? null,
      sourceLabel: snap.sourceLabel || snap.origin || hostOfUrl(snap.url || '') || KIND_BADGE_LABELS[k] || '收藏',
      tags: Array.isArray(snap.tags) ? snap.tags : [],
      meta: (snap.meta as Record<string, any>) ?? (snap.metrics as Record<string, any>) ?? null,
      createdAt: snap.savedAt || snap.publishedAt || new Date().toISOString(),
      rawCollection: { ...snap, id },
    })
  }

  for (let i = 0; i < bookmarks.length; i += 1) {
    const bm = bookmarks[i]!
    if (!bm?.url || seenUrls.has(bm.url)) continue
    seenUrls.add(bm.url)
    const k = detectKindFromUrl(bm.url, 'web')
    list.push({
      id: `bm:${i}-${bm.name}`,
      entryType: 'collection',
      kind: k,
      status: 'curated',
      title: bm.name,
      body: hostOfUrl(bm.url),
      url: bm.url,
      externalUrl: null,
      thumbnail: null,
      sourceLabel: hostOfUrl(bm.url) || '常用网站',
      tags: ['常用书签'],
      meta: null,
      createdAt: '',
      rawCollection: {
        id: `bm-${i}`,
        title: bm.name,
        url: bm.url,
        kind: k,
        status: 'curated',
        sourceLabel: hostOfUrl(bm.url) || '网站',
      },
    })
  }

  if (includeFeed) {
    for (const item of feedItems.slice(0, 18)) {
      if (item.url && seenUrls.has(item.url)) continue
      const k: CollectionKind = item.sourceId === 'youtube' || item.kind === 'episode' || item.kind === 'short'
        ? 'video'
        : 'article'
      list.push({
        id: `feed:${item.id}`,
        entryType: 'feed',
        kind: k,
        status: 'inbox',
        title: item.title,
        body: item.tldr || item.summary || item.reason || '',
        url: item.url,
        externalUrl: null,
        thumbnail: item.thumbnail ?? item.cover ?? null,
        sourceLabel: item.sourceLabel || item.origin || '订阅源',
        tags: item.tags ?? item.keywords ?? [],
        meta: (item.metrics as Record<string, any>) ?? null,
        createdAt: item.publishedAt || '',
        rawFeed: item,
      })
    }
  }

  return list
}

export function MediaCollectionCard({
  entry,
  relatedHighlight,
  draggable,
  onDragStart,
  onOpen,
  onQuickSaveFeed,
  onQuickTask,
}: {
  entry: UnifiedCardEntry
  relatedHighlight?: boolean
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLElement>, entry: UnifiedCardEntry) => void
  onOpen: (entry: UnifiedCardEntry) => void
  onQuickSaveFeed?: (entry: UnifiedCardEntry) => void
  onQuickTask?: (entry: UnifiedCardEntry) => void
}) {
  const [imgBroken, setImgBroken] = useState(false)
  const showMedia = Boolean(entry.thumbnail) && !imgBroken
  const tone = hashCode(entry.id) % 6
  const stars = entry.meta?.stars ?? entry.meta?.upvotes ?? null
  const language = entry.meta?.language ?? null
  const author = entry.meta?.author ?? entry.meta?.artist ?? null
  const duration = entry.meta?.duration ?? null

  return (
    <article
      className={`sy-mcard kind-${entry.kind} status-${entry.status}${relatedHighlight ? ' is-related' : ''}`}
      data-card-id={entry.id}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, entry)}
      onClick={() => onOpen(entry)}
      tabIndex={0}
      role="button"
      aria-label={`${KIND_BADGE_LABELS[entry.kind] ?? entry.kind}：${entry.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(entry)
        }
      }}
    >
      {showMedia ? (
        <div className="sy-mcard-media">
          <img
            src={entry.thumbnail!}
            alt=""
            loading="lazy"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setImgBroken(true)}
          />
          {entry.kind === 'video' ? <span className="sy-mcard-badge">▶ {duration || '视频'}</span> : null}
          {entry.kind === 'music' ? <span className="sy-mcard-badge">♪ {duration || '音乐'}</span> : null}
          {entry.kind === 'image' ? <span className="sy-mcard-badge">图片</span> : null}
        </div>
      ) : entry.kind === 'music' || entry.kind === 'image' || entry.kind === 'video' ? (
        <div className={`sy-mcard-fallback tone-${tone}`}>
          <span>{entry.kind === 'music' ? '♪' : entry.kind === 'video' ? '▶' : '▨'}</span>
          <small>{KIND_BADGE_LABELS[entry.kind]}</small>
        </div>
      ) : null}

      <div className="sy-mcard-body">
        <div className="sy-mcard-top">
          <span className={`sy-mcard-pill kind-${entry.kind}`}>
            {KIND_BADGE_LABELS[entry.kind] ?? entry.kind}
          </span>
          {language ? <span className="sy-mcard-meta-tag">{language}</span> : null}
          {stars !== null && stars !== undefined ? <span className="sy-mcard-meta-tag">★ {stars}</span> : null}
          {author ? <span className="sy-mcard-meta-tag">@{String(author).replace(/^@/, '')}</span> : null}
          {entry.externalUrl ? <span className="sy-mcard-feishu" title="已关联外部文档（如飞书）">飞书/外链 ↗</span> : null}
        </div>

        <h3 className="sy-mcard-title">{entry.title}</h3>

        {entry.body ? <p className="sy-mcard-desc">{entry.body}</p> : null}

        {entry.tags.length > 0 ? (
          <div className="sy-mcard-tags">
            {entry.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="sy-mcard-tag">
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="sy-mcard-foot" onClick={(e) => e.stopPropagation()}>
        <span className={`sy-mcard-dot status-${entry.status}`} />
        <span className="sy-mcard-source">{entry.sourceLabel}</span>
        <span className="sy-mcard-time">{relativeTimeShort(entry.createdAt)}</span>
        <span className="sy-mcard-acts">
          {entry.entryType === 'feed' && onQuickSaveFeed ? (
            <button
              type="button"
              className="sy-mini-act"
              title="收入个人收藏库"
              onClick={() => onQuickSaveFeed(entry)}
            >
              +收藏
            </button>
          ) : null}
          {onQuickTask ? (
            <button
              type="button"
              className="sy-mini-act"
              title="转为排期任务"
              onClick={() => onQuickTask(entry)}
            >
              +待办
            </button>
          ) : null}
          {entry.url ? (
            <a
              className="sy-mini-act"
              href={safeUrl(entry.url)}
              target="_blank"
              rel="noopener noreferrer"
              title="打开原链接"
            >
              ↗
            </a>
          ) : null}
        </span>
      </footer>
    </article>
  )
}

export function CaptureModal({
  initialTab = 'note',
  onClose,
  onRun,
}: {
  initialTab?: 'note' | 'task' | 'collection' | 'batch'
  onClose: () => void
  onRun: (name: string, body: Record<string, any>, opts?: { toast?: string }) => Promise<any>
}) {
  const [tab, setTab] = useState<'note' | 'task' | 'collection' | 'batch'>(initialTab)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [kind, setKind] = useState<CollectionKind>('github')
  const [tagsText, setTagsText] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [project, setProject] = useState('')
  const [metaExtra, setMetaExtra] = useState('')
  const [batchJson, setBatchJson] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (url.trim()) {
      setKind(detectKindFromUrl(url.trim(), kind))
    }
  }, [url])

  const parseTags = (raw: string) =>
    raw
      .split(/[,，、\s#]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (tab === 'note') {
        if (!text.trim()) return
        await onRun(
          'note.add',
          {
            title: title.trim() || undefined,
            text: text.trim(),
            tags: parseTags(tagsText),
            externalUrl: externalUrl.trim() || null,
          },
          { toast: '已记下灵感/备忘' },
        )
        onClose()
      } else if (tab === 'task') {
        if (!title.trim()) return
        await onRun(
          'task.add',
          {
            title: title.trim(),
            due: due || null,
            priority,
            project: project.trim() || null,
            note: text.trim() || undefined,
          },
          { toast: due ? `已新建并排期至 ${due}` : '已新建到待排期收件箱' },
        )
        onClose()
      } else if (tab === 'collection') {
        if (!title.trim() && !url.trim()) return
        const meta: Record<string, any> = {}
        if (metaExtra.trim()) {
          if (kind === 'github') meta.language = metaExtra.trim()
          else if (kind === 'x') meta.author = metaExtra.trim()
          else if (kind === 'music' || kind === 'video') meta.duration = metaExtra.trim()
        }
        await onRun(
          'collection.save',
          {
            kind,
            title: title.trim() || url.trim(),
            url: url.trim() || undefined,
            thumbnail: thumbnail.trim() || undefined,
            summary: text.trim(),
            externalUrl: externalUrl.trim() || undefined,
            tags: parseTags(tagsText),
            meta: Object.keys(meta).length > 0 ? meta : undefined,
          },
          { toast: `已存入「${KIND_BADGE_LABELS[kind]}」收藏库` },
        )
        onClose()
      } else if (tab === 'batch') {
        if (!batchJson.trim()) return
        let items: any[] = []
        try {
          const parsed = JSON.parse(batchJson.trim())
          items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : [parsed])
        } catch {
          // Support line-by-line CSV/TSV: kind,title,url,thumbnail,summary
          items = batchJson
            .trim()
            .split(/\r?\n/)
            .map((line) => {
              const [k, t, u, thumb, sum] = line.split(/[,，\t]/).map((c) => c.trim())
              if (!t && !u) return null
              return {
                kind: detectKindFromUrl(u || '', (k as CollectionKind) || 'web'),
                title: t || u,
                url: u || '',
                thumbnail: thumb || undefined,
                summary: sum || '',
              }
            })
            .filter(Boolean)
        }
        if (items.length > 0) {
          await onRun('collection.save', { items }, { toast: `已批量导入 ${items.length} 条收藏元信息` })
          onClose()
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sy-scrim" data-act="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sy-modal sy-capture-modal" role="dialog" aria-label="快速记录与收藏入库">
        <div className="sy-modal-h">
          <div>
            <b>快速记录 · 收藏入库</b>
            <div className="meta">只存轻量备忘与多媒介元信息（缩略图、标题、说明、外链），长文可关联飞书文档</div>
          </div>
          <button type="button" className="sy-icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="sy-capture-tabs" role="tablist">
          {([
            ['note', '速记 / 灵感'],
            ['collection', '偏好收藏 (GitHub/X/图音视)'],
            ['task', '排期任务 (Todo)'],
            ['batch', '批量导入 (JSON/CSV)'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'is-on' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="sy-modal-b sy-form-stack" onSubmit={handleSubmit}>
          {tab === 'note' ? (
            <>
              <label className="sy-field">
                <span>备忘 / 灵感闪念 *</span>
                <textarea
                  rows={3}
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="随手记下一句话、一个灵感或备忘要点……"
                />
              </label>
              <div className="sy-form-row2">
                <label className="sy-field">
                  <span>短标题（可选）</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="默认取第一句" />
                </label>
                <label className="sy-field">
                  <span>标签（逗号或空格分隔）</span>
                  <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="如：灵感, 架构, 生活" />
                </label>
              </div>
              <label className="sy-field">
                <span>关联飞书 / 外部深度文档链接（可选）</span>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://xxx.feishu.cn/docx/..."
                />
              </label>
            </>
          ) : null}

          {tab === 'collection' ? (
            <>
              <div className="sy-field">
                <span>收藏类别</span>
                <div className="sy-kind-pills">
                  {(['github', 'x', 'web', 'image', 'music', 'video'] as const).map((k) => (
                    <button
                      type="button"
                      key={k}
                      className={kind === k ? 'is-on' : ''}
                      onClick={() => setKind(k)}
                    >
                      {KIND_BADGE_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sy-form-row2">
                <label className="sy-field">
                  <span>标题 / 名称 *</span>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === 'github' ? 'owner/repo 仓库名或简介' : '收藏标题'}
                  />
                </label>
                <label className="sy-field">
                  <span>原始链接 URL</span>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </div>
              <div className="sy-form-row2">
                <label className="sy-field">
                  <span>缩略图 / 封面图 URL（仅存元信息）</span>
                  <input
                    type="url"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    placeholder="https://.../cover.webp"
                  />
                </label>
                <label className="sy-field">
                  <span>
                    {kind === 'github' ? '主要语言 (如 TypeScript)' : kind === 'x' ? '作者 (@handle)' : '时长 / 创作者'}
                  </span>
                  <input
                    value={metaExtra}
                    onChange={(e) => setMetaExtra(e.target.value)}
                    placeholder={kind === 'github' ? 'Rust / TypeScript' : kind === 'x' ? '@karpathy' : '04:32'}
                  />
                </label>
              </div>
              <label className="sy-field">
                <span>说明信息 / 为什么收藏</span>
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="记录一句你的评价、用途或关键信息……"
                />
              </label>
              <div className="sy-form-row2">
                <label className="sy-field">
                  <span>标签</span>
                  <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Agent, UI, 必看" />
                </label>
                <label className="sy-field">
                  <span>关联飞书笔记链接（可选）</span>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://xxx.feishu.cn/..."
                  />
                </label>
              </div>
            </>
          ) : null}

          {tab === 'task' ? (
            <>
              <label className="sy-field">
                <span>待办事项标题 *</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="要做什么事？"
                />
              </label>
              <div className="sy-form-row3">
                <label className="sy-field">
                  <span>排期日期（留空进待排期 Inbox）</span>
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </label>
                <label className="sy-field">
                  <span>优先级</span>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                    <option value="high">高优先级 (High)</option>
                    <option value="medium">中优先级 (Medium)</option>
                    <option value="low">低优先级 (Low)</option>
                  </select>
                </label>
                <label className="sy-field">
                  <span>所属项目 (Project)</span>
                  <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="如：核心研发" />
                </label>
              </div>
              <label className="sy-field">
                <span>任务备注说明</span>
                <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="补充上下文或验收标准……" />
              </label>
            </>
          ) : null}

          {tab === 'batch' ? (
            <label className="sy-field">
              <span>粘贴 JSON 数组，或每行一条 CSV（格式：类型,标题,链接,缩略图URL,说明）</span>
              <textarea
                rows={6}
                required
                value={batchJson}
                onChange={(e) => setBatchJson(e.target.value)}
                placeholder={`[\n  { "kind": "github", "title": "deepseek-ai/DeepSeek-V3", "url": "https://github.com/deepseek-ai/DeepSeek-V3", "summary": "MLA 与 MoE 架构参考", "tags": ["LLM", "Star"] },\n  { "kind": "video", "title": "Bento UI 设计拆解", "url": "https://www.bilibili.com/video/BV1xx", "thumbnail": "https://example.com/cover.jpg", "summary": "卡片排版参考" }\n]`}
              />
            </label>
          ) : null}

          <div className="sy-modal-f">
            <span className="grow" />
            <button type="button" className="sy-btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="sy-btn sy-btn-ink" disabled={busy}>
              {busy ? '保存中…' : '保存入库'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function EntryDetailModal({
  entry,
  onClose,
  onRun,
}: {
  entry: UnifiedCardEntry
  onClose: () => void
  onRun: (name: string, body: Record<string, any>, opts?: { toast?: string }) => Promise<any>
}) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body || (entry.rawNote?.text ?? ''))
  const [thumbnail, setThumbnail] = useState(entry.thumbnail ?? '')
  const [externalUrl, setExternalUrl] = useState(entry.externalUrl ?? '')
  const [status, setStatus] = useState<ContentStatus>(entry.status || 'inbox')
  const [tagsText, setTagsText] = useState(entry.tags.join(', '))
  const [kind, setKind] = useState<CollectionKind>(entry.kind === 'note' ? 'web' : entry.kind)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const tags = tagsText
      .split(/[,，、\s#]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12)
    if (entry.entryType === 'note' && entry.rawNote) {
      await onRun(
        'note.update',
        {
          id: entry.rawNote.id,
          title: title.trim() || null,
          text: body.trim() || title.trim(),
          status,
          tags,
          externalUrl: externalUrl.trim() || null,
        },
        { toast: '已更新速记备忘' },
      )
    } else {
      const colId = entry.rawCollection?.id || entry.rawFeed?.id
      await onRun(
        'collection.save',
        {
          id: colId,
          kind,
          status,
          title: title.trim(),
          url: entry.url || undefined,
          thumbnail: thumbnail.trim() || undefined,
          summary: body.trim(),
          externalUrl: externalUrl.trim() || undefined,
          tags,
          meta: entry.meta ?? undefined,
        },
        { toast: '已保存收藏元信息' },
      )
    }
    onClose()
  }

  const handleDelete = async () => {
    if (entry.entryType === 'note' && entry.rawNote) {
      await onRun('note.remove', { id: entry.rawNote.id }, { toast: '已删除速记' })
    } else if (entry.rawCollection?.id) {
      await onRun('collection.remove', { id: entry.rawCollection.id }, { toast: '已移除收藏' })
    }
    onClose()
  }

  const handleToTask = async () => {
    await onRun(
      'task.add',
      {
        title: title.trim().slice(0, 120),
        note: body.trim().slice(0, 500) || undefined,
        origin: {
          title: title.trim(),
          url: entry.url || entry.externalUrl || undefined,
          source: entry.sourceLabel,
        },
      },
      { toast: '已转为待排期任务（Inbox）' },
    )
    onClose()
  }

  return (
    <div className="sy-scrim" data-act="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sy-modal sy-capture-modal" role="dialog" aria-label="条目元信息详情">
        <div className="sy-modal-h">
          <div>
            <b>{KIND_BADGE_LABELS[entry.kind] ?? '元信息'} · 详情与整理</b>
            <div className="meta">{entry.sourceLabel} {entry.createdAt ? `· ${relativeTimeShort(entry.createdAt)}` : ''}</div>
          </div>
          <button type="button" className="sy-icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <form className="sy-modal-b sy-form-stack" onSubmit={handleSave}>
          {thumbnail ? (
            <div className="sy-detail-preview">
              <img src={thumbnail} alt="" referrerPolicy="no-referrer" />
            </div>
          ) : null}

          <div className="sy-form-row2">
            <label className="sy-field">
              <span>标题</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="sy-field">
              <span>整理状态</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {entry.entryType !== 'note' ? (
            <div className="sy-form-row2">
              <label className="sy-field">
                <span>媒介类型</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as CollectionKind)}>
                  {(['github', 'x', 'web', 'image', 'music', 'video', 'article'] as const).map((k) => (
                    <option key={k} value={k}>
                      {KIND_BADGE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sy-field">
                <span>缩略图 URL</span>
                <input
                  type="url"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>
          ) : null}

          <label className="sy-field">
            <span>{entry.entryType === 'note' ? '速记内容' : '说明信息 / 摘要备注'}</span>
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="sy-form-row2">
            <label className="sy-field">
              <span>标签（逗号分隔）</span>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
            </label>
            <label className="sy-field">
              <span>关联飞书 / 深度笔记链接</span>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://xxx.feishu.cn/..."
              />
            </label>
          </div>

          <div className="sy-modal-f">
            {entry.entryType !== 'feed' ? (
              <button type="button" className="sy-btn" onClick={handleDelete}>
                删除
              </button>
            ) : null}
            <button type="button" className="sy-btn" onClick={handleToTask}>
              转为排期任务
            </button>
            {entry.url ? (
              <a
                className="sy-btn"
                href={safeUrl(entry.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开原链接 ↗
              </a>
            ) : null}
            {externalUrl ? (
              <a
                className="sy-btn"
                href={safeUrl(externalUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开飞书文档 ↗
              </a>
            ) : null}
            <span className="grow" />
            <button type="submit" className="sy-btn sy-btn-ink">
              保存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
