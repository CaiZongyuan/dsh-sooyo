import { readFeed, type ParsedFeedEntry } from './feed-parser.js'

const PAGE_USER_AGENT = 'dsh-sooyo/0.1 (+personal, non-commercial; og:image only)'

/** How much of a target page is read while looking for `og:image`. */
export const PAGE_PREFIX_BYTES = 160_000
export const PAGE_TIMEOUT_MS = 12000

export type FetchPreviousState = {
  etag?: string | null
  [key: string]: any
}

export type JsonFetchResult =
  | { notModified: true; payload?: undefined; etag?: undefined }
  | { notModified?: false; payload: any; etag: string | null }

export type XmlFetchResult =
  | { notModified: true; entries?: undefined; etag?: undefined }
  | { notModified?: false; entries: ParsedFeedEntry[]; etag: string | null }

export async function getJson(url: string, previous?: FetchPreviousState, signal?: AbortSignal): Promise<JsonFetchResult> {
  const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'aihot-api/2.0.0' }
  if (previous?.etag) headers['if-none-match'] = previous.etag
  const response = await fetch(url, { headers, ...(signal ? { signal } : {}) })
  if (response.status === 304) return { notModified: true }
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}${response.headers.get('retry-after') ? ` Retry-After=${response.headers.get('retry-after')}` : ''}`,
    )
  }
  return { payload: await response.json(), etag: response.headers.get('etag') }
}

export async function getXml(url: string, previous?: FetchPreviousState, signal?: AbortSignal): Promise<XmlFetchResult> {
  const headers: Record<string, string> = {
    accept: 'application/atom+xml, application/xml',
    'user-agent': 'dsh-sooyo/0.1 (+personal, non-commercial)',
  }
  if (previous?.etag) headers['if-none-match'] = previous.etag
  const response = await fetch(url, { headers, ...(signal ? { signal } : {}) })
  if (response.status === 304) return { notModified: true }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return { entries: readFeed(await response.text()), etag: response.headers.get('etag') }
}

/**
 * Read the head of a page and stop.
 *
 * Some sources publish no image with their items, so the image has to come from the page
 * the item links to. `og:image` lives in `<head>`, so the body is abandoned as soon as
 * enough has been read — a courtesy to the target site, and it keeps the poll cheap.
 */
export async function fetchPagePrefix(url: string, signal?: AbortSignal): Promise<{ status: number; html: string | null }> {
  const response = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': PAGE_USER_AGENT },
    ...(signal ? { signal } : {}),
    redirect: 'follow',
  })
  if (!response.ok) return { status: response.status, html: null }
  const contentType = response.headers.get('content-type') ?? ''
  if (!/text\/html|application\/xhtml/i.test(contentType)) return { status: response.status, html: null }

  const reader = response.body?.getReader()
  if (!reader) return { status: response.status, html: null }
  const decoder = new TextDecoder()
  let html = ''
  try {
    while (html.length < PAGE_PREFIX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return { status: response.status, html }
}
