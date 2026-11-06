/**
 * Deliberately small readers: RSS 2.0 / Atom / RDF for syndication, plus `og:image`
 * extraction for pages a source links to but publishes no image for (AIHOT and Product
 * Hunt both do this). Zero dependencies, and readers rather than parsers — they extract
 * the handful of fields sooyo daily stores and ignore everything else.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export interface ParsedFeedEntry {
  nativeId: string
  title: string
  url: string
  publishedAt: string | null
  summary: string
  description: string
  thumbnail: string | null
  metrics?: { views?: number; likes?: number }
}

export function decodeEntities(value: unknown): string {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[body.toLowerCase()] ?? match
  })
}

/**
 * Reduce a feed field to plain text.
 *
 * Entities are decoded FIRST, then tags are stripped. Feeds very commonly deliver
 * escaped HTML inside XML (`&lt;p&gt;…`), which is what Product Hunt's `<content>` does;
 * stripping tags before decoding leaves that markup in the summary verbatim.
 */
export const stripTags = (value: unknown): string =>
  decodeEntities(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function tagText(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  return match?.[1] ?? null
}

/**
 * Read one attribute out of the first `<tag …>` in the block.
 */
function tagAttr(block: string, tag: string, attribute: string): string | null {
  const tagMatch = block.match(new RegExp(`<${tag}\\b[^>]*>`, 'i'))
  if (!tagMatch?.[0]) return null
  const attr = tagMatch[0].match(new RegExp(`\\b${attribute}=["']([^"']*)["']`, 'i'))
  return attr?.[1] ?? null
}

export function readFeed(xml: unknown): ParsedFeedEntry[] {
  const text = String(xml)
  const blocks = text.match(/<entry[\s>][\s\S]*?<\/entry>/gi)
    ?? text.match(/<item[\s>][\s\S]*?<\/item>/gi)
    ?? []

  return blocks.map((block) => {
    const rawLink = tagText(block, 'link')
    const link = tagAttr(block, 'link', 'href')
      ?? (rawLink ? decodeEntities(rawLink.trim()) : null)
    const id = tagText(block, 'id') ?? tagText(block, 'guid') ?? link ?? ''
    const summary = tagText(block, 'summary') ?? tagText(block, 'content') ?? tagText(block, 'description')
    const description = tagText(block, 'media:description')
    const views = tagAttr(block, 'media:statistics', 'views')
    const likes = tagAttr(block, 'media:starRating', 'count')
    const metrics: { views?: number; likes?: number } = {}
    if (views && Number.isFinite(Number(views))) metrics.views = Number(views)
    if (likes && Number.isFinite(Number(likes))) metrics.likes = Number(likes)
    return {
      nativeId: stripTags(id) || link || '',
      title: stripTags(tagText(block, 'title') ?? ''),
      url: link ?? '',
      publishedAt: (tagText(block, 'published') ?? tagText(block, 'pubDate') ?? tagText(block, 'updated') ?? '').trim() || null,
      summary: summary ? stripTags(summary).slice(0, 1200) : '',
      description: description ? stripTags(description).slice(0, 1200) : '',
      thumbnail: tagAttr(block, 'media:thumbnail', 'url') ?? tagAttr(block, 'media:content', 'url') ?? null,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
    }
  })
}

/** Resolve a possibly relative URL against the page it came from. */
export function absoluteUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string') return null
  const trimmed = decodeEntities(value).trim()
  if (!trimmed || /^data:/i.test(trimmed)) return null
  try {
    return new URL(trimmed, base).href
  } catch {
    return null
  }
}

/**
 * Pull the social preview image out of an HTML document.
 */
export function extractOgImage(html: unknown, baseUrl: string): string | null {
  const text = String(html ?? '')
  const metaPatterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]*>/i,
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]*>/i,
    /<meta[^>]+name=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    /<meta[^>]+property=["']twitter:image(?::src)?["'][^>]*>/i,
  ]
  for (const pattern of metaPatterns) {
    const tag = text.match(pattern)
    if (!tag?.[0]) continue
    const content = tag[0].match(/content\s*=\s*["']([^"']+)["']/i)
    const url = content?.[1] ? absoluteUrl(content[1], baseUrl) : null
    if (url) return url
  }

  const ld = text.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i)
  if (ld?.[1]) {
    try {
      const parsed: unknown = JSON.parse(decodeEntities(ld[1]).trim())
      const node = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | undefined
      const image = node?.image ?? node?.thumbnailUrl ?? (node?.primaryImageOfPage as Record<string, unknown> | undefined)?.url
      const candidate = typeof image === 'string'
        ? image
        : (Array.isArray(image) ? image[0] : (image as Record<string, unknown> | undefined)?.url)
      const url = absoluteUrl(candidate, baseUrl)
      if (url) return url
    } catch {
      // malformed JSON-LD is common; it simply yields no image
    }
  }
  return null
}
