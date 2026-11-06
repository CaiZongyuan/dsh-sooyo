import { getJson, getXml, type FetchPreviousState } from './fetch.js'

const ATTRIBUTION_AIHOT = { name: 'AIHOT', url: 'https://aihot.news' }
const AIHOT_DIRECT = 'https://aihot.news/api/v1'

let CONFIG: { mode: 'selected' | 'all' } = { mode: 'selected' }

export function setSourceConfig(config: { mode?: string }): void {
  CONFIG = { mode: config.mode === 'all' ? 'all' : 'selected' }
}

export type SourceLoadResult =
  | { notModified: true; items?: undefined; etag?: undefined }
  | { notModified?: false; items: any[]; etag?: string | null }

export type SourceEntry = {
  id: string
  label: string
  about: string
  attribution: { name: string; url: string }
  cadenceMinutes: number
  replace?: boolean
  suggests: { pres: string }
  load: (signal?: AbortSignal, previous?: FetchPreviousState) => Promise<SourceLoadResult>
}

export const SOURCES: SourceEntry[] = [
  {
    id: 'aihot',
    label: 'AIHOT 精选',
    about: '中文 AI 资讯站的编辑精选，带评分与推荐理由',
    attribution: ATTRIBUTION_AIHOT,
    cadenceMinutes: 10,
    suggests: { pres: '图文' },
    async load(signal, previous) {
      const result = await getJson(
        `${AIHOT_DIRECT}/items?mode=${CONFIG.mode === 'all' ? 'all' : 'selected'}&window=7d&by=timeline&limit=60`,
        previous,
        signal,
      )
      if (result.notModified) return result
      const items = (Array.isArray(result.payload?.items) ? result.payload.items : []).map((raw: any) => ({
        nativeId: raw?.id,
        title: raw?.title ?? '(无标题)',
        url: raw?.links?.original ?? raw?.links?.aihot ?? '',
        altUrl: raw?.links?.aihot ?? null,
        publishedAt: raw?.publishedAt ?? raw?.discoveredAt ?? null,
        summary: raw?.summary ?? '',
        reason: raw?.reason ?? '',
        score: typeof raw?.score === 'number' ? raw.score : null,
        category: raw?.category ?? 'other',
        origin: raw?.source?.name ?? 'AIHOT',
        attribution: raw?.attribution ?? ATTRIBUTION_AIHOT,
      }))
      return { items, etag: result.etag }
    },
  },
  {
    id: 'aihot-hot',
    label: 'AIHOT 热榜',
    about: '跨源热点 Top 10，反映此刻大家在讨论什么',
    attribution: ATTRIBUTION_AIHOT,
    cadenceMinutes: 30,
    replace: true,
    suggests: { pres: '榜单' },
    async load(signal, previous) {
      const result = await getJson(`${AIHOT_DIRECT}/hot-topics`, previous, signal)
      if (result.notModified) return result
      const items = (Array.isArray(result.payload?.items) ? result.payload.items : []).map((raw: any) => ({
        nativeId: raw?.id,
        itemKind: 'rank',
        title: raw?.title ?? '(无标题)',
        url: raw?.links?.original ?? raw?.links?.story ?? raw?.links?.aihot ?? '',
        altUrl: raw?.links?.aihot ?? null,
        publishedAt: raw?.latestAt ?? null,
        summary: '',
        score: null,
        category: 'hot',
        origin: `${raw?.sourceCount ?? 0} 源 · ${raw?.signalCount ?? 0} 信号`,
        metrics: { rank: raw?.rank ?? null, sourceCount: raw?.sourceCount ?? 0, signalCount: raw?.signalCount ?? 0 },
      }))
      return { items, etag: result.etag }
    },
  },
  {
    id: 'hf-papers',
    label: 'HuggingFace 论文',
    about: 'HuggingFace 每日论文榜',
    attribution: { name: 'HuggingFace', url: 'https://huggingface.co/papers' },
    cadenceMinutes: 360,
    suggests: { pres: '论文' },
    async load(signal) {
      const response = await fetch('https://huggingface.co/api/daily_papers?limit=20', {
        headers: { accept: 'application/json' },
        ...(signal ? { signal } : {}),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      const items = (Array.isArray(payload) ? payload : []).map((entry: any) => {
        const paper = entry?.paper ?? {}
        const authors = Array.isArray(paper?.authors) ? paper.authors : []
        const media = Array.isArray(paper?.mediaUrls) ? paper.mediaUrls : []
        const figure = media.find((url: unknown) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(String(url))) ?? null
        return {
          nativeId: paper?.id,
          title: paper?.title ?? entry?.title ?? '(无标题)',
          url: `https://huggingface.co/papers/${paper?.id ?? ''}`,
          altUrl: paper?.githubRepo ?? null,
          project: paper?.projectPage ?? null,
          thumbnail:
            figure ??
            (paper?.id ? `https://cdn-thumbnails.huggingface.co/social-thumbnails/papers/${paper.id}.png` : null),
          publishedAt: entry?.publishedAt ?? paper?.publishedAt ?? null,
          summary: paper?.summary ?? entry?.summary ?? '',
          tldr: paper?.ai_summary ?? '',
          keywords: Array.isArray(paper?.ai_keywords) ? paper.ai_keywords.slice(0, 5) : [],
          score: typeof paper?.upvotes === 'number' ? paper.upvotes : null,
          category: 'paper',
          origin: paper?.organization?.fullname ?? paper?.organization?.name ?? 'HuggingFace',
          tags: authors
            .slice(0, 3)
            .map((a: any) => a?.name)
            .filter(Boolean),
          authorCount: authors.length,
          metrics: {
            upvotes: paper?.upvotes ?? 0,
            comments: entry?.numComments ?? 0,
            stars: paper?.githubStars ?? 0,
          },
        }
      })
      return { items }
    },
  },
  {
    id: 'producthunt',
    label: 'Product Hunt',
    about: 'Product Hunt 今日新产品',
    attribution: { name: 'Product Hunt', url: 'https://www.producthunt.com' },
    cadenceMinutes: 180,
    suggests: { pres: '产品' },
    async load(signal, previous) {
      const result = await getXml('https://www.producthunt.com/feed', previous, signal)
      if (result.notModified) return result
      return {
        etag: result.etag,
        items: result.entries.slice(0, 15).map((entry) => ({
          nativeId: entry.nativeId,
          title: entry.title || '(无标题)',
          url: entry.url,
          publishedAt: entry.publishedAt,
          summary: entry.summary,
          category: 'product',
          origin: 'Product Hunt',
        })),
      }
    },
  },
  {
    id: 'youtube',
    label: 'YouTube · Dwarkesh Patel',
    about: 'Dwarkesh Patel 的最新视频与播客',
    attribution: { name: 'YouTube', url: 'https://www.youtube.com/@DwarkeshPatel' },
    cadenceMinutes: 180,
    suggests: { pres: '视频' },
    async load(signal, previous) {
      const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXl4i9dYBrFOabk0xGmbkRA'
      const result = await getXml(url, previous, signal)
      if (result.notModified) return result
      return {
        etag: result.etag,
        items: result.entries.slice(0, 12).map((entry) => {
          const short = /\/shorts\//.test(entry.url ?? '')
          const id = String(entry.nativeId ?? '').replace(/^yt:video:/, '')
          const cover = id
            ? short
              ? `https://i.ytimg.com/vi/${id}/oardefault.jpg`
              : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
            : entry.thumbnail
          return {
            nativeId: entry.nativeId,
            title: entry.title || '(无标题)',
            url: entry.url,
            publishedAt: entry.publishedAt,
            summary: entry.summary,
            description: entry.description || entry.summary,
            kind: short ? 'short' : 'episode',
            category: 'podcast',
            origin: 'Dwarkesh Patel',
            thumbnail: entry.thumbnail ?? cover,
            thumbnailFallback: short && entry.thumbnail !== cover ? entry.thumbnail : null,
            cover,
            metrics: entry.metrics,
          }
        }),
      }
    },
  },
]

export const SOURCE_IDS = new Set(SOURCES.map((source) => source.id))
