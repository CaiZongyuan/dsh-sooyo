/**
 * Client half of sooyo daily — a widget workspace.
 *
 * The Host half owns the model: Sources supply Items, and Boards, Widgets, layouts, Tasks,
 * Notes, Read Later, 关注词 and habits are user data behind `/sooyo/daily` and
 * `/sooyo/action`. This file renders that model and sends back one named action per
 * interaction; it holds no durable state of its own.
 *
 * Card bodies are rendered as HTML strings and mounted with `dangerouslySetInnerHTML`, so
 * every interpolated value goes through `esc()`. Nothing that comes off the network — an
 * Item title, a 推荐理由, a keyword, a source name — may reach the string unescaped, and no
 * fetched text is ever treated as markup or as an instruction (AGENTS.md rule 6).
 *
 * A Size selects the information level, never a stretched copy: `R.<type>` branches on it.
 * Card content is budgeted against the row unit and trimmed after mount by `fitDom`, so no
 * card clips a row in half (AGENTS.md rule 5).
 */

window.__ModuleLoader__.load({
  id: 'dsh-sooyo',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback, useMemo } = React

    const PANEL_ID = 'sooyo'
    const API = '/sooyo'
    /** Icons ship with the bundle and are served by the Host half. */
    const ASSET = `${API}/assets/a`

    /** Desktop grid geometry; a card's body is `n*ROW + (n-1)*GAP - CHROME`. */
    const ROW = 88
    const GAP = 14

    // ---- helpers -----------------------------------------------------------

    const esc = (value) =>
      String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

    const safeUrl = (value) => (/^https?:\/\//i.test(String(value ?? '')) ? String(value) : '#')

    const pad2 = (n) => String(n).padStart(2, '0')
    const WEEK = ['日', '一', '二', '三', '四', '五', '六']

    const fmtCount = (n) =>
      (n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1)} 万` : Number(n || 0).toLocaleString('en-US'))

    const relTime = (iso) => {
      const parsed = Date.parse(iso ?? '')
      if (!Number.isFinite(parsed)) return ''
      const minutes = Math.max(1, Math.round((Date.now() - parsed) / 60000))
      if (minutes < 60) return `${minutes} 分钟前`
      if (minutes < 60 * 24) return `${Math.round(minutes / 60)} 小时前`
      return `${Math.round(minutes / 1440)} 天前`
    }

    const hueOf = (text) => {
      let hue = 0
      for (const char of String(text)) hue = (hue * 31 + char.charCodeAt(0)) % 360
      return hue
    }
    const tint = (text) => `hsl(${hueOf(text)} 42% 52%)`

    const greeting = () => {
      const hour = new Date().getHours()
      return hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
    }

    const dayIdx = () => (new Date().getDay() + 6) % 7
    const toMin = (hm) => {
      const [hour, minute] = String(hm).split(':').map(Number)
      return hour * 60 + (minute || 0)
    }

    const CATEGORY_LABELS = {
      'ai-models': '模型',
      'ai-products': '产品',
      industry: '行业',
      paper: '论文',
      opinion: '观点',
      tip: '技巧',
      hot: '热榜',
      product: '产品',
      podcast: '视频',
    }
    const CATEGORY_COLOUR = {
      'ai-models': 'var(--sy-t-task)',
      'ai-products': 'var(--sy-t-subscription)',
      industry: 'var(--sy-t-bookmarks)',
      paper: 'var(--sy-t-project)',
      opinion: 'var(--sy-t-habit)',
      tip: 'var(--sy-t-readlater)',
    }
    const categoryLabel = (value) => CATEGORY_LABELS[value] ?? null

    /**
     * How the Agent Inbox names a proposed operation and a decision state.
     *
     * A proposal stores a command name (`task.add`); a person reading the card needs the action
     * in their own words. The maps are exhaustive over what `agent/inbox.js` permits, and an
     * unknown name falls back to the raw command rather than disappearing.
     */
    const OPERATION_LABELS = {
      'task.add': '新建任务',
      'task.update': '修改任务',
      'note.add': '记录笔记',
      'readlater.set': '稍后读',
      'board.create': '新建看板',
      'widget.add': '添加组件',
      'widget.update': '调整组件',
      'layout.set': '调整布局',
    }
    const STATUS_LABELS = {
      pending: '待批准',
      approved: '已批准',
      rejected: '已拒绝',
      applied: '已执行',
      rolled_back: '已撤销',
      failed: '执行失败',
      expired: '已过期',
    }

    /** A Short and an episode share one feed; only the URL distinguishes them. */
    const isShort = (item) => (item?.kind ? item.kind === 'short' : /\/shorts\//.test(item?.url ?? ''))

    /** Trim a YouTube description down to prose: no links, no timestamps, no emoji noise. */
    const cleanDesc = (text) =>
      String(text ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !/https?:/.test(line) && !/^[*•\-–]/.test(line))
        .join(' ')
        .slice(0, 240)

    // ---- icons -------------------------------------------------------------

    const I = {
      dots: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>',
      check: '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>',
      search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>',
      plus: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
      bookmark: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5l-4 3z"/></svg>',
      bookmarkOn: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5l-4 3z"/></svg>',
      toTask: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.6"/><path d="M5.6 8.1l1.7 1.7 3.2-3.5"/></svg>',
      out: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7M13 3L4 12"/></svg>',
      note: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M6 8h4M6 10.5h3" stroke-linecap="round"/></svg>',
      x: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
      copy: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 3.2A1.8 1.8 0 0 0 9.3 2H4a2 2 0 0 0-2 2v5.3A1.8 1.8 0 0 0 3.2 11"/></svg>',
      sun: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>',
      moon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M13.2 10A5.6 5.6 0 0 1 6 2.8a5.6 5.6 0 1 0 7.2 7.2z"/></svg>',
      play: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>',
      pause: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="2.8" height="10" rx=".8"/><rect x="9.2" y="3" width="2.8" height="10" rx=".8"/></svg>',
      reset: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.8v2.6h2.6"/></svg>',
      resize: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10.5 4.5v6h-6M10.5 10.5L5 5"/></svg>',
      warn: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 3l7.5 13h-15z"/><path d="M10 8v3.6M10 14v.2" stroke-linecap="round"/></svg>',
      home: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6"/></svg>',
      work: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2.5" y="6" width="15" height="10.5" rx="2.2"/><path d="M7 6V4.6A1.6 1.6 0 0 1 8.6 3h2.8A1.6 1.6 0 0 1 13 4.6V6M2.5 10.5h15"/></svg>',
      life: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5C9 3.5 4 7 4 12.5c0 1.6.6 3 1.4 4M16.5 3.5c0 7.5-4 12-9.6 12.4M8.5 11.5L4 16"/></svg>',
      read: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 5.2C8.4 4 6 3.5 3 3.6v11.6c3-.1 5.4.4 7 1.6 1.6-1.2 4-1.7 7-1.6V3.6c-3-.1-5.4.4-7 1.6zM10 5.2v11.6"/></svg>',
      spark: '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 .8l1.2 3.6a1 1 0 0 0 .5.5L11.2 6l-3.5 1.2a1 1 0 0 0-.5.5L6 11.2 4.8 7.7a1 1 0 0 0-.5-.5L.8 6l3.5-1.2a1 1 0 0 0 .5-.5z"/></svg>',
      up: '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4.5 7h-9z"/></svg>',
      board: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M3 8h14M8 8v9"/></svg>',
    }

    /** A Widget Type's icon: an `<img>` that falls back to a coloured tile. */
    const ic = (type, size = 22) =>
      `<span class="sy-ic" style="--s:${size}px;--ic-c:var(--sy-t-${type})"><img src="${ASSET}/${type}.webp" alt="" onerror="this.parentNode.dataset.fallback='1';this.remove()"></span>`
    const decoImg = (name) =>
      `<div class="sy-deco"><img src="${ASSET}/${name}.webp" alt="" onerror="this.remove()"></div>`

    const bar = (pct, colour) =>
      `<div class="sy-bar" style="--c:${colour}"><i style="width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%"></i></div>`

    const ring = (pct, size, stroke, colour, label) => {
      const radius = (size - stroke) / 2
      const length = 2 * Math.PI * radius
      const dash = length * (1 - Math.max(0, Math.min(1, pct)))
      return `<div class="sy-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--sy-well)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${length}" stroke-dashoffset="${dash}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .5s ease"/></svg><b>${esc(label)}</b></div>`
    }

    const monoTile = (name, colour) => {
      const first = [...String(name).replace(/^(Sample|示例)\s*/, '')][0] ?? '·'
      return `<span class="sy-mono-t" style="--c:${colour || tint(name)}">${esc(first)}</span>`
    }

    // ---- action plumbing ---------------------------------------------------

    async function api(path, init) {
      const response = await fetch(API + path, {
        cache: 'no-store',
        headers: { accept: 'application/json', ...(init?.headers ?? {}) },
        ...init,
      })
      const text = await response.text()
      const parsed = text ? (() => { try { return JSON.parse(text) } catch { return null } })() : null
      if (!response.ok) throw new Error(parsed?.error ?? `HTTP ${response.status}`)
      return parsed
    }

    const action = (name, body, precondition) =>
      api('/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          body: body ?? {},
          ...(precondition ? { precondition } : {}),
        }),
      })

    function inferPrecondition(daily, name, body) {
      if (!daily || !body) return undefined
      if (name === 'task.update' || name === 'task.remove') {
        const task = (daily.tasks ?? []).find((entry) => entry.id === body.id)
        if (Number.isSafeInteger(task?.revision)) return { entity: 'task', id: task.id, revision: task.revision }
      }
      if (name === 'note.remove') {
        const note = (daily.notes ?? []).find((entry) => entry.id === body.id)
        if (Number.isSafeInteger(note?.revision)) return { entity: 'note', id: note.id, revision: note.revision }
      }
      if (name === 'board.rename' || name === 'board.remove') {
        const board = (daily.boards ?? []).find((entry) => entry.id === body.id)
        if (Number.isSafeInteger(board?.revision)) return { entity: 'board', id: board.id, revision: board.revision }
      }
      if (name === 'widget.update' || name === 'widget.remove') {
        const widget = daily.widgets?.[body.id]
        if (Number.isSafeInteger(widget?.revision)) return { entity: 'widget', id: widget.id, revision: widget.revision }
      }
      if (name === 'layout.set' || name === 'widget.resize') {
        const boardId = body.boardId ?? daily.active
        const cols = body.cols ?? 12
        const lKey = `${boardId}-${cols}`.replace(/[^a-zA-Z0-9_-]/g, '-')
        const rev = daily.layoutRevisions?.[lKey]
        if (Number.isSafeInteger(rev)) return { entity: 'layout', id: lKey, revision: rev }
      }
      const settingsMap = {
        'interests.set': 'interests',
        'bookmarks.set': 'bookmarks',
        'habit.tick': 'habits',
        'focus.set': 'focus',
      }
      const sKey = settingsMap[name]
      if (sKey) {
        const rev = daily.settingsRevisions?.[sKey]
        if (Number.isSafeInteger(rev) && rev > 0) return { entity: 'settings', id: sKey, revision: rev }
      }
      return undefined
    }

    // ---- styles ------------------------------------------------------------

    const CSS = `
.sy-root {
  --sy-bg: #F3F4F6; --sy-card: #FFFFFF; --sy-well: #F5F6F8;
  --sy-line: rgba(20,22,30,.07); --sy-line2: rgba(20,22,30,.13);
  --sy-ink: #15171C; --sy-ink2: #5A5F69; --sy-ink3: #9CA1AB;
  --sy-accent: #6A6FCF; --sy-accent-soft: rgba(106,111,207,.10); --sy-accent-ink: #4A4FAE;
  --sy-bad: #CC4C42; --sy-ok: #3A9A68; --sy-on-photo: #FFFFFF;
  --sy-skel: rgba(20,22,30,.06); --sy-scrim: rgba(14,15,18,.34);
  --sy-shadow: 0 1px 2px rgba(16,18,24,.04), 0 10px 28px -16px rgba(16,18,24,.14);
  --sy-shadow-hover: 0 2px 4px rgba(16,18,24,.05), 0 16px 36px -16px rgba(16,18,24,.20);
  --sy-shadow-lift: 0 4px 10px rgba(16,18,24,.08), 0 28px 56px -18px rgba(16,18,24,.30);
  --sy-t-task: #6F74D3; --sy-t-subscription: #D98A4C; --sy-t-capture: #9A86CC;
  --sy-t-bookmarks: #4A9895; --sy-t-project: #66966B; --sy-t-readlater: #CC9632;
  --sy-t-habit: #D27690; --sy-t-focus: #C3654A; --sy-t-calendar: #E05A46;
  --sy-t-weather: #5E9FD3; --sy-t-briefing: #B8963A; --sy-t-embed: #6C7C93;
  --sy-t-agentInbox: #7C6FD4;
  /* Frosted chrome. The sticky bar must let content show through, or a headline scrolling under
     it is sliced in half — which is exactly what a phone reported. The blur alone is not enough:
     a translucent tint plus a hairline keeps the bar readable over a photo card, and the inset
     highlight is what gives it the frosted-glass edge rather than a flat wash. */
  --sy-chrome: rgba(243,244,246,.72); --sy-chrome-line: rgba(20,22,30,.06);
  --sy-chrome-lift: inset 0 1px 0 rgba(255,255,255,.65);
  --sy-blur: saturate(180%) blur(20px);
  --sy-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  --sy-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --sy-row: 88px; --sy-gap: 14px; --sy-radius: 16px;
  height: 100%; overflow: auto; background: var(--sy-bg); color: var(--sy-ink);
  font: 14px/1.45 var(--sy-font); -webkit-font-smoothing: antialiased;
}
/* Dark theme.
 *
 * The palette is warm-neutral rather than blue-black: a #121211 ground with #181816 surfaces.
 * A pure #0E0F12 reads as a screen; a slightly warm black reads as a surface, which is what
 * makes the frosted chrome on top of it look like glass instead of a lighter rectangle. The
 * values are deliberately close together — the separation comes from the hairline and the inset
 * highlight, not from a big luminance jump, which is what keeps a dense grid calm.
 */
.sy-root[data-theme="dark"] {
  --sy-bg: #121211; --sy-card: #181816; --sy-well: #201F1D;
  --sy-line: rgba(239,237,231,.07); --sy-line2: rgba(239,237,231,.14);
  --sy-ink: #EFEDE7; --sy-ink2: #D3D0C8; --sy-ink3: #8B8880;
  --sy-accent: #9CA4FF; --sy-accent-soft: rgba(156,164,255,.14); --sy-accent-ink: #BCC1FF;
  --sy-bad: #F2766A; --sy-ok: #88C49C; --sy-skel: rgba(239,237,231,.06); --sy-scrim: rgba(0,0,0,.62);
  /* Inset top highlight first: on a dark surface the 1px "lit edge" is what sells the material. */
  --sy-shadow: inset 0 1px 0 rgba(239,237,231,.035), 0 1px 2px rgba(0,0,0,.4), 0 12px 30px -18px rgba(0,0,0,.75);
  --sy-shadow-hover: inset 0 1px 0 rgba(239,237,231,.05), 0 2px 6px rgba(0,0,0,.45), 0 18px 38px -18px rgba(0,0,0,.85);
  --sy-shadow-lift: inset 0 1px 0 rgba(239,237,231,.06), 0 8px 20px rgba(0,0,0,.5), 0 32px 60px -20px rgba(0,0,0,.9);
  /* Chrome sits *over* content, so it is a tinted veil, not a solid fill. */
  --sy-chrome: rgba(18,18,17,.72); --sy-chrome-line: rgba(239,237,231,.08);
  --sy-chrome-lift: inset 0 1px 0 rgba(239,237,231,.05);
  color-scheme: dark;
}
/* Grain.
 *
 * A flat dark fill shows banding on OLED phones and looks synthetic next to photos. One inline
 * SVG turbulence at a few percent breaks it up and costs a single cached paint — no texture
 * file, no request. Blend mode overlay keeps it from washing out the ink beneath.
 *
 * It rides on a dedicated child element rather than ::after: the panel already uses ::after on
 * .sy-root for nothing else today, but a pseudo-element is one rule away from a collision, and
 * a real node can be toggled and inspected. A fixed position with inset zero covers the viewport
 * without changing layout, and pointer-events none keeps every click on the card beneath.
 */
.sy-grain {
  position: fixed; inset: 0; z-index: 60; pointer-events: none; opacity: .03;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
}
.sy-root[data-theme="dark"] .sy-grain { opacity: .05; }
.sy-root *, .sy-root *::before, .sy-root *::after { box-sizing: border-box; }
/* Element resets.
 *
 * Two separate hazards, and they pull in opposite directions:
 *
 * 1. SPECIFICITY. A plain ".sy-root button { border: 0 }" is (0,1,1) and outranks every
 *    single-class component rule — ".sy-btn" is only (0,1,0) — which silently stripped the
 *    border and padding off every button in the panel. So the resets go through :where(),
 *    which contributes nothing.
 *
 * 2. INHERITED COLOUR FROM THE HOST SKIN. Zero specificity is not enough for the color
 *    property here: an installed UI skin sets tag-level colours (!important on anchor and
 *    code elements), so a reset that loses paints every link in salmon and every code span
 *    in orange — which is exactly what happened. The revert keyword plus !important is the
 *    only combination that wins against a !important author rule of any specificity, and
 *    revert keeps the browser default (currentColor for a link, monospace for code) instead
 *    of hard-coding a colour. Do not weaken these two declarations; verify with
 *    getComputedStyle after any change.
 */
.sy-root :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.sy-root :where(input, textarea) { font: inherit; color: inherit; }
.sy-root :where(a) { color: inherit !important; text-decoration: none !important; }
.sy-root :where(code, kbd, samp) { color: inherit !important; font-family: var(--sy-mono) !important; }
/* Headings are the skin's most visible fingerprint: it swaps in a serif display face and a
   second type ramp. Reset the FACE only, never the shorthand: a "font" shorthand here (or
   font: inherit) also overrides every component's own font-size and font-weight, which
   silently flattened the panel's 40px headline to 14px/400. */
.sy-root :where(h1, h2, h3, h4, h5, h6) { font-family: var(--sy-font) !important; color: inherit !important; margin: 0; }
.sy-root :focus-visible { outline: 2px solid var(--sy-accent); outline-offset: 2px; border-radius: 8px; }
.sy-root svg { display: block; flex: none; }
.sy-root .c1, .sy-root .c2, .sy-root .c3, .sy-root .c4, .sy-root .c8 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.sy-root .c1 { -webkit-line-clamp: 1; } .sy-root .c2 { -webkit-line-clamp: 2; }
.sy-root .c3 { -webkit-line-clamp: 3; } .sy-root .c4 { -webkit-line-clamp: 4; }
.sy-root .c8 { -webkit-line-clamp: 8; }
.sy-root .grow { flex: 1; min-width: 0; }
.sy-root .meta { font-size: 12px; color: var(--sy-ink3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sy-root .mono-l { font: 500 11px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-ink3); flex: none; white-space: nowrap; }
.sy-page { padding: 0 20px 72px; }
.sy-frame { max-width: 1440px; margin: 0 auto; container: sy / inline-size; }
.sy-main { min-width: 0; }
/* The sticky bar.
 *
 * It used to paint an opaque background. On a phone the bar wraps to four rows and stands 156px
 * tall, so a headline scrolling under it was cut through the middle of its glyphs and the panel
 * looked broken. Three changes fix that and make it feel like glass:
 *
 *  1. a translucent tint plus a backdrop filter, so content shows through blurred instead of
 *     being sliced by an opaque rectangle;
 *  2. a hairline instead of a shadow, because a shadow under a wrapped bar reads as a second
 *     card edge on a small screen;
 *  3. a blurred veil rather than a solid fill, so the bar stays legible over a photo card.
 *
 * The webkit-prefixed property is listed for Safari and iOS, which is where a phone browser
 * usually is.
 */
.sy-topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding-block: 12px;
  background: var(--sy-chrome);
  -webkit-backdrop-filter: var(--sy-blur); backdrop-filter: var(--sy-blur);
  box-shadow: var(--sy-chrome-lift), 0 1px 0 var(--sy-chrome-line);
}
/* A fallback for a browser that ignores backdrop-filter: the tint must still hide scrolled text,
   or the bug this block exists for comes back. The supports-not query keeps it to exactly those. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sy-topbar { background: var(--sy-bg); }
}
.sy-brand { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 17px; letter-spacing: -.02em; white-space: nowrap; }
.sy-brand i { width: 22px; height: 22px; border-radius: 7px; background: conic-gradient(from 210deg, #93A8F0, #C9A6EE, #93A8F0); box-shadow: inset 0 0 0 1px rgba(255,255,255,.5); }
.sy-brand span { color: var(--sy-ink3); font-weight: 500; }
.sy-seg { display: flex; padding: 3px; background: var(--sy-well); border: 1px solid var(--sy-line); border-radius: 12px; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.sy-seg::-webkit-scrollbar { display: none; }
.sy-seg button { padding: 6px 12px; border-radius: 9px; color: var(--sy-ink2); font-weight: 500; white-space: nowrap; }
.sy-seg button:hover { color: var(--sy-ink); }
.sy-seg button[aria-pressed="true"] { background: var(--sy-card); color: var(--sy-ink); box-shadow: 0 1px 2px rgba(16,18,24,.08), 0 0 0 1px var(--sy-line); }
.sy-seg .sy-seg-add { color: var(--sy-ink3); padding: 6px 9px; }
.sy-cmd { position: relative; flex: 1; min-width: 0; max-width: 520px; margin-inline: auto; }
.sy-cmd-box { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 5px 0 12px; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 12px; box-shadow: var(--sy-shadow); color: var(--sy-ink3); }
.sy-cmd-box:focus-within { border-color: color-mix(in srgb, var(--sy-accent) 45%, transparent); }
.sy-cmd-box input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--sy-ink); }
.sy-root kbd { font: 500 11px/1 var(--sy-mono); color: var(--sy-ink3); border: 1px solid var(--sy-line2); border-radius: 6px; padding: 3px 6px; white-space: nowrap; }
.sy-cmd-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 14px; box-shadow: var(--sy-shadow-lift); padding: 6px; max-height: min(420px, 60vh); overflow: auto; }
.sy-cmd-group { font: 500 11px/1 var(--sy-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--sy-ink3); padding: 10px 10px 6px; }
.sy-cmd-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 9px; text-align: left; min-width: 0; }
.sy-cmd-item[aria-selected="true"] { background: var(--sy-accent-soft); }
.sy-cmd-item .k { font: 500 11px/1 var(--sy-mono); color: var(--sy-ink2); background: var(--sy-well); border-radius: 6px; padding: 4px 6px; flex: none; }
.sy-cmd-item .ci-t { flex: 1; min-width: 0; }
.sy-cmd-empty { padding: 14px 10px; color: var(--sy-ink3); font-size: 13px; }
.sy-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.sy-btn { height: 34px; padding: 0 13px; border-radius: 11px; border: 1px solid var(--sy-line2); background: var(--sy-card); font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.sy-btn:hover { border-color: var(--sy-ink3); }
.sy-btn:disabled { opacity: .4; cursor: not-allowed; }
.sy-btn-ink { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-btn-wide { height: 48px; border-radius: 14px; font-size: 15px; color: var(--sy-ink3); width: 100%; }
.sy-btn-wide b { color: var(--sy-ink); font-weight: 500; }
.sy-icon-btn { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; border: 1px solid var(--sy-line2); background: var(--sy-card); color: var(--sy-ink2); flex: none; }
.sy-icon-btn:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }
.sy-switch { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 4px 0 10px; border-radius: 11px; font-weight: 500; color: var(--sy-ink2); white-space: nowrap; }
.sy-switch:hover { color: var(--sy-ink); }
.sy-sw { width: 44px; height: 26px; border-radius: 99px; background: var(--sy-well); border: 1px solid var(--sy-line2); position: relative; transition: background .25s; }
.sy-sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--sy-card); box-shadow: 0 2px 6px rgba(16,18,24,.22); transition: transform .25s cubic-bezier(.3,.7,.2,1); }
.sy-switch[aria-checked="true"] { color: var(--sy-ink); }
.sy-switch[aria-checked="true"] .sy-sw { background: linear-gradient(90deg, #93A8F0, #C9A6EE); border-color: transparent; }
.sy-switch[aria-checked="true"] .sy-sw::after { transform: translateX(18px); background: #FFFFFF; }
@container sy (max-width: 1080px) {
  .sy-topbar { flex-wrap: wrap; row-gap: 10px; }
  .sy-cmd { order: 5; flex-basis: 100%; max-width: none; }
}
/* Phone.
 *
 * The bar used to become four stacked rows (brand + actions / command / boards), 156px tall on a
 * 390px screen — 18% of the viewport spent on chrome, and enough to swallow the headline when it
 * scrolled. This keeps it to two rows by putting the board strip on the *same* row as the brand,
 * scrolling horizontally when it does not fit. That is how a mobile tab bar behaves, and it is
 * what the strip's own overflow rule was already built for.
 *
 * The brand drops its word mark and the command box drops its shortcut hint: both are affordances
 * a touch screen does not have, so removing them buys the row the strip needs.
 *
 * Placement matters: this block sits AFTER the base rules it overrides. A container query does not
 * add specificity, so a phone rule written above its base rule loses on source order — which is
 * exactly how the first attempt produced a 20px headline that still measured 24px.
 */
.sy-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-block: 26px 22px; }
.sy-tag { display: inline-block; font: 500 11px/1 var(--sy-mono); letter-spacing: .06em; border: 1px solid var(--sy-ink2); color: var(--sy-ink); border-radius: 5px; padding: 4px 6px; margin-bottom: 16px; }
.sy-headline { margin: 0; font-size: clamp(24px, 3cqi, 40px); line-height: 1.2; letter-spacing: -.028em; font-weight: 500; color: var(--sy-ink3); max-width: 23em; text-wrap: balance; }
.sy-headline b { color: var(--sy-ink); font-weight: 500; }
.sy-hi { display: inline-block; width: 1.18em; height: 1.18em; vertical-align: -.24em; margin: 0 .04em 0 .02em; filter: drop-shadow(0 6px 10px rgba(16,18,24,.16)); transform: rotate(-7deg); }
.sy-hi.r { transform: rotate(6deg); }
.sy-nw { white-space: nowrap; }
.sy-status { display: flex; align-items: center; gap: 8px; font: 12px var(--sy-mono); color: var(--sy-ink2); white-space: nowrap; padding-bottom: 6px; }
.sy-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--sy-ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sy-ok) 18%, transparent); }
.sy-status i.warn { background: var(--sy-bad); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sy-bad) 18%, transparent); }
@container sy (max-width: 720px) {
  .sy-hero { flex-direction: column; align-items: flex-start; gap: 12px; padding-block: 16px; }
  .sy-headline { font-size: 24px; }
}
.sy-editbar { display: flex; align-items: center; gap: 10px; padding: 9px 9px 9px 13px; border-radius: 14px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); margin-bottom: 14px; font-size: 13px; }
.sy-grid { display: grid; grid-template-columns: repeat(var(--cols, 12), minmax(0, 1fr)); grid-auto-rows: var(--sy-row); gap: var(--sy-gap); position: relative; }
@container sy (max-width: 640px) { .sy-grid { --sy-gap: 12px; } }
.sy-w { position: relative; display: flex; flex-direction: column; min-width: 0; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: var(--sy-radius); box-shadow: var(--sy-shadow); padding: 15px; overflow: hidden; transition: box-shadow .2s ease; }
.sy-w:hover { box-shadow: var(--sy-shadow-hover); }
.sy-w-h { display: flex; align-items: center; gap: 8px; height: 24px; margin-bottom: 9px; flex: none; min-width: 0; }
.sy-w-t { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; white-space: nowrap; overflow: hidden; }
.sy-w-t b { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.sy-w-t span { font-size: 12px; color: var(--sy-ink3); overflow: hidden; text-overflow: ellipsis; }
.sy-w-m { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; color: var(--sy-ink3); opacity: 0; transition: opacity .15s; flex: none; }
.sy-w:hover .sy-w-m, .sy-w:focus-within .sy-w-m { opacity: 1; }
.sy-w-m:hover { background: var(--sy-well); color: var(--sy-ink); }
.sy-w-m.abs { position: absolute; top: 10px; right: 10px; z-index: 3; }
@media (hover: none) { .sy-w-m { opacity: .7; } }
.sy-w-b { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 9px; position: relative; z-index: 1; }
.sy-w--s .sy-w-b { gap: 0; justify-content: space-between; }
.sy-ic { display: inline-grid; place-items: center; width: var(--s, 22px); height: var(--s, 22px); border-radius: 28%; background: transparent; flex: none; }
.sy-ic img { width: 100%; height: 100%; object-fit: contain; }
.sy-ic[data-fallback] { background: color-mix(in srgb, var(--ic-c, var(--sy-accent)) 22%, var(--sy-card)); }
.sy-deco { position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: inherit; z-index: 0; }
.sy-deco img { position: absolute; right: -16px; bottom: -20px; width: 112px; height: 112px; transform: rotate(-8deg); filter: drop-shadow(0 10px 18px rgba(16,18,24,.16)); }
.sy-s-lab { font-size: 12px; font-weight: 500; color: var(--sy-ink2); display: flex; align-items: center; gap: 6px; padding-right: 26px; white-space: nowrap; overflow: hidden; }
.sy-s-main { display: flex; flex-direction: column; }
.sy-s-big { font-size: 48px; font-weight: 300; line-height: 1; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.sy-s-big small { font-size: 20px; color: var(--sy-ink3); letter-spacing: 0; margin-left: 3px; font-weight: 400; }
.sy-s-sub { font-size: 13px; color: var(--sy-ink2); margin-top: 5px; }
.sy-s-narrow { max-width: 64%; }
.sy-s-next { display: flex; align-items: center; gap: 8px; max-width: 70%; text-align: left; font-size: 13px; color: var(--sy-ink2); }
.sy-s-title { font-size: 16px; font-weight: 600; line-height: 1.32; letter-spacing: -.01em; }
.sy-list { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.sy-fit { flex: 1; min-height: 0; overflow: hidden; }
.sy-fit-x { display: flex; gap: 12px; overflow: hidden; flex: 1; min-height: 0; }
.sy-row { position: relative; display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 4px 8px; margin-inline: -8px; border-radius: 10px; min-width: 0; flex: none; }
.sy-row:hover { background: var(--sy-well); }
.sy-row .tt { font-size: 13.5px; font-weight: 500; }
.sy-it-a { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.sy-chk { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--sy-ink3); display: grid; place-items: center; flex: none; color: transparent; transition: background .15s, border-color .15s; }
.sy-chk:hover { border-color: var(--sy-accent); }
.sy-done .sy-chk { background: var(--sy-accent); border-color: var(--sy-accent); color: var(--sy-card); }
.sy-done .tt, .sy-done .t-title { color: var(--sy-ink3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--sy-ink3) 60%, transparent); }
.sy-t-title { font-size: 13.5px; }
.sy-t-m { min-height: 50px; align-items: flex-start; padding-top: 8px; }
.sy-t-m .sy-chk { margin-top: 1px; }
.sy-chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 99px; background: var(--sy-well); color: var(--sy-ink2); font-size: 11px; white-space: nowrap; flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; }
.sy-root a.sy-chip:hover { color: var(--sy-accent-ink); background: var(--sy-accent-soft); }
.sy-acts { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: none; gap: 4px; z-index: 2; }
.sy-row:hover .sy-acts, .sy-row:focus-within .sy-acts, .sy-lead:hover .sy-acts, .sy-ncard:hover .sy-acts { display: flex; }
.sy-acts button, .sy-acts a { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--sy-card); border: 1px solid var(--sy-line2); color: var(--sy-ink2); box-shadow: var(--sy-shadow); }
.sy-acts button:hover, .sy-acts a:hover { color: var(--sy-accent-ink); }
.sy-acts [aria-pressed="true"] { color: var(--sy-accent-ink); background: var(--sy-accent-soft); }
.sy-mini { height: 24px; padding: 0 8px; border-radius: 7px; font-size: 12px; color: var(--sy-ink2); background: var(--sy-card); border: 1px solid var(--sy-line2); flex: none; white-space: nowrap; }
.sy-mini:hover { color: var(--sy-accent-ink); border-color: color-mix(in srgb, var(--sy-accent) 40%, transparent); }
.sy-bar { height: 6px; border-radius: 3px; background: var(--sy-well); overflow: hidden; flex: none; }
.sy-bar i { display: block; height: 100%; border-radius: 3px; background: var(--c, var(--sy-accent)); transition: width .4s ease; }
.sy-grid2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; row-gap: 4px; min-height: 0; flex: 1; align-content: start; overflow: hidden; }
.sy-grid2.r3 { grid-template-rows: repeat(3, auto); grid-auto-flow: column; row-gap: 0; }
.sy-rk-n { width: 22px; font-size: 18px; font-weight: 300; color: var(--sy-ink3); font-variant-numeric: tabular-nums; text-align: right; flex: none; letter-spacing: -.03em; }
.sy-rk-n.top { color: var(--sy-ink); }
.sy-rk-row { min-height: 30px; }
.sy-rk-row .tt { font-weight: 450; }
.sy-thumb { border-radius: 9px; overflow: hidden; background: var(--sy-well); flex: none; position: relative; }
.sy-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sy-gen { display: grid; place-items: center; width: 100%; height: 100%; background: linear-gradient(140deg, color-mix(in srgb, var(--c) 30%, var(--sy-card)), color-mix(in srgb, var(--c) 8%, var(--sy-card))); color: color-mix(in srgb, var(--c) 75%, var(--sy-ink)); font: 600 12px/1.2 var(--sy-font); text-align: center; padding: 6px; }
.sy-mono-t { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-weight: 650; font-size: 14px; background: color-mix(in srgb, var(--c) 16%, var(--sy-card)); color: color-mix(in srgb, var(--c) 80%, var(--sy-ink)); flex: none; }
.sy-m-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 18px; flex: 1; min-height: 0; }
.sy-lead { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 0; flex: none; }
.sy-lead .sy-acts { top: 6px; right: 6px; transform: none; }
.sy-lead-t { font-size: 15px; font-weight: 600; line-height: 1.35; letter-spacing: -.01em; }
.sy-lead-t.lg { font-size: 17px; }
.sy-reason { font-size: 13px; color: var(--sy-ink2); line-height: 1.5; }
.sy-reason::before { content: "推荐理由"; font: 500 10.5px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-ink3); border: 1px solid var(--sy-line2); border-radius: 4px; padding: 2px 4px; margin-right: 6px; vertical-align: 1px; }
.sy-tldr { font-size: 12.5px; line-height: 1.5; color: var(--sy-ink2); background: var(--sy-well); border-radius: 10px; padding: 6px 9px; flex: none; }
.sy-w--photo { padding: 0; border-color: transparent; }
.sy-w--photo .bgimg { position: absolute; inset: 0; z-index: 0; }
.sy-w--photo .bgimg img { width: 100%; height: 100%; object-fit: cover; }
.sy-w--photo .bgimg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,12,16,.82), rgba(10,12,16,.12) 62%, rgba(10,12,16,.3)); }
.sy-w--photo .sy-w-b { padding: 13px 15px; color: var(--sy-on-photo); justify-content: space-between; }
.sy-w--photo .sy-s-lab { color: rgba(255,255,255,.86); }
.sy-w--photo .meta { color: rgba(255,255,255,.7); }
.sy-w--photo .sy-w-m { color: rgba(255,255,255,.85); }
.sy-w--photo .sy-w-m:hover { background: rgba(255,255,255,.16); color: #FFFFFF; }
.sy-w--photo .sy-acts { top: auto; bottom: 10px; right: 10px; transform: none; }
.sy-w--photo:hover .sy-acts { display: flex; }
.sy-cover { height: 124px; border-radius: 12px; overflow: hidden; background: var(--sy-well); flex: none; position: relative; }
.sy-cover img { width: 100%; height: 100%; object-fit: cover; }
.sy-nl-top { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; flex: none; }
.sy-nl { flex-direction: row; gap: 14px; align-items: flex-start; }
.sy-nl-cover { flex: 0 0 172px; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: var(--sy-well); max-width: 40%; }
.sy-nl-cover img { width: 100%; height: 100%; object-fit: cover; }
.sy-nl-t, .sy-pl-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.sy-cat { font-size: 11px; line-height: 1; font-weight: 500; color: color-mix(in srgb, var(--c) 78%, var(--sy-ink)); background: color-mix(in srgb, var(--c) 14%, var(--sy-card)); border-radius: 5px; padding: 4px 6px; flex: none; }
.sy-cdot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; align-self: flex-start; margin-top: 8px; }
.sy-score { display: inline-grid; place-items: center; min-width: 26px; height: 20px; padding: 0 6px; border-radius: 6px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; background: var(--sy-well); color: var(--sy-ink2); flex: none; }
.sy-score.hi { background: var(--sy-ink); color: var(--sy-bg); }
.sy-sc { font-size: 12px; font-weight: 600; color: var(--sy-ink3); font-variant-numeric: tabular-nums; min-width: 20px; text-align: right; flex: none; }
.sy-seen .tt, .sy-seen .sy-lead-t { color: var(--sy-ink3); font-weight: 450; }
.sy-tabs { display: flex; gap: 2px; flex: none; overflow-x: auto; scrollbar-width: none; }
.sy-tabs::-webkit-scrollbar { display: none; }
.sy-tabs button { height: 26px; padding: 0 9px; border-radius: 8px; font-size: 12.5px; color: var(--sy-ink2); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
.sy-tabs button span { font-size: 11px; color: var(--sy-ink3); font-variant-numeric: tabular-nums; }
.sy-tabs button:hover { background: var(--sy-well); }
.sy-tabs button[aria-pressed="true"] { background: var(--sy-ink); color: var(--sy-bg); }
.sy-tabs button[aria-pressed="true"] span { color: color-mix(in srgb, var(--sy-bg) 65%, transparent); }
.sy-heat { width: 42px; height: 4px; border-radius: 2px; background: var(--sy-well); flex: none; overflow: hidden; }
.sy-heat i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, color-mix(in srgb, var(--sy-t-subscription) 45%, var(--sy-card)), var(--sy-t-subscription)); }
.sy-heat.wide { width: 60px; }
.sy-up { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 7px; border-radius: 7px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--sy-t-readlater) 17%, var(--sy-card)); color: color-mix(in srgb, var(--sy-t-readlater) 70%, var(--sy-ink)); flex: none; }
.sy-up.big { height: auto; padding: 0; background: none; font-size: 30px; font-weight: 300; letter-spacing: -.03em; gap: 6px; color: var(--sy-ink); align-self: flex-start; }
.sy-kws { display: flex; flex-wrap: wrap; gap: 4px; height: 20px; overflow: hidden; flex: none; }
.sy-kws .sy-chip { max-width: none; }
.sy-chip.match { background: var(--sy-accent-soft); color: var(--sy-accent-ink); gap: 3px; }
.sy-links { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; flex: none; }
.sy-links a { color: var(--sy-ink2); display: inline-flex; align-items: center; gap: 4px; }
.sy-links a:hover { color: var(--sy-accent-ink); }
.sy-links code { font-family: var(--sy-mono); font-size: 11.5px; color: var(--sy-ink3); }
.sy-pl { flex-direction: row; gap: 14px; }
.sy-pl-fig { flex: 0 0 156px; height: 104px; border-radius: 10px; overflow: hidden; background: #FFFFFF; border: 1px solid var(--sy-line); }
.sy-pl-fig img { width: 100%; height: 100%; object-fit: contain; }
.sy-pr .sy-rk-n { font-size: 14px; }
.sy-ncard { position: relative; flex: 0 0 260px; display: flex; flex-direction: column; gap: 6px; padding: 11px 13px; border-radius: 12px; background: var(--sy-well); min-width: 0; }
.sy-fit-x > .sy-ncard { flex: 1 0 240px; }
.sy-ncard .sy-chip:not(.match) { background: var(--sy-card); }
.sy-ncard .foot { margin-top: auto; }
.sy-ncard .sy-acts { top: 6px; right: 6px; transform: none; }
.sy-reason-plain { font-size: 12.5px; line-height: 1.5; color: var(--sy-ink2); }
.sy-vt { position: relative; display: block; border-radius: 10px; overflow: hidden; background: var(--sy-well); flex: none; }
.sy-vt img, .sy-ep img, .sy-s916 img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; display: block; }
.sy-vt:hover img, .sy-ep:hover img, .sy-s916:hover img { transform: scale(1.045); }
.sy-vplay { position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; margin: -19px 0 0 -19px; border-radius: 50%; background: rgba(255,255,255,.92); color: #15171C; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(0,0,0,.28); transition: transform .2s ease; z-index: 1; }
.sy-vplay svg { margin-left: 2px; }
.sy-vt:hover .sy-vplay, .sy-ep:hover .sy-vplay { transform: scale(1.1); }
.sy-vbadge { position: absolute; left: 8px; bottom: 8px; font-size: 11px; font-weight: 600; color: #FFFFFF; background: rgba(10,12,16,.62); padding: 3px 6px; border-radius: 6px; z-index: 1; }
.sy-vm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.sy-vm .sy-vt { height: 100%; aspect-ratio: 16 / 9; }
.sy-vm-t { display: flex; flex-direction: column; gap: 6px; min-width: 0; justify-content: center; }
.sy-vL { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.sy-vL-ep { display: flex; flex-direction: column; gap: 9px; min-width: 0; min-height: 0; }
.sy-vL-ep .sy-vt { aspect-ratio: 16 / 9; width: 100%; }
.sy-vL-sh { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.sy-reel2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; }
.sy-reel2 .sy-s916 { height: auto; width: 100%; }
.sy-reel { gap: 8px; }
.sy-s916, .sy-ep { position: relative; flex: 0 0 auto; height: 100%; border-radius: 10px; overflow: hidden; background: var(--sy-well); display: block; }
.sy-s916 { aspect-ratio: 9 / 16; }
.sy-ep { aspect-ratio: 16 / 9; border-radius: 12px; }
.sy-s916::after, .sy-ep::after { content: ""; position: absolute; inset: 35% 0 0; background: linear-gradient(to top, rgba(10,12,16,.9), rgba(10,12,16,.55) 45%, transparent); }
.sy-s916 > span { position: absolute; left: 7px; right: 7px; bottom: 7px; z-index: 1; color: #FFFFFF; font-size: 11.5px; line-height: 1.3; }
.sy-s916 em { font-style: normal; font-weight: 500; }
.sy-s916 b { display: block; font-weight: 600; font-size: 10.5px; opacity: .8; margin-top: 3px; }
.sy-ep-t { position: absolute; left: 13px; right: 13px; bottom: 11px; z-index: 1; color: #FFFFFF; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.sy-ep-t b { font-size: 15px; font-weight: 600; line-height: 1.35; }
.sy-ep-t .mono-l { color: rgba(255,255,255,.75); }
.sy-ep-t > span:last-child { color: rgba(255,255,255,.78); }
.sy-cap { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 8px 0 13px; border-radius: 12px; background: var(--sy-well); border: 1px solid var(--sy-line); flex: none; }
.sy-cap:focus-within { border-color: color-mix(in srgb, var(--sy-accent) 45%, transparent); background: var(--sy-card); }
.sy-cap input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: 15px; }
.sy-cap input::placeholder { color: var(--sy-ink3); }
.sy-cap-wide { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; flex: 1; min-height: 0; align-items: start; }
.sy-cap-hint { font-size: 12px; color: var(--sy-ink3); flex: none; }
.sy-cap-hint code { font-family: var(--sy-mono); color: var(--sy-ink2); background: var(--sy-well); border-radius: 4px; padding: 1px 4px; }
.sy-kind { font: 500 10.5px/1 var(--sy-mono); padding: 3px 5px; border-radius: 4px; flex: none; text-transform: uppercase; letter-spacing: .03em; }
.sy-kind.task { background: color-mix(in srgb, var(--sy-t-task) 15%, var(--sy-card)); color: color-mix(in srgb, var(--sy-t-task) 80%, var(--sy-ink)); }
.sy-kind.note { background: color-mix(in srgb, var(--sy-t-capture) 15%, var(--sy-card)); color: color-mix(in srgb, var(--sy-t-capture) 80%, var(--sy-ink)); }
.sy-bm-s { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 6px; align-content: center; flex: 1; }
.sy-bm-tile { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0; border-radius: 12px; padding: 2px 0; }
.sy-bm-tile .sy-mono-t { width: 42px; height: 42px; border-radius: 13px; font-size: 17px; }
.sy-bm-tile span { font-size: 11.5px; color: var(--sy-ink2); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sy-bm-grid { display: grid; gap: 8px 12px; flex: 1; align-content: start; }
.sy-bm-chip { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 4px; border-radius: 10px; }
.sy-bm-chip:hover { background: var(--sy-well); }
.sy-bm-chip .sy-mono-t { width: 30px; height: 30px; border-radius: 9px; font-size: 13px; }
.sy-bm-chip span { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sy-ring { position: relative; flex: none; }
.sy-ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sy-pj-s { display: flex; align-items: center; gap: 13px; min-width: 0; }
.sy-pj-row { display: flex; flex-direction: column; gap: 6px; flex: none; padding: 2px 0; }
.sy-pj-row .sy-pj-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sy-pj-row .sy-pj-h b { font-size: 13.5px; font-weight: 600; }
.sy-pj-dot { width: 8px; height: 8px; border-radius: 3px; background: var(--c); flex: none; }
.sy-dots7 { display: flex; gap: 5px; flex: none; }
.sy-dots7 button, .sy-dots7 span { width: 18px; height: 18px; border-radius: 6px; background: var(--sy-well); border: 1px solid var(--sy-line); display: grid; place-items: center; font-size: 9.5px; color: var(--sy-ink3); }
.sy-dots7 .on { background: color-mix(in srgb, var(--sy-t-habit) 78%, var(--sy-card)); border-color: transparent; color: #FFFFFF; }
.sy-dots7 .future { opacity: .45; background: transparent; border-style: dashed; }
.sy-dots7 .today { border: 1.5px dashed color-mix(in srgb, var(--sy-t-habit) 70%, transparent); }
.sy-dots7 .today.on { border: 0; }
.sy-hb-row { display: flex; align-items: center; gap: 12px; min-width: 0; flex: none; min-height: 32px; }
.sy-fd { font-size: 42px; font-weight: 300; letter-spacing: -.04em; font-variant-numeric: tabular-nums; line-height: 1; }
.sy-fx { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sy-play-btn { width: 38px; height: 38px; border-radius: 50%; background: var(--sy-ink); color: var(--sy-bg); display: grid; place-items: center; flex: none; box-shadow: var(--sy-shadow); }
.sy-play-btn.ghost { background: var(--sy-well); color: var(--sy-ink2); box-shadow: none; }
.sy-fm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: center; flex: 1; min-height: 0; }
.sy-fm .sy-ring b { font-size: 18px; font-weight: 400; letter-spacing: -.02em; }
.sy-sess { display: flex; gap: 4px; }
.sy-sess i { width: 18px; height: 6px; border-radius: 3px; background: var(--sy-well); }
.sy-sess i.on { background: var(--sy-t-focus); }
.sy-deck { display: flex; flex-direction: column; flex: 1; min-height: 0; outline: none; }
.sy-dk-stage { position: relative; flex: 1; min-height: 0; }
.sy-dk-card { position: absolute; inset: 0 0 10px; border-radius: 14px; overflow: hidden; background: var(--sy-card); border: 1px solid var(--sy-line2); box-shadow: 0 1px 2px rgba(16,18,24,.05), 0 14px 26px -18px rgba(16,18,24,.35); transition: transform .55s cubic-bezier(.2,.85,.25,1), opacity .35s ease; transform-origin: 50% 100%; opacity: 0; user-select: none; touch-action: pan-y; cursor: grab; }
.sy-dk-card[data-pos="cur"] { z-index: 3; opacity: 1; }
.sy-dk-card[data-pos="n1"] { z-index: 2; opacity: 1; transform: translateY(7px) scale(.955); }
.sy-dk-card[data-pos="n2"] { z-index: 1; opacity: .55; transform: translateY(13px) scale(.91); }
.sy-dk-card[data-pos="hide"] { transform: translateY(13px) scale(.9); }
.sy-dk-card[data-pos="past"] { transform: translateX(-118%) rotate(-12deg); }
.sy-dk-card:not([data-pos="cur"]) { pointer-events: none; }
.sy-dk-card:not([data-pos="cur"]) .sy-dk-in { filter: saturate(.6); }
.sy-deck.dragging .sy-dk-card[data-pos="cur"] { transition: none; cursor: grabbing; }
.sy-deck.no-anim .sy-dk-card { transition: none !important; }
.sy-dk-in { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 9px; padding: 15px 17px; }
.sy-w--m .sy-dk-in { padding: 10px 13px; gap: 6px; }
.sy-dk-in.center { align-items: center; justify-content: center; text-align: center; gap: 8px; }
.sy-dk-in.center img { width: 76px; height: 76px; }
.sy-dk-in.center b { font-size: 15px; }
.sy-dk-top { display: flex; align-items: center; gap: 6px; min-width: 0; flex: none; }
.sy-dk-src { font: 600 11px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-ink2); text-transform: uppercase; white-space: nowrap; }
.sy-dk-time { font-size: 12px; color: var(--sy-ink3); white-space: nowrap; }
.sy-dk-main { display: flex; flex-direction: column; gap: 7px; min-height: 0; }
.sy-dk-title { font-size: 17px; font-weight: 650; line-height: 1.32; letter-spacing: -.015em; }
.sy-dk-title.lg { font-size: 20px; }
.sy-w--m .sy-dk-title { font-size: 15px; }
.sy-dk-sum { margin: 0; font-size: 13px; line-height: 1.55; color: var(--sy-ink2); }
.sy-dk-sum.tl { background: color-mix(in srgb, var(--sy-card) 70%, transparent); border: 1px solid var(--sy-line); border-radius: 10px; padding: 7px 9px; }
.sy-w--m .sy-dk-sum.tl { border: 0; padding: 0; background: none; font-size: 12.5px; }
.sy-dk-meta { font-size: 12px; color: var(--sy-ink3); }
.sy-dk-hint { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--sy-ink3); }
.sy-dk-art { position: absolute; inset: 0; background: radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, var(--c, var(--sy-accent)) 24%, transparent), transparent 62%), radial-gradient(90% 80% at 0% 100%, color-mix(in srgb, var(--sy-accent) 10%, transparent), transparent 70%), var(--sy-card); }
.sy-dk-art.paper { --c: var(--sy-t-readlater); }
.sy-dk-big { position: absolute; right: 12px; top: -6px; z-index: 0; font-size: 116px; font-weight: 200; line-height: 1; letter-spacing: -.07em; color: color-mix(in srgb, var(--c, var(--sy-t-readlater)) 20%, transparent); pointer-events: none; }
.sy-w--m .sy-dk-big { font-size: 78px; }
.sy-dk-bg { position: absolute; inset: 0; }
.sy-dk-bg img { width: 100%; height: 100%; object-fit: cover; }
.sy-dk-bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,12,16,.9), rgba(10,12,16,.45) 55%, rgba(10,12,16,.2)); }
.sy-on-photo .sy-dk-in, .sy-on-photo .sy-dk-title, .sy-on-photo .sy-dk-src { color: #FFFFFF; }
.sy-on-photo .sy-dk-sum, .sy-on-photo .sy-dk-meta, .sy-on-photo .sy-dk-time { color: rgba(255,255,255,.78); }
.sy-on-photo .sy-chip.match { background: rgba(255,255,255,.18); color: #FFFFFF; }
.sy-dk-card[data-pos="cur"] .sy-dk-main > * { animation: sy-dkin .55s cubic-bezier(.2,.8,.2,1) both; }
.sy-dk-card[data-pos="cur"] .sy-dk-main > :nth-child(2) { animation-delay: .06s; }
.sy-dk-card[data-pos="cur"] .sy-dk-main > :nth-child(3) { animation-delay: .12s; }
@keyframes sy-dkin { from { opacity: 0; transform: translateY(10px); } }
.sy-ctl { display: flex; align-items: center; gap: 8px; flex: none; margin-top: 6px; min-width: 0; }
.sy-nav { width: 26px; height: 26px; border-radius: 9px; border: 1px solid var(--sy-line2); font-size: 17px; line-height: 1; color: var(--sy-ink2); display: grid; place-items: center; flex: none; }
.sy-nav:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }
.sy-dots { display: flex; align-items: center; gap: 4px; flex: none; }
.sy-dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--sy-line2); transition: width .35s cubic-bezier(.2,.8,.2,1), background .3s; }
.sy-dots i.done { background: color-mix(in srgb, var(--sy-accent) 45%, transparent); }
.sy-dots i.on { width: 18px; background: var(--sy-accent); }
.sy-tip { font-size: 12px; color: var(--sy-ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.sy-dk-b { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--sy-line2); font-size: 12.5px; font-weight: 500; color: var(--sy-ink2); white-space: nowrap; flex: none; }
.sy-dk-b:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }
.sy-dk-b.pri { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-dk-arrow { position: absolute; top: calc(50% - 20px); z-index: 6; width: 26px; height: 26px; border-radius: 50%; background: var(--sy-card); border: 1px solid var(--sy-line2); box-shadow: var(--sy-shadow); font-size: 16px; line-height: 1; color: var(--sy-ink2); display: grid; place-items: center; opacity: 0; transition: opacity .2s; }
.sy-dk-arrow.l { left: -6px; } .sy-dk-arrow.r { right: -6px; }
.sy-w:hover .sy-dk-arrow { opacity: 1; }
.sy-deck.v .sy-dk-stage { overflow: hidden; }
.sy-deck.v .sy-dk-card { inset: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; cursor: pointer; }
.sy-deck.v .sy-dk-card[data-pos="n1"], .sy-deck.v .sy-dk-card[data-pos="n2"], .sy-deck.v .sy-dk-card[data-pos="hide"] { opacity: 0; transform: translateY(70%); }
.sy-deck.v .sy-dk-card[data-pos="past"] { opacity: 0; transform: translateY(-70%); }
.sy-deck.v .sy-dk-in { padding: 0; gap: 6px; justify-content: flex-start; }
.sy-segs { display: flex; gap: 4px; flex: none; margin-bottom: 8px; }
.sy-segs i { flex: 1; height: 3px; border-radius: 2px; background: var(--sy-well); overflow: hidden; position: relative; }
.sy-segs i::after { content: ""; position: absolute; inset: 0; background: var(--sy-ink); transform-origin: left; transform: scaleX(0); }
.sy-segs i.done::after { transform: scaleX(1); opacity: .35; }
.sy-segs:not(.auto) i.run::after { transform: scaleX(1); }
.sy-segs.auto i.run::after { animation: sy-seg 5s linear forwards; }
.sy-deck:hover .sy-segs i.run::after, .sy-deck:focus-within .sy-segs i.run::after { animation-play-state: paused; }
@keyframes sy-seg { to { transform: scaleX(1); } }
.sy-hot-l { display: flex; align-items: baseline; gap: 8px; }
.sy-hot-n { font-size: 32px; font-weight: 300; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.sy-hot .sy-dk-title { font-size: 15px; font-weight: 600; }
.sy-hot-m { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--sy-ink3); margin-top: auto; white-space: nowrap; }
/* 论文 cards flip: the 3D container is the only place a transform is allowed to carry
   meaning, and the back face keeps the full abstract so the front can stay short. */
.sy-dk-card.paper { perspective: 1400px; background: transparent; border: 0; box-shadow: none; overflow: visible; }
.sy-flip { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.3,.7,.2,1); }
.sy-dk-card.flipped .sy-flip { transform: rotateY(180deg); }
.sy-dk-card.paper .face { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; background: var(--sy-card); border: 1px solid var(--sy-line2); box-shadow: 0 1px 2px rgba(16,18,24,.05), 0 14px 26px -18px rgba(16,18,24,.35); }
.sy-dk-card.paper .face.back { transform: rotateY(180deg); background: var(--sy-well); }
.sy-dk-card.paper .face.back .sy-dk-in { justify-content: flex-start; }
.sy-dk-card.paper .face.back .sy-links { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--sy-line2); }
.sy-dk-abs { margin: 0; font-size: 12.5px; line-height: 1.58; color: var(--sy-ink); }
.sy-agenda-h { font: 500 11px/1 var(--sy-mono); letter-spacing: .05em; color: var(--sy-ink3); padding: 8px 0 4px; flex: none; }
.sy-w-deck { display: flex; flex-direction: column; }
.sy-vL { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.sy-vL-ep { display: flex; flex-direction: column; gap: 9px; min-width: 0; min-height: 0; }
.sy-vL-ep .sy-vt { aspect-ratio: 16 / 9; width: 100%; }
.sy-vL-sh { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
@container sy (max-width: 640px) { .sy-tip, .sy-dots { display: none; } }
.sy-sk { background: var(--sy-skel); border-radius: 8px; position: relative; overflow: hidden; flex: none; }
.sy-sk::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sy-card) 70%, transparent), transparent); animation: sy-shimmer 1.3s infinite; }
@keyframes sy-shimmer { to { transform: translateX(100%); } }
.sy-state { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 8px; flex: 1; min-height: 0; }
.sy-state p { margin: 0; font-size: 13.5px; color: var(--sy-ink2); max-width: 30em; }
.sy-state.err p { color: var(--sy-ink); }
.sy-state .err-i { color: var(--sy-bad); }
.sy-state-ill { display: flex; align-items: center; gap: 14px; flex: 1; min-height: 0; }
.sy-state-ill img { width: 76px; height: 76px; flex: none; }
.sy-soon { display: grid; place-items: center; flex: 1; border: 1.5px dashed var(--sy-line2); border-radius: 12px; color: var(--sy-ink3); font-size: 13px; text-align: center; padding: 12px; }
.sy-editing .sy-w { cursor: grab; outline: 1.5px dashed color-mix(in srgb, var(--sy-accent) 55%, transparent); outline-offset: -1px; }
.sy-editing .sy-w-b, .sy-editing .sy-deco { pointer-events: none; opacity: .55; }
.sy-editing .sy-w-m { display: none; }
.sy-e-bar { position: absolute; top: 6px; right: 6px; z-index: 5; display: none; gap: 3px; padding: 3px; background: var(--sy-card); border: 1px solid var(--sy-line2); border-radius: 10px; box-shadow: var(--sy-shadow-hover); color: var(--sy-ink); }
.sy-editing .sy-e-bar { display: flex; }
.sy-e-bar button { min-width: 24px; height: 22px; padding: 0 5px; border-radius: 7px; font: 500 11.5px/1 var(--sy-mono); color: var(--sy-ink2); display: grid; place-items: center; }
.sy-e-bar button:hover { background: var(--sy-well); color: var(--sy-ink); }
.sy-e-bar button[aria-pressed="true"] { background: var(--sy-ink); color: var(--sy-bg); }
.sy-e-bar .sep { width: 1px; background: var(--sy-line2); margin: 3px 2px; }
.sy-e-bar .del:hover { color: var(--sy-bad); }
.sy-e-rz { position: absolute; right: 3px; bottom: 3px; width: 22px; height: 22px; z-index: 5; display: none; place-items: center; cursor: nwse-resize; color: var(--sy-accent-ink); border-radius: 7px; background: var(--sy-card); box-shadow: var(--sy-shadow); touch-action: none; }
.sy-editing .sy-e-rz { display: grid; }
.sy-w.is-ph { background: color-mix(in srgb, var(--sy-accent) 6%, transparent); box-shadow: none; border: 1.5px dashed color-mix(in srgb, var(--sy-accent) 60%, transparent); outline: 0 !important; }
.sy-w.is-ph > * { visibility: hidden; }
.sy-ghost { position: fixed; z-index: 60; pointer-events: none; margin: 0; box-shadow: var(--sy-shadow-lift) !important; transform: rotate(1.2deg) scale(1.02); outline: 0 !important; }
.sy-ghost .sy-w-b { opacity: 1 !important; }
.sy-grid-empty { grid-column: 1 / -1; grid-row: span 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 1.5px dashed var(--sy-line2); border-radius: var(--sy-radius); color: var(--sy-ink2); text-align: center; padding: 22px; }
.sy-grid-empty img { width: 88px; height: 88px; }
.sy-grid-empty .row-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.sy-pop { position: fixed; z-index: 55; min-width: 210px; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 13px; box-shadow: var(--sy-shadow-lift); padding: 6px; }
.sy-pop-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 6px 10px 4px; font-size: 12px; font-weight: 600; color: var(--sy-ink2); }
.sy-pop .sizes { display: flex; gap: 4px; padding: 4px 10px 8px; }
.sy-sz { min-width: 36px; height: 26px; padding: 0 6px; border-radius: 8px; border: 1px solid var(--sy-line2); font: 500 12px/1 var(--sy-mono); color: var(--sy-ink2); }
.sy-sz:hover:not([disabled]) { border-color: var(--sy-ink3); color: var(--sy-ink); }
.sy-sz[aria-pressed="true"] { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-sz[disabled] { opacity: .3; cursor: not-allowed; }
.sy-pop hr { border: 0; height: 1px; background: var(--sy-line); margin: 4px 0; }
.sy-mi { display: flex; width: 100%; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; text-align: left; font-size: 13.5px; }
.sy-mi:hover { background: var(--sy-well); }
.sy-mi.danger { color: var(--sy-bad); }
.sy-mi input { flex: 1; min-width: 0; height: 30px; border-radius: 8px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 10px; outline: 0; }
.sy-scrim { position: fixed; inset: 0; z-index: 70; background: var(--sy-scrim); display: grid; place-items: center; padding: 16px; animation: sy-fade .16s ease; }
@keyframes sy-fade { from { opacity: 0; } }
.sy-sheet { width: min(940px, 100%); max-height: min(720px, 100%); background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 22px; box-shadow: var(--sy-shadow-lift); display: flex; flex-direction: column; overflow: hidden; animation: sy-rise .22s cubic-bezier(.2,.8,.2,1); }
.sy-sheet.sm { width: min(500px, 100%); }
@keyframes sy-rise { from { transform: translateY(10px) scale(.985); opacity: 0; } }
.sy-sh-h { display: flex; align-items: center; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--sy-line); flex: none; }
.sy-sh-h h2 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.01em; flex: 1; min-width: 0; }
.sy-sh-b { padding: 16px 18px; overflow: auto; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.sy-sh-f { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--sy-line); flex: none; }
.sy-fld { display: flex; flex-direction: column; gap: 7px; }
.sy-fld > span { font-size: 12px; font-weight: 600; color: var(--sy-ink2); }
.sy-fld input[type="text"], .sy-fld textarea { height: 36px; border-radius: 10px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 12px; outline: 0; }
.sy-fld textarea { height: auto; min-height: 74px; padding: 9px 12px; resize: vertical; line-height: 1.5; }
.sy-fld input:focus, .sy-fld textarea:focus { border-color: color-mix(in srgb, var(--sy-accent) 50%, transparent); }
.sy-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sy-chipbtn { height: 28px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--sy-line2); font-size: 13px; color: var(--sy-ink2); white-space: nowrap; }
.sy-chipbtn[aria-pressed="true"] { background: var(--sy-accent-soft); border-color: color-mix(in srgb, var(--sy-accent) 40%, transparent); color: var(--sy-accent-ink); }
.sy-seg.sm button { padding: 5px 10px; font-size: 13px; }
.sy-gal { display: grid; grid-template-columns: 280px minmax(0, 1fr); flex: 1; min-height: 0; }
.sy-gal-l { border-right: 1px solid var(--sy-line); overflow: auto; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
.sy-gal-l h3 { margin: 10px 10px 6px; font: 500 11px/1 var(--sy-mono); letter-spacing: .06em; color: var(--sy-ink3); }
.sy-gal-it { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; text-align: left; width: 100%; }
.sy-gal-it:hover { background: var(--sy-well); }
.sy-gal-it[aria-pressed="true"] { background: var(--sy-accent-soft); }
.sy-gal-it b { display: block; font-size: 14px; font-weight: 600; }
.sy-gal-it small { display: block; font-size: 12px; color: var(--sy-ink3); }
.sy-gal-it .soon-b { margin-left: auto; font: 500 10px/1 var(--sy-mono); color: var(--sy-ink3); border: 1px solid var(--sy-line2); border-radius: 4px; padding: 3px 4px; }
.sy-gal-r { overflow: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.sy-pv { background: var(--sy-bg); border-radius: 18px; height: 260px; overflow: hidden; flex: none; position: relative; }
.sy-pv-in { position: absolute; left: 50%; top: calc(50% - 8px); transform-origin: center; }
.sy-pv .sy-w { cursor: default; }
.sy-pv-cap { position: absolute; left: 14px; bottom: 10px; font: 11px var(--sy-mono); color: var(--sy-ink3); }
.sy-gal-meta { display: flex; flex-wrap: wrap; gap: 14px 26px; }
.sy-gal-acts { font-size: 12.5px; color: var(--sy-ink2); }
.sy-gal-acts b { color: var(--sy-ink); font-weight: 600; }
@media (max-width: 760px) {
  .sy-gal { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .sy-gal-l { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--sy-line); }
  .sy-gal-l h3 { display: none; }
  .sy-gal-it { flex: 0 0 auto; width: auto; }
  .sy-gal-it small, .sy-gal-it .soon-b { display: none; }
  .sy-pv { height: 220px; }
}
.sy-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 80; background: var(--sy-ink); color: var(--sy-bg); border-radius: 12px; padding: 9px 12px 9px 15px; display: flex; align-items: center; gap: 12px; font-size: 13px; box-shadow: var(--sy-shadow-lift); max-width: calc(100vw - 32px); animation: sy-rise .2s ease; }
.sy-toast button { font-weight: 600; color: var(--sy-bg); text-decoration: underline; text-underline-offset: 3px; padding: 2px 4px; }
@media (prefers-reduced-motion: reduce) {
  .sy-root *, .sy-root *::before, .sy-root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}

/* ============================================================================
   Phone overrides — LAST, on purpose.
   ============================================================================
   A container query adds no specificity, so it only wins on source order. Written above its base
   rule it loses silently, which is how a 20px headline still measured 24px on the first attempt.
   Everything a narrow screen needs to override therefore lives here, after every base rule.

   The sticky bar was the actual bug in the phone screenshot: it wrapped to four rows and stood
   156px tall (18% of a 844px viewport) with an opaque background, so a headline scrolling under
   it was sliced through the middle of its glyphs. Two rows plus the frosted tint above fix it.
   ============================================================================ */
@container sy (max-width: 640px) {
  .sy-topbar { gap: 8px; row-gap: 8px; padding-block: 9px; }
  .sy-brand { flex: none; font-size: 15px; gap: 6px; }
  .sy-brand span { display: none; }
  /* Share the brand's row and scroll, instead of taking a row of its own.
     The right edge fades out: a strip that is cut mid-button reads as broken, while a strip that
     fades reads as "there is more, swipe". The mask is what makes horizontal overflow legible
     without a scrollbar, which a touch device does not show. */
  .sy-seg-boards {
    flex: 1 1 0; min-width: 0;
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 22px), transparent 100%);
    mask-image: linear-gradient(to right, #000 calc(100% - 22px), transparent 100%);
  }
  .sy-seg { padding: 2px; }
  .sy-seg button { padding: 6px 10px; font-size: 13px; }
  .sy-btn-add .lbl, .sy-switch .lbl { display: none; }
  .sy-btn-add { width: 34px; padding: 0; }
  .sy-cmd-box kbd { display: none; }
  .sy-actions { gap: 6px; }
  .sy-cmd { flex: 1 1 100%; }
  /* A headline is a lead paragraph on a phone, not a billboard: 24px pushes the first card off
     screen and wraps to four lines. */
  .sy-headline { font-size: 20px; max-width: none; text-wrap: pretty; }
  .sy-hero { flex-direction: column; align-items: flex-start; gap: 10px; padding-block: 14px 12px; }
  .sy-status { font-size: 11px; padding-bottom: 0; }
}
/* .sy-page is the PARENT of the sy container, so a container query can never reach it — the
   first version put its padding here and nothing happened. Media queries are the right tool for
   a box that sizes the container. */
@media (max-width: 640px) {
  .sy-page { padding: 0 14px 80px; }
}
@container sy (max-width: 420px) {
  .sy-headline { font-size: 19px; }
  .sy-seg button { padding: 6px 8px; }
}
`

    // ---- item helpers ------------------------------------------------------

    /**
     * The cover for an Item: a source-supplied thumbnail first, then the og:image the Host
     * resolved. Never a fabricated URL — a card without a cover shows a coloured monogram
     * that carries the Item's own text instead of an empty placeholder.
     */
    const coverOf = (item) => item?.thumbnail ?? item?.cover ?? null

    const categoryOf = (item) => {
      const label = categoryLabel(item?.category)
      return label
        ? `<span class="sy-cat" style="--c:${CATEGORY_COLOUR[item.category] ?? 'var(--sy-ink3)'}">${esc(label)}</span>`
        : ''
    }

    const scoreBadge = (item) =>
      typeof item?.score === 'number' ? `<span class="sy-score${item.score >= 80 ? ' hi' : ''}" title="AIHOT 评分">${item.score}</span>` : ''

    /** 关注词 matching: title, summary, one-line summary and 推荐理由, case-insensitive. */
    const matchOf = (item, interests) => {
      if (!Array.isArray(interests) || interests.length === 0 || !item) return null
      const hay = [item.title, item.summary, item.tldr, item.reason, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      return interests.find((keyword) => keyword && hay.includes(String(keyword).toLowerCase())) ?? null
    }

    const matchChip = (item, interests) => {
      const keyword = matchOf(item, interests)
      return keyword ? `<span class="sy-chip match" title="命中你的关注词">${I.spark}${esc(keyword)}</span>` : ''
    }

    /** The three per-Item actions every 订阅 presentation offers. */
    const itemActs = (item, saved) => `<span class="sy-acts">${
      `<button data-act="item-later" data-item="${esc(item.id)}" aria-pressed="${saved ? 'true' : 'false'}" aria-label="${saved ? '已在稍后读' : '稍后读'}" title="稍后读">${saved ? I.bookmarkOn : I.bookmark}</button>` +
      `<button data-act="item-task" data-item="${esc(item.id)}" aria-label="转为任务" title="转为任务">${I.toTask}</button>` +
      `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="打开原文" title="打开原文">${I.out}</a>`
    }</span>`

    const itemLink = (item, className, inner) =>
      `<a class="${className}" data-open="${esc(item.id)}" href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${inner}</a>`

    const thumbHTML = (item, label) => {
      const cover = coverOf(item)
      return cover
        ? `<img src="${esc(cover)}" alt="" loading="lazy">`
        : `<div class="sy-gen" style="--c:${tint(item.sourceId + (label ?? ''))}">${esc(label ?? '')}</div>`
    }

    const metaLine = (item) => {
      const metrics = item.metrics ?? {}
      if (item.sourceId === 'hf-papers') return `▲ ${metrics.upvotes ?? 0} · ${metrics.comments ?? 0} 评论 · ${relTime(item.publishedAt)}`
      if (item.sourceId === 'youtube') return `${metrics.views ? `${fmtCount(metrics.views)} 次观看 · ` : ''}${relTime(item.publishedAt)}`
      if (item.sourceId === 'aihot-hot') return esc(item.origin ?? '')
      return `${esc(item.origin ?? item.sourceLabel ?? '')} · ${relTime(item.publishedAt)}`
    }

    // ---- 订阅 ordering -----------------------------------------------------

    const SUB_SORTS = [
      ['match', '关注优先'],
      ['new', '最新'],
      ['score', '评分'],
      ['rank', '排名'],
    ]

    function sortItems(items, sort, interests) {
      const recent = (a, b) => Date.parse(b.publishedAt ?? 0) - Date.parse(a.publishedAt ?? 0)
      const list = [...items]
      if (sort === 'rank') list.sort((a, b) => (a.metrics?.rank ?? 99) - (b.metrics?.rank ?? 99))
      else if (sort === 'score') {
        list.sort((a, b) => (b.metrics?.upvotes ?? b.score ?? 0) - (a.metrics?.upvotes ?? a.score ?? 0))
      } else if (sort === 'match') {
        list.sort((a, b) => (matchOf(b, interests) ? 1 : 0) - (matchOf(a, interests) ? 1 : 0) || recent(a, b))
      } else list.sort(recent)
      return list
    }

    function subItemsOf(widget, items, interests) {
      const settings = widget.settings ?? {}
      const sources = settings.sources?.length ? settings.sources : ['aihot']
      let list = items.filter((item) => sources.includes(item.sourceId))
      if (settings.cat) list = list.filter((item) => item.category === settings.cat)
      return sortItems(list, settings.sort ?? 'new', interests)
    }

    const heatMax = (items) => Math.max(1, ...items.map((item) => item.metrics?.signalCount ?? 0))

    // ---- 订阅 rows and cards ----------------------------------------------

    const newsRow = (item, ctx) => `<div class="sy-row nr${item.state?.seen ? ' sy-seen' : ''}"><i class="sy-cdot" style="--c:${CATEGORY_COLOUR[item.category] ?? 'var(--sy-ink3)'}"></i>${itemLink(item, 'sy-it-a', `<span class="tt c1">${esc(item.title)}</span><span class="meta c1" style="white-space:normal">${categoryLabel(item.category) ? `${esc(categoryLabel(item.category))} · ` : ''}${esc(item.origin ?? '')} · ${relTime(item.publishedAt)}</span>`)}${matchChip(item, ctx.interests)}${typeof item.score === 'number' ? `<span class="sy-sc">${item.score}</span>` : ''}${itemActs(item, ctx.saved.has(item.id))}</div>`

    const newsLead = (item, ctx, big) => `<div class="sy-lead sy-nl${item.state?.seen ? ' sy-seen' : ''}">${big && coverOf(item) ? itemLink(item, 'sy-nl-cover', `<img src="${esc(coverOf(item))}" alt="">`) : ''}<div class="sy-nl-t"><div class="sy-nl-top">${scoreBadge(item)}${categoryOf(item)}${matchChip(item, ctx.interests)}</div>${itemLink(item, `sy-lead-t ${big ? 'lg' : ''} c${big ? 2 : 3}`, esc(item.title))}${big && item.reason ? `<div class="sy-reason c2">${esc(item.reason)}</div>` : ''}<span class="meta c1" style="white-space:normal">${esc(item.origin ?? '')} · ${relTime(item.publishedAt)}</span></div>${itemActs(item, ctx.saved.has(item.id))}</div>`

    const newsCard = (item, ctx) => `<div class="sy-ncard${item.state?.seen ? ' sy-seen' : ''}"><div class="sy-nl-top">${scoreBadge(item)}${categoryOf(item)}${matchChip(item, ctx.interests)}</div>${itemLink(item, 'sy-lead-t c3', esc(item.title))}${item.reason ? `<div class="sy-reason-plain c4">${esc(item.reason)}</div>` : ''}<span class="meta c1 foot" style="white-space:normal">${esc(item.origin ?? '')} · ${relTime(item.publishedAt)}</span>${itemActs(item, ctx.saved.has(item.id))}</div>`

    const rankRow = (max) => (item, index) => `<div class="sy-row sy-rk-row${item.state?.seen ? ' sy-seen' : ''}"><span class="sy-rk-n${index < 3 ? ' top' : ''}">${item.metrics?.rank ?? index + 1}</span>${itemLink(item, 'grow c1 tt', esc(item.title))}${item.metrics?.signalCount ? `<span class="sy-heat" title="${esc(item.origin ?? '')}"><i style="width:${Math.round((item.metrics.signalCount / max) * 100)}%"></i></span>` : ''}</div>`

    const prodRow = (item, ctx) => `<div class="sy-row">${monoTile(item.title)}${itemLink(item, 'sy-it-a', `<span class="tt c1">${esc(item.title)}</span><span class="meta c1" style="white-space:normal">${esc(item.summary ?? '')}</span>`)}${itemActs(item, ctx.saved.has(item.id))}</div>`

    const prodCard = (item, ctx) => `<div class="sy-ncard">${monoTile(item.title)}${itemLink(item, 'sy-lead-t c1', esc(item.title))}<div class="meta c3" style="white-space:normal;line-height:1.5">${esc(item.summary ?? '')}</div>${itemActs(item, ctx.saved.has(item.id))}</div>`

    const upvotes = (item, className = '') =>
      `<span class="sy-up ${className}" title="HuggingFace 点赞">${I.up}${item.metrics?.upvotes ?? item.score ?? 0}</span>`

    const authorsLine = (item) =>
      item.tags?.length
        ? `${esc(item.tags[0])}${(item.authorCount ?? item.tags.length) > 1 ? ` 等 ${item.authorCount ?? item.tags.length} 人` : ''}`
        : ''

    const keywordChips = (item, count, interests) => {
      const keyword = matchOf(item, interests)
      const rest = (item.keywords ?? [])
        .filter((value) => !keyword || !String(value).toLowerCase().includes(keyword.toLowerCase()))
        .slice(0, keyword ? count - 1 : count)
      return `<div class="sy-kws">${keyword ? `<span class="sy-chip match">${I.spark}${esc(keyword)}</span>` : ''}${rest.map((value) => `<span class="sy-chip">${esc(value)}</span>`).join('')}</div>`
    }

    const paperLinks = (item) => {
      const id = String(item.url ?? '').match(/papers\/([\d.]+)/)?.[1]
      return `<div class="sy-links"><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">论文${id ? ` <code>${esc(id)}</code>` : ''} ${I.out}</a>${item.altUrl ? `<a href="${esc(safeUrl(item.altUrl))}" target="_blank" rel="noopener noreferrer">代码${item.metrics?.stars ? ` ★ ${fmtCount(item.metrics.stars)}` : ''} ${I.out}</a>` : ''}${item.project ? `<a href="${esc(safeUrl(item.project))}" target="_blank" rel="noopener noreferrer">项目页 ${I.out}</a>` : ''}</div>`
    }

    const paperRow = (item, index, withSummary, ctx) => `<div class="sy-row sy-pr${item.state?.seen ? ' sy-seen' : ''}"><span class="sy-rk-n">${index}</span>${itemLink(item, 'sy-it-a', `<span class="tt c1">${esc(item.title)}</span>${withSummary ? `<span class="meta c1" style="white-space:normal">${esc(item.tldr || authorsLine(item))}</span>` : ''}`)}${matchChip(item, ctx.interests)}${upvotes(item)}${itemActs(item, ctx.saved.has(item.id))}</div>`

    const paperLead = (item, ctx) => `<div class="sy-lead sy-pl">${coverOf(item) ? itemLink(item, 'sy-pl-fig', `<img src="${esc(coverOf(item))}" alt="论文配图">`) : ''}<div class="sy-pl-t"><div class="sy-nl-top"><span class="mono-l">#1 今日</span>${upvotes(item)}<span class="meta">${item.metrics?.comments ?? 0} 条讨论 · ${authorsLine(item)}</span></div>${itemLink(item, 'sy-lead-t lg c2', esc(item.title))}${item.tldr ? `<div class="sy-tldr c2">${esc(item.tldr)}</div>` : ''}${keywordChips(item, 4, ctx.interests)}${paperLinks(item)}</div>${itemActs(item, ctx.saved.has(item.id))}</div>`

    const paperCard = (item, index, ctx) => `<div class="sy-ncard"><div class="sy-nl-top"><span class="mono-l">#${index + 1}</span>${upvotes(item)}<span class="meta">${item.metrics?.comments ?? 0} 条讨论</span></div>${itemLink(item, 'sy-lead-t c2', esc(item.title))}<div class="sy-reason-plain c4">${esc(item.tldr || item.summary)}</div><div class="foot">${keywordChips(item, 3, ctx.interests)}</div>${itemActs(item, ctx.saved.has(item.id))}</div>`

    const videoImg = (item) =>
      coverOf(item)
        ? `<img src="${esc(coverOf(item))}" alt="" loading="lazy">`
        : `<div class="sy-gen" style="--c:var(--sy-t-subscription)">${esc(item.sourceLabel ?? '')}</div>`

    const videoThumb = (item, className = '') =>
      itemLink(item, `sy-vt ${className}`, `${videoImg(item)}<span class="sy-vplay">${I.play}</span>${item.metrics?.views ? `<span class="sy-vbadge">${fmtCount(item.metrics.views)} 次观看</span>` : ''}`)

    const videoMeta = (item) => `${relTime(item.publishedAt)}${item.metrics?.views ? ` · ${fmtCount(item.metrics.views)} 次观看` : ''}${item.metrics?.likes ? ` · ${fmtCount(item.metrics.likes)} 赞` : ''}`

    const shortCard = (item) =>
      itemLink(item, 'sy-s916', `${videoImg(item)}<span><em class="c2">${esc(item.title)}</em><b>${fmtCount(item.metrics?.views ?? 0)} 次观看</b></span>`)

    const episodeCard = (item) =>
      itemLink(item, 'sy-ep', `${videoImg(item)}<span class="sy-vplay">${I.play}</span><span class="sy-ep-t"><span class="mono-l">${isShort(item) ? 'SHORTS' : '最新节目'}</span><b class="c2">${esc(item.title)}</b><span>${videoMeta(item)}</span></span>`)

    // ---- 卡片流 (deck) -----------------------------------------------------

    const DECK_SIZE = 10

    const newsDeckCard = (item, index, size, ctx, pos, flipped) => {
      const big = size !== 'M'
      const cover = coverOf(item)
      const background = cover
        ? `<div class="sy-dk-bg"><img src="${esc(cover)}" alt=""></div>`
        : `<div class="sy-dk-art"></div>${typeof item.score === 'number' ? `<div class="sy-dk-big">${item.score}</div>` : ''}`
      void flipped
      return `<article data-pos="${pos}" class="sy-dk-card news${cover ? ' sy-on-photo' : ''}" data-k="${index}" data-item="${esc(item.id)}" style="--c:${CATEGORY_COLOUR[item.category] ?? 'var(--sy-t-subscription)'}">${background}
        <div class="sy-dk-in"><div class="sy-dk-top"><span class="sy-dk-src">${esc(item.sourceLabel ?? '')}</span>${categoryOf(item)}${matchChip(item, ctx.interests)}<span class="grow"></span><span class="sy-dk-time">${relTime(item.publishedAt)}</span></div>
        <div class="sy-dk-main">${big && cover ? scoreBadge(item) : ''}${itemLink(item, `sy-dk-title c2${big ? ' lg' : ''}`, esc(item.title))}${big && item.reason ? `<p class="sy-dk-sum c2">${esc(item.reason)}</p>` : ''}${big ? `<span class="sy-dk-meta c1">${esc(item.origin ?? '')}</span>` : ''}</div></div></article>`
    }

    const hotDeckCard = (item, index, max, pos) => `<article data-pos="${pos}" class="sy-dk-card hot" data-k="${index}" data-item="${esc(item.id)}"><div class="sy-dk-in"><div class="sy-hot-l"><span class="sy-hot-n">${item.metrics?.rank ?? index + 1}</span><span class="sy-dk-time">${relTime(item.publishedAt)}</span></div>${itemLink(item, 'sy-dk-title c3', esc(item.title))}<div class="sy-hot-m"><span class="sy-heat wide"><i style="width:${Math.round(((item.metrics?.signalCount ?? 0) / max) * 100)}%"></i></span><span>${esc(item.origin ?? '')}</span></div></div></article>`

    const paperDeckCard = (item, index, size, ctx, pos, flipped) => {
      const big = size !== 'M'
      const front = `<div class="face front"><div class="sy-dk-art paper"></div><div class="sy-dk-big">#${index + 1}</div><div class="sy-dk-in"><div class="sy-dk-top"><span class="sy-dk-src">HF 论文 · #${index + 1}</span>${upvotes(item)}<span class="sy-dk-time">${item.metrics?.comments ?? 0} 条讨论</span></div>
        <div class="sy-dk-main">${itemLink(item, 'sy-dk-title c2', esc(item.title))}${item.tldr ? `<p class="sy-dk-sum tl c3">${esc(item.tldr)}</p>` : ''}${big ? keywordChips(item, 4, ctx.interests) : ''}${big ? `<span class="sy-dk-hint">${I.reset} 点卡片翻面看摘要</span>` : ''}</div></div></div>`
      const back = `<div class="face back"><div class="sy-dk-in"><div class="sy-dk-top"><span class="sy-dk-src">摘要</span><span class="grow"></span><span class="sy-dk-time">${authorsLine(item)}</span></div><p class="sy-dk-abs c8">${esc(item.summary || item.tldr || '')}</p>${big ? paperLinks(item) : ''}</div></div>`
      return `<article data-pos="${pos}" class="sy-dk-card paper${flipped ? ' flipped' : ''}" data-k="${index}" data-item="${esc(item.id)}"><div class="sy-flip">${front}${back}</div></article>`
    }

    /**
     * The 卡片流: one Item at a time as a stack. `index` lives in React state so a re-render
     * (a resize, an Item marked read) does not lose the reader's place; `data-pos` is derived
     * from it, which is what makes the CSS transition animate between cards.
     */
    function deckHtml(widget, size, items, ctx, index, flipped) {
      const list = items.slice(0, DECK_SIZE)
      const settings = widget.settings ?? {}
      const vertical = size === 'S'
      const max = heatMax(list)
      if (list.length === 0) return { html: emptyHtml(widget, size, ctx), noHeader: vertical }

      const at = Math.min(index, list.length - 1)
      const cardHtml = (item, position) => {
        const pos = position < at ? 'past' : position === at ? 'cur' : position === at + 1 ? 'n1' : position === at + 2 ? 'n2' : 'hide'
        if (settings.pres === '论文') return paperDeckCard(item, position, size, ctx, pos, flipped)
        if (vertical || settings.pres === '榜单') return hotDeckCard(item, position, max, pos)
        return newsDeckCard(item, position, size, ctx, pos)
      }

      const segs = vertical
        ? `<div class="sy-segs${settings.auto ? ' auto' : ''}">${list.map((_, i) => `<i class="${i < at ? 'done' : i === at ? 'run' : ''}"></i>`).join('')}</div>`
        : ''
      const controls = size === 'L' || size === 'Wide'
        ? `<div class="sy-ctl"><button class="sy-nav" data-act="dk-prev" data-w="${esc(widget.id)}" aria-label="上一条">‹</button><div class="sy-dots">${list.map((_, i) => `<i class="${i === at ? 'on' : i < at ? 'done' : ''}"></i>`).join('')}</div><button class="sy-nav" data-act="dk-next" data-w="${esc(widget.id)}" aria-label="下一条">›</button><span class="sy-tip">拖动卡片：右滑稍后读，左滑跳过</span><span class="grow"></span>${settings.pres === '论文' ? `<button class="sy-dk-b" data-act="dk-flip" data-w="${esc(widget.id)}">${I.reset}翻面</button>` : `<button class="sy-dk-b" data-act="dk-task" data-w="${esc(widget.id)}">${I.toTask}转为任务</button>`}<button class="sy-dk-b pri" data-act="dk-later" data-w="${esc(widget.id)}">${I.bookmark}稍后读</button></div>`
        : ''
      const arrows = size === 'M'
        ? `<button class="sy-dk-arrow l" data-act="dk-prev" data-w="${esc(widget.id)}" aria-label="上一条">‹</button><button class="sy-dk-arrow r" data-act="dk-next" data-w="${esc(widget.id)}" aria-label="下一条">›</button>`
        : ''

      return {
        noHeader: vertical,
        cls: ' sy-w-deck',
        html: `<div class="sy-deck${vertical ? ' v' : ''}" data-deck="${esc(widget.id)}" tabindex="0" role="group" aria-roledescription="卡片流" aria-label="${esc(widgetTitle(widget, ctx))}，左右方向键切换">${vertical ? `<div class="sy-s-lab" style="margin-bottom:8px">${ic('subscription', 16)}${esc(widgetTitle(widget, ctx))}</div>` : ''}${segs}<div class="sy-dk-stage">${list.map(cardHtml).join('')}${arrows}</div>${controls}</div>`,
      }
    }

    // ---- empty / error / loading -------------------------------------------

    const EMPTY_TEXT = {
      task: { ill: 'ill-done', text: '今天的事都做完了。新任务会先进收件箱。' },
      subscription: { text: '这个订阅暂时没有新内容，到下次刷新再看看。' },
      readlater: { ill: 'ill-readlater', text: '还没有稍后读。在订阅里点书签图标，文章就会存到这里。' },
      capture: { text: '还没有记录。在上面输入一行，回车就存好了。' },
      project: { text: '还没有项目。把任务归到一个项目下，这里就会显示它的进度。' },
      habit: { text: '还没有习惯。' },
      bookmarks: { text: '还没有书签。' },
      focus: { ill: 'ill-focus', text: '准备好了就开始一个番茄。' },
    }

    function emptyHtml(widget, size, ctx) {
      const entry = EMPTY_TEXT[widget.type] ?? { text: '这里还没有内容。' }
      if (size === 'S') {
        return `<div class="sy-s-lab">${esc(widgetTitle(widget, ctx))}</div><div class="sy-state"><p style="font-size:13px">${esc(entry.text)}</p></div>`
      }
      return entry.ill
        ? `<div class="sy-state-ill"><img src="${ASSET}/${entry.ill}.webp" alt="" onerror="this.remove()"><p class="sy-reason-plain" style="margin:0;font-size:13.5px">${esc(entry.text)}</p></div>`
        : `<div class="sy-state"><p>${esc(entry.text)}</p></div>`
    }

    const soonText = (label) => `<div class="sy-soon">${esc(label)}需要一个数据来源，还没接上。这个 Widget 暂时只占位。</div>`

    const ctxTypeName = (widget, ctx) => widget?.title || ctx?.types?.[widget?.type]?.name || '这个 Widget'

    const widgetTitle = (widget, ctx) => {
      if (widget?.title) return widget.title
      if (widget?.type === 'subscription') {
        const labels = (widget.settings?.sources ?? []).map((id) => ctx.sources.find((source) => source.id === id)?.label).filter(Boolean)
        return labels.join(' + ') || '订阅'
      }
      return ctx.types?.[widget?.type]?.name ?? widget?.type ?? 'Widget'
    }

    // ---- renderers ---------------------------------------------------------

    const R = {}

    const tasksIn = (tasks, widget, list) =>
      tasks.filter((task) => task.list === list && (!widget.settings?.project || task.project === widget.settings.project))

    const taskRow = (task, context, opts = {}) =>
      `<div class="sy-row sy-t-row${task.done ? ' sy-done' : ''}"><button class="sy-chk" data-act="task-toggle" data-task="${esc(task.id)}" aria-label="${task.done ? '标记为未完成' : '完成'}：${esc(task.title)}">${I.check}</button><span class="sy-t-title c1 grow">${esc(task.title)}</span>${task.origin?.url ? `<a class="sy-chip" href="${esc(safeUrl(task.origin.url))}" target="_blank" rel="noopener noreferrer" title="来自 ${esc(task.origin.source ?? '')}，点开原文">${esc(task.origin.source ?? '')}</a>` : ''}${opts.project && task.project ? `<span class="sy-chip">${esc(task.project)}</span>` : ''}<button class="sy-mini" data-act="task-remove" data-task="${esc(task.id)}" aria-label="删除任务" title="删除">${I.x}</button></div>`

    R.task = (widget, size, context) => {
      const tasks = context.tasks
      const list = tasksIn(tasks, widget, 'today')
      const open = list.filter((task) => !task.done)
      const done = list.filter((task) => task.done)
      const inbox = tasksIn(tasks, widget, 'inbox')
      const later = tasksIn(tasks, widget, 'later')
      const scope = widget.settings?.project ? `${widget.settings.project} · ` : ''

      if (size === 'S') {
        if (open.length === 0) {
          return {
            deco: 'ill-done',
            html: `<div class="sy-s-lab">${esc(scope)}今天</div><div class="sy-s-main sy-s-narrow"><div class="sy-s-big">${done.length}<small>/${list.length}</small></div><div class="sy-s-sub">今天的事都做完了</div></div><div></div>`,
          }
        }
        return {
          html: `<div class="sy-s-lab">${esc(scope)}今天</div><div class="sy-s-main"><div class="sy-s-big">${open.length}</div><div class="sy-s-sub">件事还没做</div></div><button class="sy-s-next" data-act="task-toggle" data-task="${esc(open[0].id)}" aria-label="完成：${esc(open[0].title)}"><span class="sy-chk">${I.check}</span><span class="c1">${esc(open[0].title)}</span></button>`,
        }
      }

      const sub = `${open.length} 件待办`
      const progress = list.length ? done.length / list.length : 0
      const addForm = (placeholder) =>
        `<form class="sy-cap" data-form="task-add" data-w="${esc(widget.id)}" style="height:36px"><input name="t" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="新建任务"><kbd>↵</kbd></form>`

      if (size === 'M') {
        const shown = [...open, ...done].slice(0, 3)
        return {
          sub,
          html: `<div style="display:flex;flex-direction:column;gap:7px;flex:none"><div style="display:flex;align-items:baseline;gap:8px"><span class="sy-s-big" style="font-size:36px">${done.length}<small>/${list.length}</small></span><span class="meta">今天已完成</span></div>${bar(progress, 'var(--sy-t-task)')}</div><div class="sy-list sy-fit" style="gap:3px">${shown.map((task) => `<div class="sy-row sy-t-row sy-t-m${task.done ? ' sy-done' : ''}"><button class="sy-chk" data-act="task-toggle" data-task="${esc(task.id)}" aria-label="完成：${esc(task.title)}">${I.check}</button><span class="sy-t-title c2 grow">${esc(task.title)}</span></div>`).join('')}</div><div class="meta" style="flex:none">收件箱 ${inbox.length} · 之后 ${later.length}</div>`,
        }
      }

      const single = context.cols <= 4
      return {
        sub,
        html: `${addForm('新建任务，回车加入今天')}
        <div style="display:grid;grid-template-columns:${single ? '1fr' : '1fr 1fr'};gap:18px;flex:1;min-height:0">
          <section style="display:flex;flex-direction:column;min-height:0"><div class="sy-agenda-h">今天 · ${open.length}/${list.length}</div><div class="sy-list sy-fit">${[...open, ...done].map((task) => taskRow(task, context, { project: !single })).join('')}</div></section>
          ${single ? '' : `<section style="display:flex;flex-direction:column;min-height:0"><div class="sy-agenda-h">收件箱 · ${inbox.length}</div><div class="sy-list sy-fit">${inbox.length ? inbox.map((task) => `<div class="sy-row"><span class="sy-t-title c1 grow">${esc(task.title)}</span><button class="sy-mini" data-act="task-today" data-task="${esc(task.id)}">移到今天</button></div>`).join('') : '<div class="meta" style="padding:8px 0">收件箱是空的</div>'}</div></section>`}
        </div>`,
      }
    }

    const categoryTabs = (widget, context) => {
      const settings = widget.settings ?? {}
      const all = subItemsOf({ ...widget, settings: { ...settings, cat: null } }, context.items, context.interests)
      const present = [...new Set(all.map((item) => item.category).filter((value) => categoryLabel(value)))]
      if (present.length < 2) return ''
      const current = settings.cat ?? ''
      const tabs = [['', '全部', all.length], ...present.map((value) => [value, categoryLabel(value), all.filter((item) => item.category === value).length])]
      return `<div class="sy-tabs" role="tablist">${tabs.map(([key, label, count]) => `<button role="tab" data-act="sub-cat" data-w="${esc(widget.id)}" data-v="${esc(key)}" aria-pressed="${current === key}">${esc(label)}<span>${count}</span></button>`).join('')}</div>`
    }

    R.subscription = (widget, size, context) => {
      const settings = widget.settings ?? {}
      const items = subItemsOf(widget, context.items, context.interests)
      const pres = settings.pres ?? '图文'
      const title = widgetTitle(widget, context)
      const matches = items.filter((item) => matchOf(item, context.interests)).length
      const sub = `${items.length} 条${matches ? ` · ${matches} 条命中关注` : ''}`

      if (settings.deck) {
        const deck = deckHtml({ ...widget, settings: { ...settings, pres } }, size, items, context, context.deckIndex[widget.id] ?? 0, context.deckFlipped[widget.id])
        return { ...deck, sub }
      }
      if (items.length === 0) return { sub: '空', html: emptyHtml(widget, size, context) }
      const max = heatMax(items)

      if (pres === '视频') {
        const episodes = items.filter((item) => !isShort(item))
        const shorts = items.filter(isShort)
        const lead = episodes[0] ?? items[0]
        const rest = shorts.filter((item) => item !== lead)
        if (size === 'S') {
          return {
            cls: coverOf(lead) ? 'sy-w--photo' : '',
            bg: coverOf(lead) ? `<div class="bgimg"><img src="${esc(coverOf(lead))}" alt=""></div>` : '',
            html: `<div class="sy-s-lab">${isShort(lead) ? 'Shorts' : '最新节目'} · ${esc(title)}</div><div>${itemLink(lead, 'sy-s-title c2', esc(lead.title))}<div class="meta" style="margin-top:4px">${videoMeta(lead)}</div></div>${itemActs(lead, context.saved.has(lead.id))}`,
          }
        }
        const description = cleanDesc(lead.description || lead.summary)
        const info = (clamp) => `<div class="sy-vm-t"><span class="mono-l">${isShort(lead) ? 'SHORTS' : '最新节目'} · ${esc(lead.origin ?? '')}</span>${itemLink(lead, `sy-lead-t ${clamp > 2 ? 'lg' : ''} c${Math.min(clamp, 3)}`, esc(lead.title))}<span class="meta">${videoMeta(lead)}</span>${clamp > 2 && description ? `<div class="sy-reason-plain c3">${esc(description)}</div>` : ''}${rest.length ? `<span class="meta">还有 ${rest.length} 条 Shorts</span>` : ''}</div>`
        if (size === 'M') return { sub, html: `<div class="sy-vm">${videoThumb(lead)}${info(2)}</div>` }
        if (size === 'Wide') return { sub, html: `<div class="sy-fit-x sy-reel">${episodeCard(lead)}${rest.map(shortCard).join('')}</div>` }
        return {
          sub,
          html: `<div class="sy-vL"><div class="sy-vL-ep">${videoThumb(lead)}<div class="sy-vm-t" style="justify-content:flex-start"><span class="mono-l">${isShort(lead) ? 'SHORTS' : '最新节目'} · ${relTime(lead.publishedAt)}</span>${itemLink(lead, 'sy-lead-t c2', esc(lead.title))}${description ? `<div class="sy-reason-plain c2">${esc(description)}</div>` : ''}</div></div>${rest.length ? `<div class="sy-vL-sh"><div class="sy-agenda-h" style="padding-top:0">SHORTS · ${rest.length}</div><div class="sy-fit sy-reel2">${rest.map(shortCard).join('')}</div></div>` : ''}</div>`,
        }
      }

      if (pres === '论文') {
        const lead = items[0]
        if (size === 'S') {
          return { html: `<div class="sy-s-lab">${esc(title)} · #1</div><div style="display:flex;flex-direction:column;gap:6px">${upvotes(lead, 'big')}${itemLink(lead, 'sy-s-title c3', esc(lead.title))}</div>${keywordChips(lead, 2, context.interests)}` }
        }
        if (size === 'M') {
          return {
            sub,
            html: `<div class="sy-m-split"><div class="sy-lead"><div class="sy-nl-top"><span class="mono-l">#1 今日</span>${upvotes(lead)}</div>${itemLink(lead, 'sy-lead-t c2', esc(lead.title))}${lead.tldr ? `<div class="meta c2" style="white-space:normal;line-height:1.45">${esc(lead.tldr)}</div>` : ''}${itemActs(lead, context.saved.has(lead.id))}</div><div class="sy-list sy-fit">${items.slice(1, 6).map((item, index) => paperRow(item, index + 2, false, context)).join('')}</div></div>`,
          }
        }
        if (size === 'Wide') return { sub, html: `<div class="sy-fit-x" style="gap:12px">${items.slice(0, 8).map((item, index) => paperCard(item, index, context)).join('')}</div>` }
        return { sub, html: `${paperLead(lead, context)}<div class="sy-list sy-fit">${items.slice(1, 8).map((item, index) => paperRow(item, index + 2, true, context)).join('')}</div>` }
      }

      if (pres === '榜单') {
        if (size === 'S') return { html: `<div class="sy-s-lab">${ic('subscription', 16)}${esc(title)}</div><div class="sy-list sy-fit" style="margin-top:8px">${items.slice(0, 5).map(rankRow(max)).join('')}</div>` }
        if (size === 'M') return { sub, html: `<div class="sy-grid2 r3">${items.slice(0, 6).map(rankRow(max)).join('')}</div>` }
        if (size === 'Wide') return { sub, html: `<div class="sy-grid2 r3" style="grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(4,auto)">${items.slice(0, 12).map(rankRow(max)).join('')}</div>` }
        return { sub, html: `<div class="sy-list sy-fit">${items.slice(0, 10).map(rankRow(max)).join('')}</div>` }
      }

      if (pres === '产品') {
        const lead = items[0]
        if (size === 'S') return { deco: 'subscription', html: `<div class="sy-s-lab">${esc(title)}</div><div class="sy-s-narrow" style="display:flex;flex-direction:column;gap:6px">${monoTile(lead.title)}${itemLink(lead, 'sy-s-title c1', esc(lead.title))}<div class="meta c2" style="white-space:normal">${esc(lead.summary ?? '')}</div></div>` }
        if (size === 'M') return { sub, html: `<div class="sy-grid2" style="row-gap:4px">${items.slice(0, 4).map((item) => prodRow(item, context)).join('')}</div>` }
        if (size === 'Wide') return { sub, html: `<div class="sy-fit-x" style="gap:12px">${items.slice(0, 8).map((item) => prodCard(item, context)).join('')}</div>` }
        return { sub, html: `<div class="sy-list sy-fit">${items.slice(0, 9).map((item) => prodRow(item, context)).join('')}</div>` }
      }

      // 图文
      const lead = items[0]
      if (size === 'S') {
        if (coverOf(lead)) {
          return {
            cls: 'sy-w--photo',
            bg: `<div class="bgimg"><img src="${esc(coverOf(lead))}" alt=""></div>`,
            html: `<div class="sy-s-lab">${esc(title)}</div><div>${itemLink(lead, 'sy-s-title c3', esc(lead.title))}<div class="meta" style="margin-top:4px">${metaLine(lead)}</div></div>${itemActs(lead, context.saved.has(lead.id))}`,
          }
        }
        return {
          deco: 'subscription',
          html: `<div class="sy-s-lab">${esc(title)}</div><div class="sy-s-narrow"><div class="sy-nl-top" style="margin-bottom:6px">${scoreBadge(lead)}${matchChip(lead, context.interests)}</div>${itemLink(lead, 'sy-s-title c3', esc(lead.title))}</div><div class="meta">${relTime(lead.publishedAt)}</div>`,
        }
      }
      if (size === 'M') return { sub, html: `<div class="sy-m-split">${newsLead(lead, context, false)}<div class="sy-list sy-fit">${items.slice(1, 6).map((item) => newsRow(item, context)).join('')}</div></div>` }
      if (size === 'Wide') return { sub, html: `<div class="sy-fit-x" style="gap:12px">${items.slice(0, 8).map((item) => newsCard(item, context)).join('')}</div>` }
      return { sub, html: `${categoryTabs(widget, context)}${newsLead(lead, context, true)}<div class="sy-list sy-fit">${items.slice(1, 10).map((item) => newsRow(item, context)).join('')}</div>` }
    }

    R.capture = (widget, size, context) => {
      const form = `<form class="sy-cap" data-form="capture" data-w="${esc(widget.id)}"><input name="t" placeholder="记下一个想法…" autocomplete="off" aria-label="快速记录"><kbd>↵</kbd></form>`
      const hint = `<div class="sy-cap-hint">回车存进收件箱 · 以 <code>#note</code> 开头存为 Note</div>`
      const inbox = context.tasks.filter((task) => task.list === 'inbox').length
      const recent = context.notes.slice(0, 6).map((note) => `<div class="sy-row" style="min-height:28px"><span class="sy-kind note">Note</span><span class="c1 grow" style="font-size:13px">${esc(note.text)}</span><span class="meta">${relTime(note.createdAt)}</span><button class="sy-mini" data-act="note-remove" data-note="${esc(note.id)}" aria-label="删除" title="删除">${I.x}</button></div>`).join('')
      if (size === 'Wide') {
        return { sub: `收件箱 ${inbox}`, html: `<div class="sy-cap-wide"><div style="display:flex;flex-direction:column;gap:8px">${form}${hint}</div><div class="sy-list sy-fit" style="align-self:stretch">${recent}</div></div>` }
      }
      return { sub: `收件箱 ${inbox}`, html: `${form}<div class="sy-list sy-fit">${recent}</div>` }
    }

    R.bookmarks = (widget, size, context) => {
      const rows = context.bookmarks ?? []
      if (rows.length === 0) return { html: emptyHtml(widget, size, context) }
      if (size === 'S') {
        return { html: `<div class="sy-bm-s">${rows.slice(0, 6).map((entry) => `<a class="sy-bm-tile" href="${esc(safeUrl(entry.url))}" target="_blank" rel="noopener noreferrer">${monoTile(entry.name)}<span>${esc(entry.name)}</span></a>`).join('')}</div>` }
      }
      const count = size === 'Wide' ? (context.cols >= 12 ? 12 : 8) : 8
      const columns = size === 'Wide' ? (context.cols >= 12 ? 6 : 4) : (context.cols >= 6 ? 4 : 2)
      const limit = context.cols <= 4 && size !== 'S' ? 4 : count
      return { sub: `${rows.length} 个`, html: `<div class="sy-bm-grid" style="grid-template-columns:repeat(${columns},minmax(0,1fr))">${rows.slice(0, limit).map((entry) => `<a class="sy-bm-chip" href="${esc(safeUrl(entry.url))}" target="_blank" rel="noopener noreferrer">${monoTile(entry.name)}<span>${esc(entry.name)}</span></a>`).join('')}</div>` }
    }

    /** Projects are derived: a Project is the set of Tasks that name it. */
    const projectsOf = (tasks) => {
      const names = [...new Set(tasks.map((task) => task.project).filter(Boolean))]
      return names.map((name) => {
        const rows = tasks.filter((task) => task.project === name)
        const done = rows.filter((task) => task.done).length
        return { name, total: rows.length, done, open: rows.length - done, progress: rows.length ? done / rows.length : 0 }
      })
    }

    R.project = (widget, size, context) => {
      const projects = projectsOf(context.tasks)
      if (projects.length === 0) return { sub: '空', html: emptyHtml(widget, size, context) }
      const colourOf = (name) => ['var(--sy-t-project)', 'var(--sy-t-task)', 'var(--sy-t-bookmarks)', 'var(--sy-t-habit)'][hueOf(name) % 4]

      if (size === 'S') {
        const project = projects[0]
        return {
          html: `<div class="sy-s-lab">${ic('project', 16)}项目</div><div class="sy-pj-s">${ring(project.progress, 60, 7, colourOf(project.name), `${Math.round(project.progress * 100)}%`)}<div style="min-width:0"><div style="font-weight:600;font-size:15px" class="c1">${esc(project.name)}</div><div class="meta">${project.open} 件待办</div></div></div><div class="meta c1" style="white-space:normal">${projects.length} 个项目在推进</div>`,
        }
      }
      const rows = projects.map((project) => `<div class="sy-pj-row"><div class="sy-pj-h"><span class="sy-pj-dot" style="--c:${colourOf(project.name)}"></span><b class="c1">${esc(project.name)}</b><span class="grow"></span><span class="meta">${Math.round(project.progress * 100)}% · ${project.open} 件待办</span></div>${bar(project.progress, colourOf(project.name))}</div>`)
      if (size === 'M') return { sub: `${projects.length} 个进行中`, html: `<div class="sy-list sy-fit" style="gap:9px">${rows.join('')}</div>` }
      return { sub: `${projects.length} 个进行中`, html: `<div style="display:flex;flex-direction:column;gap:11px;flex:none">${rows.join('')}</div><div class="sy-agenda-h">最近完成</div><div class="sy-list sy-fit" style="gap:3px">${context.tasks.filter((task) => task.done).slice(0, 6).map((task) => `<div class="sy-row" style="min-height:28px"><span class="sy-chk sy-done">${I.check}</span><span class="tt c1 grow">${esc(task.title)}</span><span class="meta">${esc(task.project ?? '')}</span></div>`).join('')}</div>` }
    }

    R.readlater = (widget, size, context) => {
      const items = context.readLater.map((id) => context.byId.get(id) ?? context.readLaterEntries?.[id]).filter(Boolean)
      if (items.length === 0) return { sub: '空', html: emptyHtml(widget, size, context) }
      const acts = (item) => `<span class="sy-acts"><button data-act="rl-note" data-item="${esc(item.id)}" title="转为 Note" aria-label="转为 Note">${I.note}</button><button data-act="item-task" data-item="${esc(item.id)}" title="转为任务" aria-label="转为任务">${I.toTask}</button><button data-act="item-later" data-item="${esc(item.id)}" data-off="1" title="移出稍后读" aria-label="移出稍后读">${I.x}</button></span>`
      if (size === 'S') return { deco: 'ill-readlater', html: `<div class="sy-s-lab">稍后读</div><div class="sy-s-main"><div class="sy-s-big">${items.length}</div><div class="sy-s-sub">篇等你读</div></div><div class="sy-s-narrow">${itemLink(items[0], 'c1', `<span style="font-size:13px">${esc(items[0].title)}</span>`)}</div>` }
      const sub = `${items.length} 篇`
      if (size === 'M') return { sub, html: `<div class="sy-list sy-fit">${items.map((item) => `<div class="sy-row">${itemLink(item, 'sy-it-a', `<span class="tt c1">${esc(item.title)}</span><span class="meta">${esc(item.sourceLabel ?? '')} · ${relTime(item.publishedAt)}</span>`)}${acts(item)}</div>`).join('')}</div>` }
      return { sub, html: `<div class="sy-list sy-fit" style="gap:3px">${items.map((item) => `<div class="sy-row" style="gap:12px"><div class="sy-thumb" style="width:68px;height:42px">${thumbHTML(item, item.sourceLabel)}</div>${itemLink(item, 'sy-it-a', `<span class="tt c2">${esc(item.title)}</span><span class="meta">${esc(item.sourceLabel ?? '')} · ${relTime(item.publishedAt)}</span>`)}${acts(item)}</div>`).join('')}</div><div class="meta" style="flex:none">在订阅里点书签图标，文章就会存到这里</div>` }
    }

    /**
     * The Agent Inbox: proposals from the background review, awaiting a human decision.
     *
     * It is a Widget rather than a separate page (issue §6.2), so it lives on a Board with the
     * rest of the user's cards. The approve/reject buttons post to a **local** route: a proposal
     * cannot be approved over the sync API, so a model can never approve its own suggestion.
     */
    R.agentInbox = (widget, size, context) => {
      const all = context.agentInbox ?? []
      const pending = all.filter((entry) => entry.status === 'pending')
      const decided = all.filter((entry) => entry.status === 'applied' || entry.status === 'rejected' || entry.status === 'rolled_back')
      if (all.length === 0) return { sub: '空', html: emptyHtml(widget, size, context) }

      const ops = (proposal) => (proposal.operations ?? [])
        .map((operation) => `<span class="sy-chip" title="${esc(operation.name)}">${esc(OPERATION_LABELS[operation.name] ?? operation.name)}</span>`)
        .join('')

      if (size === 'S') {
        const first = pending[0] ?? decided[0]
        return {
          sub: pending.length ? `${pending.length} 条待批` : '已清空',
          html: `<div class="sy-s-lab">${ic('agentInbox', 16)}待批建议</div><div class="sy-s-main"><div class="sy-s-big">${pending.length}</div><div class="sy-s-sub">${pending.length ? '条等你决定' : '都处理完了'}</div></div>${first ? `<div class="sy-s-narrow"><span class="c1" style="font-size:13px">${esc(first.reason)}</span></div>` : ''}`,
        }
      }

      const row = (proposal, { actionable }) => `<div class="sy-row" style="align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--sy-line)">
        <div class="grow" style="min-width:0;display:flex;flex-direction:column;gap:4px">
          <span class="c2" style="font-size:13.5px;font-weight:520">${esc(proposal.reason)}</span>
          <span style="display:flex;gap:5px;flex-wrap:wrap">${ops(proposal)}</span>
          <span class="meta">${relTime(proposal.createdAt)}${(proposal.evidenceRefs ?? []).length ? ` · ${proposal.evidenceRefs.length} 条证据` : ''}${(proposal.preview?.diff ?? []).length ? ` · ${proposal.preview.diff.length} 处变更` : ''}</span>
        </div>
        ${actionable
          ? `<span class="sy-acts" style="flex:none">${proposal.status === 'pending'
            ? `<button data-act="proposal-approve" data-proposal="${esc(proposal.id)}" title="批准并执行" aria-label="批准并执行">${I.check}</button><button data-act="proposal-reject" data-proposal="${esc(proposal.id)}" title="拒绝" aria-label="拒绝">${I.x}</button>`
            : proposal.status === 'applied'
              ? `<span class="meta">${esc(STATUS_LABELS[proposal.status] ?? proposal.status)}</span><button data-act="proposal-rollback" data-proposal="${esc(proposal.id)}" title="撤销改动" aria-label="撤销改动">${I.reset}</button>`
              : `<span class="meta">${esc(STATUS_LABELS[proposal.status] ?? proposal.status)}</span>`}</span>`
          : ''}
      </div>`

      const header = `<div class="meta" style="flex:none">${pending.length} 条待批 · ${decided.length} 条已处理</div>`
      if (size === 'M') {
        return {
          sub: pending.length ? `${pending.length} 条待批` : '已清空',
          html: `<div class="sy-list sy-fit" style="gap:0">${(pending.length ? pending : decided).slice(0, 4).map((proposal) => row(proposal, { actionable: true })).join('')}</div>${header}`,
        }
      }
      return {
        sub: pending.length ? `${pending.length} 条待批` : '已清空',
        html: `<div class="sy-list sy-fit" style="gap:0">${(pending.length ? pending : decided).slice(0, 6).map((proposal) => row(proposal, { actionable: true })).join('')}</div>
          <div class="meta" style="flex:none">审批只在<b>这台设备</b>上发生：Agent 不能自己批准自己的建议。批准后按条执行，失败的会标记为 failed。</div>`,
      }
    }
    const dots7 = (habit) => `<div class="sy-dots7">${(habit.week ?? [0, 0, 0, 0, 0, 0, 0]).map((value, index) => index === dayIdx()
      ? `<button class="${value ? 'on' : ''} today" data-act="habit-tick" data-habit="${esc(habit.id)}" aria-label="今天${value ? '已打卡，点击取消' : '打卡'}：${esc(habit.name)}">${value ? I.check : ''}</button>`
      : `<span class="${index > dayIdx() ? 'future' : value ? 'on' : ''}" aria-hidden="true">${'一二三四五六日'[index]}</span>`).join('')}</div>`

    R.habit = (widget, size, context) => {
      const habits = context.habits ?? []
      if (habits.length === 0) return { sub: '空', html: emptyHtml(widget, size, context) }
      if (size === 'S') {
        const habit = habits[0]
        return { html: `<div class="sy-s-lab">${ic('habit', 16)}${esc(habit.name)}</div><div class="sy-s-main"><div class="sy-s-big">${habit.streak ?? 0}<small>天</small></div><div class="sy-s-sub">连续打卡</div></div>${dots7(habit)}` }
      }
      const today = habits.filter((habit) => habit.week?.[dayIdx()]).length
      return { sub: `今天 ${today}/${habits.length}`, html: `<div class="sy-list sy-fit" style="gap:3px">${habits.map((habit) => `<div class="sy-hb-row"><span class="c1 grow" style="font-size:13.5px;font-weight:500">${esc(habit.name)}</span><span class="meta">${habit.streak ?? 0} 天</span>${dots7(habit)}</div>`).join('')}</div>` }
    }

    const fmtClock = (seconds) => `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`

    R.focus = (widget, size, context) => {
      const focus = context.focus ?? { total: 1500, left: 1500, running: false, sessions: 0, task: null }
      const task = context.tasks.find((entry) => entry.id === focus.task)
      const button = `<button class="sy-play-btn" data-act="focus-toggle" aria-label="${focus.running ? '暂停' : '开始专注'}">${focus.running ? I.pause : I.play}</button>`
      if (size === 'S') {
        return { html: `<div class="sy-s-lab">专注 · 第 ${(focus.sessions ?? 0) + 1} 个番茄</div><div class="sy-fx"><span class="sy-fd">${fmtClock(focus.left)}</span>${button}</div><div style="display:flex;flex-direction:column;gap:6px">${bar(1 - focus.left / focus.total, 'var(--sy-t-focus)')}<div class="meta c1" style="white-space:normal">${task ? esc(task.title) : '没有关联任务'}</div></div>` }
      }
      return {
        sub: `今天 ${focus.sessions ?? 0} 个番茄`,
        html: `<div class="sy-fm">${ring(1 - focus.left / focus.total, 96, 8, 'var(--sy-t-focus)', fmtClock(focus.left))}<div style="display:flex;flex-direction:column;gap:8px;min-width:0"><div class="meta">当前任务</div><button class="c1" data-act="focus-next-task" style="text-align:left;font-size:14px;font-weight:500" title="换一个任务">${task ? esc(task.title) : '选择一个任务'} <span class="meta">↻</span></button><div class="sy-sess">${[0, 1, 2, 3].map((index) => `<i class="${index < (focus.sessions ?? 0) ? 'on' : ''}"></i>`).join('')}</div><div style="display:flex;gap:8px">${button}<button class="sy-play-btn ghost" data-act="focus-reset" aria-label="重置">${I.reset}</button></div></div></div>`,
      }
    }

    // Types without a data source yet: a placeholder that says so, never invented data.
    for (const type of ['calendar', 'weather', 'briefing', 'embed']) {
      R[type] = (widget, size, ctx) => ({ html: soonText(ctxTypeName(widget, ctx)), sub: '即将推出' })
    }

    // ---- card shell --------------------------------------------------------

    function renderUnknownWidget(widget) {
      return {
        sub: '暂不支持',
        html: `<div class="sy-empty" style="padding:12px 6px"><div class="meta">暂不支持的组件类型 (${esc(widget.type ?? 'unknown')})，配置已完整保留</div></div>`,
      }
    }

    function cardInner(widget, size, context, options = {}) {
      const type = widget.type
      const renderer = R[type] ?? renderUnknownWidget
      const result = renderer(widget, size, context)
      const menu = options.preview
        ? ''
        : `<button class="sy-w-m${size === 'S' || result.noHeader ? ' abs' : ''}" data-act="w-menu" data-w="${esc(widget.id)}" aria-label="${esc(widgetTitle(widget, context))}：更多操作" aria-haspopup="menu">${I.dots}</button>`
      const header = size !== 'S' && !result.noHeader
        ? `<header class="sy-w-h">${ic(type)}<div class="sy-w-t"><b>${esc(widgetTitle(widget, context))}</b>${result.sub ? `<span>${esc(result.sub)}</span>` : ''}</div>${menu}</header>`
        : menu
      const edit = options.preview
        ? ''
        : `<div class="sy-e-bar">${(context.sizesOf(type) ?? []).map((entry) => `<button data-act="w-size" data-w="${esc(widget.id)}" data-size="${entry}" aria-pressed="${entry === size}" title="尺寸 ${entry}">${entry === 'Wide' ? 'W' : entry}</button>`).join('')}<span class="sep"></span><button data-act="w-dup" data-w="${esc(widget.id)}" title="复制" aria-label="复制">${I.copy}</button><button class="del" data-act="w-remove" data-w="${esc(widget.id)}" title="移除" aria-label="移除">${I.x}</button></div><div class="sy-e-rz" data-rz="${esc(widget.id)}" title="拖动改尺寸">${I.resize}</div>`
      return {
        cls: `sy-w sy-w--${size === 'S' ? 's' : String(size).toLowerCase()} ${result.cls ?? ''}`,
        html: `${result.bg ?? ''}${result.deco ? decoImg(result.deco) : ''}${header}<div class="sy-w-b">${result.html}</div>${edit}`,
      }
    }

    /**
     * Trim a card's content to the space its Size allocates.
     *
     * The prototype's approach: drop whole children from a `.sy-fit` until it no longer
     * overflows. Whole rows only, never a clipped one (AGENTS.md rule 5).
     */
    function fitDom(root) {
      if (!root) return
      for (const element of root.querySelectorAll('.sy-fit, .sy-fit-x')) {
        const horizontal = element.classList.contains('sy-fit-x')
        const overflows = () => (horizontal
          ? element.scrollWidth > element.clientWidth + 1
          : element.scrollHeight > element.clientHeight + 1)
        let guard = 60
        while (guard-- > 0 && element.children.length > 1 && overflows()) element.lastElementChild.remove()
        while (element.children.length > 1 && element.lastElementChild.classList.contains('sy-agenda-h')) {
          element.lastElementChild.remove()
        }
      }
    }

    // ---- grid geometry -----------------------------------------------------

    const sizeOrder = ['S', 'M', 'L', 'Wide']

    /** The footprint a Widget occupies, mirroring the Host's `personal.js`. */
    function footprint(types, type, size, cols) {
      const sizes = types[type]?.sizes ?? { S: [3, 2] }
      const [width, height] = sizes[size] ?? Object.values(sizes)[0] ?? [3, 2]
      if (cols >= 12) return [width, height]
      if (cols === 6) return [width >= 6 ? 6 : 3, height]
      return [size === 'S' ? 2 : 4, height]
    }

    /** First-fit placement with no holes, in the order the layout gives. */
    function pack(types, widgets, order, cols) {
      const occupied = []
      const positions = {}
      const free = (x, y, width, height) => {
        for (let row = y; row < y + height; row += 1) {
          for (let col = x; col < x + width; col += 1) if (occupied[row]?.[col]) return false
        }
        return true
      }
      for (const entry of order) {
        const widget = widgets[entry.id]
        if (!widget) continue
        const [width, height] = footprint(types, widget.type, entry.size, cols)
        let placed = false
        for (let y = 0; !placed; y += 1) {
          for (let x = 0; x <= cols - width; x += 1) {
            if (!free(x, y, width, height)) continue
            for (let row = y; row < y + height; row += 1) {
              occupied[row] = occupied[row] ?? []
              for (let col = x; col < x + width; col += 1) occupied[row][col] = 1
            }
            positions[entry.id] = { x, y, w: width, h: height }
            placed = true
            break
          }
        }
      }
      return positions
    }

    const columnsFor = (width) => (width >= 940 ? 12 : width >= 540 ? 6 : 4)

    // ---- data hooks --------------------------------------------------------

    function useDaily() {
      const [daily, setDaily] = useState(null)
      const [items, setItems] = useState([])
      const [status, setStatus] = useState('loading')
      const [error, setError] = useState(null)
      const [toast, setToast] = useState(null)

      const load = useCallback(async () => {
        try {
          const [snapshot, listing] = await Promise.all([
            api('/daily'),
            api('/items?limit=400&kind=all'),
          ])
          setDaily(snapshot)
          setItems(listing?.items ?? [])
          setError(null)
          setStatus('ready')
          return { snapshot, items: listing?.items ?? [] }
        } catch (failure) {
          setError(String(failure?.message ?? failure))
          setStatus('error')
          return null
        }
      }, [])

      useEffect(() => {
        let live = true
        void load().then((result) => {
          if (!live || !result) return
          // A first run has no Items yet; ask the Host for one pass and reload when it lands.
          if ((result.items ?? []).length === 0) {
            void api('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
              .then(() => setTimeout(() => { if (live) void load() }, 1500))
              .catch(() => {})
          }
        })
        return () => { live = false }
      }, [load])

      const run = useCallback(async (name, body, options = {}) => {
        try {
          const precondition = options.precondition !== undefined ? options.precondition : inferPrecondition(daily, name, body)
          const result = await action(name, body, precondition)
          if (result && result.ok === false) {
            if (result.code === 'conflict') {
              await load()
              setToast({ text: String(result.error ?? '这条记录已被其它设备修改，已刷新到最新状态') })
              return result
            }
            setToast({ text: String(result.error ?? '操作没有成功') })
            return result
          }
          await load()
          if (options.toast) setToast({ text: options.toast })
          return result
        } catch (failure) {
          setToast({ text: String(failure?.message ?? failure) })
          return null
        }
      }, [load, daily])

      const refreshSources = useCallback(async () => {
        setStatus('refreshing')
        try {
          await api('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        } catch (failure) {
          setToast({ text: String(failure?.message ?? failure) })
        }
        await load()
      }, [load])

      useEffect(() => {
        if (!toast) return undefined
        const timer = setTimeout(() => setToast(null), 4200)
        return () => clearTimeout(timer)
      }, [toast])

      return { daily, items, status, error, toast, setToast, run, refreshSources, reload: load }
    }

    // ---- panel -------------------------------------------------------------

    function SooyoPanel() {
      const state = useDaily()
      const rootRef = useRef(null)
      const gridRef = useRef(null)
      const [cols, setCols] = useState(12)
      const [editing, setEditing] = useState(false)
      const [modal, setModal] = useState(null)
      const [menu, setMenu] = useState(null)
      const [deck, setDeck] = useState({ index: {}, flipped: {} })
      const [query, setQuery] = useState('')
      const [cmdOpen, setCmdOpen] = useState(false)
      const [theme, setTheme] = useState('light')

      const daily = state.daily
      const widgets = daily?.widgets ?? {}
      const types = daily?.types ?? {}
      const boards = daily?.boards ?? []
      const activeBoard = daily?.active ?? boards[0]?.id ?? null
      const layout = activeBoard ? (daily?.layouts?.[activeBoard]?.[cols] ?? daily?.layouts?.[activeBoard]?.[12] ?? []) : []

      // Dark mode follows the OS until the user picks one, and the choice survives reloads.
      useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const stored = (() => { try { return window.localStorage.getItem('sooyo:theme') } catch { return null } })()
        const sync = () => setTheme(stored ?? (media.matches ? 'dark' : 'light'))
        sync()
        media.addEventListener?.('change', sync)
        return () => media.removeEventListener?.('change', sync)
      }, [])

      // The grid's own width decides the breakpoint, not the window (the sidebar takes space).
      useEffect(() => {
        const element = gridRef.current
        if (!element || typeof ResizeObserver === 'undefined') return undefined
        const apply = () => setCols(columnsFor(element.clientWidth || 1200))
        apply()
        const observer = new ResizeObserver(apply)
        observer.observe(element)
        return () => observer.disconnect()
      }, [daily])

      const byId = useMemo(() => {
        const map = new Map()
        for (const [id, snap] of Object.entries(daily?.readLaterEntries ?? {})) {
          if (snap && typeof snap === 'object') map.set(id, snap)
        }
        for (const item of state.items) map.set(item.id, item)
        return map
      }, [state.items, daily?.readLaterEntries])
      const saved = useMemo(() => new Set(daily?.readLater ?? []), [daily?.readLater])
      const layoutSizes = useMemo(() => {
        const map = {}
        for (const entry of layout) map[entry.id] = entry.size
        return map
      }, [layout])

      const context = useMemo(() => ({
        items: state.items,
        byId,
        saved,
        tasks: daily?.tasks ?? [],
        notes: daily?.notes ?? [],
        readLater: daily?.readLater ?? [],
        readLaterEntries: daily?.readLaterEntries ?? {},
        interests: daily?.interests ?? [],
        bookmarks: daily?.bookmarks ?? [],
        habits: daily?.habits ?? [],
        focus: daily?.focus ?? null,
        sources: daily?.sources ?? [],
        agentInbox: daily?.agentInbox ?? [],
        types,
        cols,
        layoutSizes,
        deckIndex: deck.index,
        deckFlipped: deck.flipped,
        sizesOf: (type) => sizeOrder.filter((size) => types[type]?.sizes?.[size]),
      }), [state.items, byId, saved, daily, types, cols, layoutSizes, deck])

      const positions = useMemo(
        () => pack(types, widgets, layout, cols),
        [types, widgets, layout, cols],
      )

      /**
       * Approve or reject an Agent proposal, then reload.
       *
       * It talks to `/agent-inbox/decide` rather than `/action` because approving applies the
       * operations: the response says whether the apply succeeded, and the toast must report the
       * weaker of the two outcomes ("已批准，但执行失败") instead of claiming success.
       */
      const decide = useCallback(async (proposalId, decision) => {
        try {
          const proposal = (daily?.agentInbox ?? []).find((entry) => entry.id === proposalId)
          const precondition = Number.isSafeInteger(proposal?.revision)
            ? { entity: 'proposal', id: proposal.id, revision: proposal.revision }
            : undefined
          const result = await api('/agent-inbox/decide', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: proposalId,
              decision,
              ...(precondition ? { precondition } : {}),
            }),
          })
          if (result?.ok === false) {
            state.setToast({ text: String(result.error ?? '这条建议没有处理成功') })
          } else if (decision === 'approve') {
            const applied = result?.applied
            const failed = Array.isArray(applied) ? applied.filter((entry) => !entry.ok) : (applied?.failed ?? [])
            state.setToast({
              text: failed.length > 0 || applied?.ok === false
                ? `已批准，但执行失败：${String(failed[0]?.error ?? applied?.error ?? '未知原因')}`
                : '已批准并执行',
            })
          } else if (decision === 'rollback') {
            state.setToast({ text: '已撤销这条提议的改动' })
          } else {
            state.setToast({ text: '已拒绝这条建议' })
          }
        } catch (failure) {
          state.setToast({ text: String(failure?.message ?? failure) })
        }
        await state.reload()
      }, [state, daily?.agentInbox])

      // ---- deck navigation ----

      const deckItemsOf = useCallback((widget) => {
        const list = subItemsOf(widget, state.items, daily?.interests ?? [])
        return list.slice(0, DECK_SIZE)
      }, [state.items, daily?.interests])

      const stepDeck = useCallback((widgetId, delta, out) => {
        const widget = widgets[widgetId]
        if (!widget) return
        const list = deckItemsOf(widget)
        const total = list.length
        if (total === 0) return
        setDeck((current) => {
          const index = current.index[widgetId] ?? 0
          const next = Math.max(0, Math.min(total - 1, index + delta))
          const leaving = list[index]
          if (leaving && delta > 0) void action('item.state', { ids: [leaving.id], seen: true }).catch(() => {})
          return { ...current, index: { ...current.index, [widgetId]: next } }
        })
        void out
      }, [widgets, deckItemsOf])

      const currentDeckItem = useCallback((widgetId) => {
        const widget = widgets[widgetId]
        if (!widget) return null
        const list = deckItemsOf(widget)
        return list[Math.min(deck.index[widgetId] ?? 0, Math.max(0, list.length - 1))] ?? null
      }, [widgets, deckItemsOf, deck.index])

      // ---- widget operations ----

      const addWidget = useCallback((type, size, settings, title) => {
        void state.run('widget.add', { type, size, settings, title, boardId: activeBoard }, { toast: `已添加「${types[type]?.name ?? type}」` })
      }, [state, activeBoard, types])

      const setSize = useCallback((widgetId, size) => {
        void state.run('widget.resize', { id: widgetId, size, cols, boardId: activeBoard })
      }, [state, cols, activeBoard])

      const removeWidget = useCallback((widgetId) => {
        void state.run('widget.remove', { id: widgetId }, { toast: '已移除这个 Widget' })
      }, [state])

      const duplicateWidget = useCallback((widgetId) => {
        void state.run('widget.duplicate', { id: widgetId, boardId: activeBoard }, { toast: '已复制' })
      }, [state, activeBoard])

      // ---- item operations ----

      const toggleLater = useCallback((itemId, forceOff) => {
        const on = saved.has(itemId)
        void state.run('readlater.set', { itemId, on: forceOff ? false : !on }, { toast: on || forceOff ? '已移出稍后读' : '已存到稍后读' })
      }, [state, saved])

      const itemToTask = useCallback((itemId) => {
        const item = byId.get(itemId)
        if (!item) return
        void state.run('item.toTask', {
          title: item.title.length > 60 ? `${item.title.slice(0, 59)}…` : item.title,
          origin: { source: item.sourceLabel ?? '', url: item.url ?? '' },
        }, { toast: `已转为任务，放进收件箱 · 出处：${item.sourceLabel ?? ''}` })
      }, [state, byId])

      const itemToNote = useCallback((itemId) => {
        const item = byId.get(itemId)
        if (!item) return
        void state.run('item.toNote', {
          title: item.title,
          origin: { source: item.sourceLabel ?? '', url: item.url ?? '' },
        }, { toast: `已转为 Note · 出处：${item.sourceLabel ?? ''}` })
      }, [state, byId])

      // ---- delegated clicks ----

      const onRootClick = useCallback((event) => {
        const target = event.target instanceof Element ? event.target : null
        if (!target) return
        if (menu && !target.closest('.sy-pop') && !target.closest('[data-act="w-menu"]') && !target.closest('[data-act="board-new"]')) setMenu(null)

        const opened = target.closest('a[data-open]')
        if (opened?.dataset.open) {
          void action('item.state', { ids: [opened.dataset.open], seen: true }).catch(() => {})
        }

        const element = target.closest('[data-act]')
        if (!element) return
        const act = element.dataset.act
        const ds = element.dataset

        switch (act) {
          case 'board': void state.run('board.active', { id: ds.board }); break
          case 'board-new': {
            const rect = element.getBoundingClientRect()
            setMenu({ kind: 'board-new', rect })
            break
          }
          case 'edit-toggle': setEditing((value) => !value); break
          case 'gallery-open': setModal({ kind: 'gallery', type: 'subscription', size: 'M', sources: ['aihot'], pres: null }); break
          case 'w-menu': {
            const rect = element.getBoundingClientRect()
            setMenu({ kind: 'w-menu', id: ds.w, rect })
            break
          }
          case 'w-size': setMenu(null); setSize(ds.w, ds.size); break
          case 'w-dup': setMenu(null); duplicateWidget(ds.w); break
          case 'w-remove': setMenu(null); removeWidget(ds.w); break
          case 'w-settings': setMenu(null); setModal({ kind: 'settings', id: ds.w }); break
          case 'w-refresh': setMenu(null); void state.refreshSources(); break
          case 'task-toggle': void state.run('task.update', { id: ds.task, done: !daily?.tasks?.find((task) => task.id === ds.task)?.done }); break
          case 'task-today': void state.run('task.update', { id: ds.task, list: 'today' }, { toast: '已移到今天' }); break
          case 'task-remove': void state.run('task.remove', { id: ds.task }, { toast: '已删除' }); break
          case 'note-remove': void state.run('note.remove', { id: ds.note }, { toast: '已删除' }); break
          case 'habit-tick': void state.run('habit.tick', { id: ds.habit }); break
          case 'item-later': toggleLater(ds.item, ds.off === '1'); break
          case 'item-task': itemToTask(ds.item); break
          case 'rl-note': itemToNote(ds.item); break
          case 'sub-cat': {
            const widget = widgets[ds.w]
            if (widget) void state.run('widget.update', { id: ds.w, settings: { ...widget.settings, cat: ds.v || null } })
            break
          }
          case 'dk-next': stepDeck(ds.w, 1); break
          case 'dk-prev': stepDeck(ds.w, -1); break
          case 'dk-later': {
            const item = currentDeckItem(ds.w)
            if (item) toggleLater(item.id)
            stepDeck(ds.w, 1)
            break
          }
          case 'dk-task': {
            const item = currentDeckItem(ds.w)
            if (item) itemToTask(item.id)
            stepDeck(ds.w, 1)
            break
          }
          case 'dk-flip': setDeck((current) => ({ ...current, flipped: { ...current.flipped, [ds.w]: !current.flipped[ds.w] } })); break
          case 'focus-toggle': void state.run('focus.set', { action: daily?.focus?.running ? 'pause' : 'start' }); break
          case 'focus-reset': void state.run('focus.set', { action: 'reset' }); break
          case 'focus-next-task': {
            const open = (daily?.tasks ?? []).filter((task) => task.list === 'today' && !task.done)
            const index = open.findIndex((task) => task.id === daily?.focus?.task)
            void state.run('focus.set', { action: 'task', task: open[(index + 1) % Math.max(1, open.length)]?.id ?? null })
            break
          }
          case 'modal-close': setModal(null); break
          case 'scrim': if (target === element) setModal(null); break
          // A proposal decision goes to its own local route, not `/action`: the endpoint is
          // where approve-then-apply happens, and it is deliberately not reachable over sync.
          case 'proposal-approve': void decide(ds.proposal, 'approve'); break
          case 'proposal-reject': void decide(ds.proposal, 'reject'); break
          case 'proposal-rollback': void decide(ds.proposal, 'rollback'); break
          default: break
        }
      }, [menu, state, widgets, daily, saved, toggleLater, itemToTask, itemToNote, stepDeck, currentDeckItem, setSize, duplicateWidget, removeWidget])

      // ---- forms ------------------------------------------------------------

      const onRootSubmit = useCallback((event) => {
        const form = event.target instanceof Element ? event.target.closest('[data-form]') : null
        if (!form) return
        event.preventDefault()
        const input = form.querySelector('input')
        const value = (input?.value ?? '').trim()
        if (!value) return
        if (form.dataset.form === 'capture') {
          void state.run('capture', { text: value }).then(() => { if (input) input.value = '' })
        }
        if (form.dataset.form === 'task-add') {
          void state.run('task.add', { title: value, list: 'today' }).then(() => { if (input) input.value = '' })
        }
        if (form.dataset.form === 'board-new') {
          void state.run('board.create', { name: value }).then(() => setMenu(null))
        }
      }, [state])

      // ---- keyboard: ⌘K / / to search, arrows inside a deck ----

      useEffect(() => {
        const onKeyDown = (event) => {
          const inField = /INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            rootRef.current?.querySelector('input[name="cmd"]')?.focus()
            return
          }
          if (event.key === 'Escape') {
            if (menu) setMenu(null)
            else if (modal) setModal(null)
            else if (cmdOpen) setCmdOpen(false)
            else if (editing) setEditing(false)
            return
          }
          if (inField) return
          const deckElement = document.activeElement?.closest?.('[data-deck]') ?? rootRef.current?.querySelector('[data-deck]:focus-within')
          if (!deckElement) return
          const widgetId = deckElement.dataset.deck
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); stepDeck(widgetId, 1) }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); stepDeck(widgetId, -1) }
          if (event.key.toLowerCase() === 'l') { const item = currentDeckItem(widgetId); if (item) toggleLater(item.id) }
          if (event.key === ' ' || event.key.toLowerCase() === 'f') {
            event.preventDefault()
            setDeck((current) => ({ ...current, flipped: { ...current.flipped, [widgetId]: !current.flipped[widgetId] } }))
          }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [menu, modal, cmdOpen, editing, stepDeck, currentDeckItem, toggleLater])

      // ---- card pointer gestures: swipe a deck, drag to reorder in edit mode ----

      const onPointerDown = useCallback((event) => {
        const target = event.target instanceof Element ? event.target : null
        if (!target || event.button !== 0) return

        if (editing) {
          const card = target.closest('.sy-w')
          if (!card || target.closest('.sy-e-bar')) return
          event.preventDefault()
          const widgetId = card.dataset.id
          if (target.closest('[data-rz]')) {
            startResize(event, card, widgetId, cols, types, widgets, layout, (id, size) => setSize(id, size))
            return
          }
          startDrag(event, card, widgetId, layout, activeBoard, (order) => {
            void state.run('layout.set', { boardId: activeBoard, cols, order })
          })
          return
        }

        const card = target.closest('.sy-dk-card[data-pos="cur"]')
        if (!card || target.closest('button, a, .sy-ctl')) return
        const deckElement = card.closest('[data-deck]')
        if (!deckElement) return
        const vertical = deckElement.classList.contains('v')
        const widgetId = deckElement.dataset.deck
        const startX = event.clientX
        const startY = event.clientY
        let delta = 0
        let moved = false
        const move = (moveEvent) => {
          delta = vertical ? moveEvent.clientY - startY : moveEvent.clientX - startX
          if (!moved && Math.abs(delta) < 6) return
          moved = true
          deckElement.classList.add('dragging')
          card.style.transform = vertical
            ? `translateY(${delta * 0.6}px)`
            : `translateX(${delta}px) rotate(${delta / 22}deg)`
        }
        const finish = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          deckElement.classList.remove('dragging')
          card.style.transform = ''
          if (!moved) {
            if (card.classList.contains('paper')) {
              setDeck((current) => ({ ...current, flipped: { ...current.flipped, [widgetId]: !current.flipped[widgetId] } }))
            } else if (vertical) stepDeck(widgetId, 1)
            return
          }
          if (vertical) {
            if (delta < -30) stepDeck(widgetId, 1)
            else if (delta > 30) stepDeck(widgetId, -1)
            return
          }
          if (delta > 90) {
            const item = currentDeckItem(widgetId)
            if (item) toggleLater(item.id)
            stepDeck(widgetId, 1)
          } else if (delta < -90) stepDeck(widgetId, 1)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
      }, [editing, cols, types, widgets, layout, activeBoard, state, setSize, stepDeck, currentDeckItem, toggleLater])

      // ---- command bar ----

      const commands = useMemo(() => {
        const text = query.trim()
        const out = []
        const head = (text.match(/^(\S+)\s*(.*)$/)?.[1] ?? '').toLowerCase()
        const rest = text.match(/^(\S+)\s*(.*)$/)?.[2] ?? ''
        if (!text) {
          out.push({ group: '命令' })
          out.push({ k: 'todo', label: '新建任务', run: () => { setQuery('todo '); } , keep: true })
          out.push({ k: 'note', label: '记一条 Note', run: () => { setQuery('note ') }, keep: true })
          out.push({ k: 'add', label: '添加 Widget', run: () => setModal({ kind: 'gallery', type: 'subscription', size: 'M', sources: ['aihot'], pres: null }) })
          out.push({ group: '前往 Board' })
          for (const board of boards) out.push({ k: 'go', label: board.name, run: () => { void state.run('board.active', { id: board.id }); setCmdOpen(false) } })
          return out
        }
        if (['todo', 't', 'task'].includes(head)) {
          out.push({ group: '新建' })
          if (rest) out.push({ k: '↵', label: `新建任务「${rest}」→ 收件箱`, run: () => { void state.run('capture', { text: rest }, { toast: '已存进收件箱' }); setQuery(''); setCmdOpen(false) } })
          else out.push({ k: '…', label: '继续输入任务内容', keep: true, run: () => {} })
          return out
        }
        if (head === 'note') {
          out.push({ group: '新建' })
          if (rest) out.push({ k: '↵', label: `存为 Note「${rest}」`, run: () => { void state.run('capture', { text: `#note ${rest}` }, { toast: '已存为 Note' }); setQuery(''); setCmdOpen(false) } })
          else out.push({ k: '…', label: '继续输入 Note 内容', keep: true, run: () => {} })
          return out
        }
        if (head === 'add' || head === 'widget') {
          out.push({ group: 'Widget' })
          for (const [type, definition] of Object.entries(types)) {
            if (definition.soon) continue
            if (rest && !definition.name.includes(rest)) continue
            out.push({ k: definition.soon ? 'soon' : 'P0', label: `添加「${definition.name}」`, run: () => setModal({ kind: 'gallery', type, size: 'M', sources: ['aihot'], pres: null }) })
          }
          return out
        }
        const lowered = text.toLowerCase()
        const matchedBoards = boards.filter((board) => board.name.includes(text))
        const matchedTasks = (daily?.tasks ?? []).filter((task) => task.title.toLowerCase().includes(lowered)).slice(0, 4)
        const matchedItems = state.items.filter((item) => String(item.title).toLowerCase().includes(lowered)).slice(0, 5)
        if (matchedBoards.length) {
          out.push({ group: 'Board' })
          for (const board of matchedBoards) out.push({ k: 'go', label: board.name, run: () => { void state.run('board.active', { id: board.id }); setCmdOpen(false) } })
        }
        if (matchedTasks.length) {
          out.push({ group: '任务' })
          for (const task of matchedTasks) out.push({ k: task.done ? '✓' : '·', label: task.title, run: () => { void state.run('task.update', { id: task.id, done: !task.done }); setCmdOpen(false) } })
        }
        if (matchedItems.length) {
          out.push({ group: '订阅内容' })
          for (const item of matchedItems) out.push({ k: item.sourceLabel ?? '', label: item.title, href: safeUrl(item.url) })
        }
        out.push({ group: '新建' })
        out.push({ k: 'todo', label: `新建任务「${text}」`, run: () => { void state.run('capture', { text }, { toast: '已存进收件箱' }); setQuery(''); setCmdOpen(false) } })
        return out
      }, [query, boards, daily?.tasks, state.items, types, state])

      // ---- render ----------------------------------------------------------

      const screenshotTheme = theme === 'dark' ? 'dark' : 'light'
      const board = boards.find((entry) => entry.id === activeBoard) ?? null
      const openTasks = (daily?.tasks ?? []).filter((task) => task.list === 'today' && !task.done).length
      const freshItems = state.items.filter((item) => item.itemKind !== 'rank'
        && Date.now() - Date.parse(item.publishedAt ?? 0) < 24 * 3600e3).length
      const erroring = (daily?.sources ?? []).filter((source) => source.lastError).length
      const readLaterCount = daily?.readLater?.length ?? 0

      const em = (name, rotated, text) => `<span class="sy-nw"><img class="sy-hi${rotated ? ' r' : ''}" src="${ASSET}/${name}.webp" alt="" onerror="this.remove()"><b>${esc(text)}</b></span>`
      const headline = (() => {
        if (!board) return `${esc(greeting())}。`
        if (board.id === 'home') return `${esc(greeting())}。今天还有 ${em('task', false, `${openTasks} 件事`)}，${em('subscription', true, `${freshItems} 条`)}新内容。`
        if (board.id === 'work') return `工作。${em('task', false, `${openTasks} 件任务`)}待办，${em('project', true, `${projectsOf(daily?.tasks ?? []).length} 个项目`)}在推进。`
        if (board.id === 'life') return `生活。${em('habit', false, `${(daily?.habits ?? []).length} 个习惯`)}在坚持，${em('bookmarks', true, `${(daily?.bookmarks ?? []).length} 个书签`)}常去。`
        if (board.id === 'read') return `阅读。${em('subscription', false, `${freshItems} 条`)}新内容，${em('readlater', true, `${readLaterCount} 篇`)}稍后读。`
        return `${esc(board.name)}。这个 Board 上有 <b>${layout.length} 个 Widget</b>。`
      })()

      return h('div', {
        className: 'sy-root',
        'data-theme': screenshotTheme,
        ref: rootRef,
        onClick: onRootClick,
        onSubmit: onRootSubmit,
        onPointerDown,
      }, [
        h('style', { key: 'css' }, CSS),
        // The grain layer: a fixed, non-interactive veil over the whole viewport. It is a real
        // node rather than a pseudo-element so it cannot collide with another ::after rule, and
        // so the reduced-motion block can leave it alone.
        h('div', { className: 'sy-grain', key: 'grain', 'aria-hidden': 'true' }),
        h('div', { className: 'sy-page', key: 'page' },
          h('div', { className: 'sy-frame' + (editing ? ' sy-editing' : ''), 'data-cols': cols },
            h('header', { className: 'sy-topbar', key: 'top' }, [
              h('div', { className: 'sy-brand', key: 'brand' }, [h('i', { key: 'dot' }), 'sooyo', h('span', { key: 'sub' }, 'daily')]),
              h('div', { className: 'sy-seg sy-seg-boards', key: 'tabs', role: 'tablist' }, [
                ...boards.map((entry) => h('button', {
                  key: entry.id,
                  role: 'tab',
                  'aria-pressed': entry.id === activeBoard,
                  'data-act': 'board',
                  'data-board': entry.id,
                }, entry.name)),
                h('button', { key: 'add', className: 'sy-seg-add', 'data-act': 'board-new', 'aria-label': '新建 Board', title: '新建 Board' }, h('span', { dangerouslySetInnerHTML: { __html: I.plus } })),
              ]),
              h('div', { className: 'sy-cmd', key: 'cmd' }, [
                h('div', { className: 'sy-cmd-box', key: 'box' }, [
                  h('span', { key: 'icon', dangerouslySetInnerHTML: { __html: I.search } }),
                  h('input', {
                    key: 'input',
                    name: 'cmd',
                    value: query,
                    placeholder: '搜索，或输入 todo · note · add',
                    autocomplete: 'off',
                    'aria-label': '搜索或输入命令',
                    onFocus: () => setCmdOpen(true),
                    onChange: (event) => { setQuery(event.target.value); setCmdOpen(true) },
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        const first = commands.find((entry) => typeof entry.run === 'function')
                        event.preventDefault()
                        first?.run?.()
                      }
                    },
                  }),
                  h('kbd', { key: 'kbd' }, '⌘K'),
                ]),
                cmdOpen && commands.length > 0
                  ? h('div', { className: 'sy-cmd-pop', key: 'pop', role: 'listbox' },
                    commands.map((entry, index) => entry.group
                      ? h('div', { className: 'sy-cmd-group', key: `g${index}` }, entry.group)
                      : h(entry.href ? 'a' : 'button', {
                        key: `i${index}`,
                        className: 'sy-cmd-item',
                        role: 'option',
                        href: entry.href || undefined,
                        target: entry.href ? '_blank' : undefined,
                        rel: entry.href ? 'noopener noreferrer' : undefined,
                        onClick: () => { if (!entry.keep) setCmdOpen(false); entry.run?.() },
                      }, [
                        h('span', { className: 'k', key: 'k' }, entry.k ?? ''),
                        h('span', { className: 'ci-t c1', key: 't' }, entry.label),
                      ])))
                  : null,
              ]),
              h('div', { className: 'sy-actions', key: 'actions' }, [
                h('button', {
                  key: 'edit',
                  className: 'sy-switch',
                  role: 'switch',
                  'aria-checked': editing,
                  'data-act': 'edit-toggle',
                }, [h('span', { className: 'lbl', key: 'l' }, '编辑'), h('span', { className: 'sy-sw', key: 's', 'aria-hidden': true })]),
                h('button', { key: 'add', className: 'sy-btn sy-btn-add', 'data-act': 'gallery-open' }, [
                  h('span', { key: 'i', dangerouslySetInnerHTML: { __html: I.plus } }),
                  h('span', { className: 'lbl', key: 'l' }, '添加 Widget'),
                ]),
                h('button', {
                  key: 'theme',
                  className: 'sy-icon-btn',
                  'aria-label': '切换浅色或深色',
                  onClick: () => {
                    const next = screenshotTheme === 'dark' ? 'light' : 'dark'
                    setTheme(next)
                    try { window.localStorage.setItem('sooyo:theme', next) } catch { /* storage unavailable */ }
                  },
                }, h('span', { dangerouslySetInnerHTML: { __html: screenshotTheme === 'dark' ? I.sun : I.moon } })),
                h('button', { key: 'refresh', className: 'sy-icon-btn', 'aria-label': '刷新信息源', title: '刷新信息源', onClick: () => void state.refreshSources() },
                  h('span', { dangerouslySetInnerHTML: { __html: I.reset } })),
              ]),
            ]),
            h('section', { className: 'sy-hero', key: 'hero' }, [
              h('div', { key: 'left' }, [
                h('span', { className: 'sy-tag', key: 'tag' }, `${new Date().getMonth() + 1}月${new Date().getDate()}日 · 星期${WEEK[new Date().getDay()]}`),
                h('h1', { className: 'sy-headline', key: 'h', dangerouslySetInnerHTML: { __html: headline } }),
              ]),
              h('div', { className: 'sy-status', key: 'status' }, [
                h('i', { key: 'dot', className: erroring > 0 ? 'warn' : '' }),
                `${(daily?.sources ?? []).length - erroring} 个来源正常 · ${state.items.length} 条内容`,
              ]),
            ]),
            editing
              ? h('div', { className: 'sy-editbar', key: 'editbar' }, [
                h('span', { className: 'grow', key: 'text' }, `正在编辑「${board?.name ?? ''}」的布局（${cols} 列）。拖动卡片排序，拖右下角改尺寸；不同宽度各自保存。`),
                h('button', { className: 'sy-btn', key: 'add', 'data-act': 'gallery-open' }, '添加'),
                h('button', { className: 'sy-btn sy-btn-ink', key: 'done', 'data-act': 'edit-toggle' }, '完成'),
              ])
              : null,
            h('div', {
              className: 'sy-grid',
              key: 'grid',
              ref: gridRef,
              style: { '--cols': cols },
            }, [
              ...layout.map((entry) => {
                const widget = widgets[entry.id]
                const position = positions[entry.id]
                if (!widget || !position) return null
                const { cls, html } = cardInner(widget, entry.size, context)
                return h('section', {
                  key: entry.id,
                  className: cls,
                  'data-id': entry.id,
                  style: {
                    gridColumn: `${position.x + 1} / span ${position.w}`,
                    gridRow: `${position.y + 1} / span ${position.h}`,
                  },
                }, h(WidgetBody, { html, cls }))
              }),
              layout.length === 0
                ? h('div', { className: 'sy-grid-empty', key: 'empty' }, [
                  h('div', { key: 'text' }, [
                    h('b', { key: 'b', style: { fontSize: 16, color: 'var(--sy-ink)', display: 'block' } }, '这个 Board 还是空的'),
                    h('div', { className: 'meta', key: 'm', style: { marginTop: 4, whiteSpace: 'normal' } }, '从 Widget 库里挑几个。'),
                  ]),
                  h('div', { className: 'row-btns', key: 'btns' },
                    h('button', { className: 'sy-btn sy-btn-ink', 'data-act': 'gallery-open' }, '添加 Widget')),
                ])
                : null,
            ]),
            h('div', { className: 'meta', key: 'footer', style: { marginTop: 14, whiteSpace: 'normal', lineHeight: '19px' } },
              '数据来源：AIHOT（个人非商业使用）、HuggingFace、Product Hunt、YouTube。抓取到的内容一律视为资料，不作为指令执行。'),
          ),
        ),
        menu ? h(MenuLayer, { key: 'menu', menu, widgets, types, context, onClose: () => setMenu(null) }) : null,
        modal ? h(ModalLayer, {
          key: 'modal',
          modal,
          widgets,
          types,
          context,
          board,
          onClose: () => setModal(null),
          onAdd: addWidget,
          onRun: state.run,
        }) : null,
        state.toast ? h('div', { className: 'sy-toast', key: 'toast', role: 'status' }, h('span', null, state.toast.text)) : null,
      ])
    }

    /**
     * A card's body is an HTML string, so it is mounted once per `html` value and trimmed
     * after mount. React never diffs inside it, which is what keeps a deck's CSS transition
     * from being interrupted by a re-render.
     */
    function WidgetBody(props) {
      const ref = useRef(null)
      useEffect(() => {
        if (ref.current) fitDom(ref.current)
      }, [props.html])
      return h('div', { ref, style: { display: 'contents' }, dangerouslySetInnerHTML: { __html: props.html } })
    }

    // ---- drag and resize (edit mode) ---------------------------------------

    function startDrag(event, card, widgetId, layout, boardId, commit) {
      const rect = card.getBoundingClientRect()
      const start = { x: event.clientX, y: event.clientY }
      let ghost = null
      let lockUntil = 0
      const order = [...layout]

      const move = (moveEvent) => {
        if (!ghost) {
          if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 5) return
          ghost = card.cloneNode(true)
          ghost.classList.add('sy-ghost')
          ghost.style.width = `${rect.width}px`
          ghost.style.height = `${rect.height}px`
          ghost.style.gridColumn = ''
          ghost.style.gridRow = ''
          document.body.appendChild(ghost)
          card.classList.add('is-ph')
        }
        ghost.style.left = `${moveEvent.clientX - (start.x - rect.left)}px`
        ghost.style.top = `${moveEvent.clientY - (start.y - rect.top)}px`
        if (performance.now() < lockUntil) return
        const over = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY)
          .find((element) => element.matches?.('.sy-grid > .sy-w') && element !== card)
        if (!over) return
        const overRect = over.getBoundingClientRect()
        const inX = (moveEvent.clientX - overRect.left) / overRect.width
        const inY = (moveEvent.clientY - overRect.top) / overRect.height
        if (inX < 0.15 || inX > 0.85 || inY < 0.15 || inY > 0.85) return
        const from = order.findIndex((entry) => entry.id === widgetId)
        const to = order.findIndex((entry) => entry.id === over.dataset.id)
        if (from < 0 || to < 0 || from === to) return
        const [moved] = order.splice(from, 1)
        order.splice(to, 0, moved)
        lockUntil = performance.now() + 280
        commit(order)
      }

      const finish = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        ghost?.remove()
        card.classList.remove('is-ph')
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      void boardId
    }

    function startResize(event, card, widgetId, cols, types, widgets, layout, commit) {
      const rect = card.getBoundingClientRect()
      const gridElement = card.parentElement
      const style = gridElement ? window.getComputedStyle(gridElement) : null
      const gap = Number.parseFloat(style?.columnGap ?? `${GAP}`) || GAP
      const rowPx = Number.parseFloat(style?.gridAutoRows ?? `${ROW}`) || ROW
      const colWidth = ((gridElement?.clientWidth ?? 1200) - gap * (cols - 1)) / cols
      const widget = widgets[widgetId]
      const sizes = Object.keys(types[widget?.type]?.sizes ?? {})

      const move = (moveEvent) => {
        const usedCols = (moveEvent.clientX - rect.left + gap / 2) / (colWidth + gap)
        const usedRows = (moveEvent.clientY - rect.top + gap / 2) / (rowPx + gap)
        let best = null
        let bestDistance = Infinity
        for (const size of sizes) {
          const [width, height] = footprint(types, widget.type, size, cols)
          const distance = (width - usedCols) ** 2 + (height - usedRows) ** 2 * 1.4
          if (distance < bestDistance) {
            bestDistance = distance
            best = size
          }
        }
        const current = layout.find((entry) => entry.id === widgetId)?.size
        if (best && best !== current) commit(widgetId, best)
      }
      const finish = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', finish)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', finish)
    }

    // ---- menu layer --------------------------------------------------------

    function MenuLayer(props) {
      const { menu, widgets, types, context, onClose } = props
      const style = {
        left: Math.max(12, Math.min(menu.rect.right - 216, (window.innerWidth || 1200) - 228)),
        top: Math.min(menu.rect.bottom + 6, (window.innerHeight || 800) - 320),
      }
      if (menu.kind === 'board-new') {
        return h('div', { className: 'sy-pop', style, role: 'dialog', 'aria-label': '新建 Board' }, [
          h('div', { className: 'sy-pop-h', key: 'h' }, '新建 Board'),
          h('form', { className: 'sy-mi', key: 'f', 'data-form': 'board-new', style: { cursor: 'default' } }, [
            h('input', { key: 'i', name: 'name', placeholder: '例如：科研、旅行', autocomplete: 'off', 'aria-label': 'Board 名称', autoFocus: true }),
            h('button', { className: 'sy-btn sy-btn-ink', key: 'b', style: { height: 30 } }, '创建'),
          ]),
          h('div', { className: 'meta', key: 'n', style: { padding: '2px 10px 8px', whiteSpace: 'normal' } }, '新 Board 是空的，和其它 Board 共用同一份任务和订阅。'),
        ])
      }

      const widget = widgets[menu.id]
      if (!widget) return null
      const currentSize = context.layoutSizes?.[menu.id] ?? 'M'
      return h('div', { className: 'sy-pop', style, role: 'menu' }, [
        h('div', { className: 'sy-pop-h', key: 'h' }, [h('span', { key: 's' }, '尺寸'), h('span', { className: 'meta', key: 'm' }, `${context.cols} 列布局`)]),
        h('div', { className: 'sizes', key: 'sizes' }, sizeOrder.map((entry) => h('button', {
          key: entry,
          className: 'sy-sz',
          'data-act': 'w-size',
          'data-w': menu.id,
          'data-size': entry,
          'aria-pressed': currentSize === entry,
          disabled: !types[widget.type]?.sizes?.[entry],
          title: types[widget.type]?.sizes?.[entry] ? `尺寸 ${entry}` : '这个 Widget 没有这个尺寸',
        }, entry))),
        h('hr', { key: 'hr' }),
        h('button', { className: 'sy-mi', key: 'refresh', 'data-act': 'w-refresh', 'data-w': menu.id }, '刷新'),
        h('button', { className: 'sy-mi', key: 'settings', 'data-act': 'w-settings', 'data-w': menu.id }, '设置…'),
        h('button', { className: 'sy-mi', key: 'dup', 'data-act': 'w-dup', 'data-w': menu.id }, '复制'),
        h('button', { className: 'sy-mi danger', key: 'remove', 'data-act': 'w-remove', 'data-w': menu.id }, '移除'),
        h('button', { className: 'sy-mi', key: 'close', onClick: onClose }, '关闭'),
      ])
    }

    // ---- modal layer -------------------------------------------------------

    /**
     * The Widget 库.
     *
     * It owns its draft (type, size, sources) locally: the sheet is the only thing that reads
     * it, and a draft that leaked into the panel's state would need clearing on close. The
     * preview is the real card renderer at the chosen Size, scaled to fit — not a mockup, so
     * what the user sees is what `cardInner` will place on the Board.
     */
    function GallerySheet(props) {
      const { initial, types, context, board, onAdd, onClose } = props
      const [type, setType] = useState(types[initial.type] ? initial.type : 'subscription')
      const [size, setSize] = useState(initial.size ?? 'M')
      const [sources, setSources] = useState(initial.sources ?? ['aihot'])
      const [pres, setPres] = useState(initial.pres ?? null)

      const definition = types[type] ?? { name: type, desc: '', sizes: {}, actions: [] }
      const available = sizeOrder.filter((entry) => definition.sizes?.[entry])
      const activeSize = available.includes(size) ? size : available[0] ?? 'M'

      const suggested = pres
        ?? context.sources.find((source) => source.id === sources[0])?.suggests?.pres
        ?? '图文'
      const settings = type === 'subscription' ? { sources, pres: suggested, sort: sources[0] === 'aihot-hot' ? 'rank' : 'new' } : {}
      const previewWidget = { id: 'preview', type, settings, title: undefined }
      const preview = cardInner(previewWidget, activeSize, context, { preview: true })

      // The preview column is ~500px wide at 940px sheet width; scale the real footprint
      // into it rather than inventing a smaller layout.
      const [gridCols, gridRows] = definition.sizes?.[activeSize] ?? [3, 2]
      const previewWidth = gridCols * 68 + (gridCols - 1) * GAP
      const previewHeight = gridRows * ROW + (gridRows - 1) * GAP
      const scale = Math.min(0.9, 440 / previewWidth, 230 / previewHeight)

      const groups = [
        ['P0', '常用'],
        ['P1', '更多'],
        ['P2', '即将推出'],
      ]

      return h('div', { className: 'sy-scrim', 'data-act': 'scrim' },
        h('div', { className: 'sy-sheet', role: 'dialog', 'aria-modal': true, 'aria-label': 'Widget 库' }, [
          h('header', { className: 'sy-sh-h', key: 'h' }, [
            h('h2', { key: 't' }, 'Widget 库'),
            h('span', { className: 'meta', key: 'm' }, `加到「${board?.name ?? ''}」`),
            h('button', { className: 'sy-icon-btn', key: 'x', 'data-act': 'modal-close', 'aria-label': '关闭' }, h('span', { dangerouslySetInnerHTML: { __html: I.x } })),
          ]),
          h('div', { className: 'sy-gal', key: 'body' }, [
            h('div', { className: 'sy-gal-l', key: 'l' },
              groups.map(([priority, heading]) => [
                h('h3', { key: `h-${priority}` }, heading),
                ...Object.entries(types)
                  .filter(([, value]) => (priority === 'P2' ? value.soon : !value.soon && (value.pri ?? 'P0') === priority))
                  .map(([key, value]) => h('button', {
                    key,
                    className: 'sy-gal-it',
                    'aria-pressed': key === type,
                    onClick: () => {
                      setType(key)
                      const next = sizeOrder.filter((entry) => types[key]?.sizes?.[entry])
                      setSize((current) => (next.includes(current) ? current : next[0] ?? 'M'))
                    },
                  }, [
                    h('span', { key: 'i', dangerouslySetInnerHTML: { __html: ic(key, 32) } }),
                    h('span', { key: 't', style: { minWidth: 0 } }, [
                      h('b', { key: 'b' }, value.name),
                      h('small', { key: 's' }, value.desc),
                    ]),
                    value.soon ? h('span', { className: 'soon-b', key: 'soon' }, 'SOON') : null,
                  ])),
              ]),
            ),
            h('div', { className: 'sy-gal-r', key: 'r' }, [
              h('div', { className: 'sy-pv', key: 'pv' }, [
                h('div', {
                  key: 'in',
                  className: 'sy-pv-in',
                  style: { transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})` },
                }, h('section', {
                  className: preview.cls,
                  style: { width: previewWidth, height: previewHeight },
                  dangerouslySetInnerHTML: { __html: preview.html },
                })),
                h('span', { className: 'sy-pv-cap', key: 'cap' }, `${activeSize} · ${gridCols}×${gridRows} 格（桌面）`),
              ]),
              h('div', { className: 'sy-gal-meta', key: 'meta' }, [
                h('div', { className: 'sy-fld', key: 'size' }, [
                  h('span', { key: 'l' }, '尺寸'),
                  h('div', { className: 'sy-seg sm', key: 'seg' }, sizeOrder.map((entry) => h('button', {
                    key: entry,
                    'aria-pressed': entry === activeSize,
                    disabled: !definition.sizes?.[entry],
                    style: definition.sizes?.[entry] ? undefined : { opacity: .3, cursor: 'not-allowed' },
                    onClick: () => setSize(entry),
                  }, entry))),
                ]),
                type === 'subscription'
                  ? h('div', { className: 'sy-fld', key: 'sources' }, [
                    h('span', { key: 'l' }, '来源'),
                    h('div', { className: 'sy-chips', key: 'c' }, (context.sources ?? []).map((source) => h('button', {
                      key: source.id,
                      className: 'sy-chipbtn',
                      'aria-pressed': sources.includes(source.id),
                      onClick: () => {
                        setPres(null)
                        setSources((current) => (current.includes(source.id)
                          ? (current.length > 1 ? current.filter((entry) => entry !== source.id) : current)
                          : [...current, source.id]))
                      },
                    }, source.label))),
                  ])
                  : null,
                type === 'subscription'
                  ? h('div', { className: 'sy-fld', key: 'pres' }, [
                    h('span', { key: 'l' }, '呈现'),
                    h('div', { className: 'sy-seg sm', key: 'seg' }, ['图文', '榜单', '论文', '产品', '视频'].map((entry) => h('button', {
                      key: entry,
                      'aria-pressed': suggested === entry,
                      onClick: () => setPres(entry),
                    }, entry))),
                  ])
                  : null,
              ]),
              h('div', { className: 'sy-gal-acts', key: 'acts' },
                (definition.actions ?? []).length ? `能直接做：${definition.actions.join(' · ')}` : '只展示，不需要操作。'),
              h('button', {
                className: 'sy-btn sy-btn-wide',
                key: 'add',
                disabled: definition.soon,
                onClick: () => {
                  if (definition.soon) return
                  onAdd(type, activeSize, type === 'subscription' ? { ...settings, deck: false } : {})
                  onClose()
                },
              }, definition.soon ? '即将推出' : `添加到「${board?.name ?? ''}」`),
            ]),
          ]),
        ]))
    }

    function ModalLayer(props) {
      const { modal, widgets, types, context, board, onClose, onAdd, onRun } = props

      if (modal.kind === 'gallery') {
        return h(GallerySheet, { initial: modal, types, context, board, onAdd, onClose })
      }

      if (modal.kind === 'settings') {
        const widget = widgets[modal.id]
        if (!widget) return null
        const settings = widget.settings ?? {}
        return h('div', { className: 'sy-scrim', 'data-act': 'scrim' },
          h('div', { className: 'sy-sheet sm', role: 'dialog', 'aria-modal': true, 'aria-label': 'Widget 设置' }, [
            h('header', { className: 'sy-sh-h', key: 'h' }, [
              h('span', { key: 'i', dangerouslySetInnerHTML: { __html: ic(widget.type, 26) } }),
              h('h2', { key: 't' }, `${types[widget.type]?.name ?? ''}设置`),
              h('button', { className: 'sy-icon-btn', key: 'x', 'data-act': 'modal-close', 'aria-label': '关闭' }, h('span', { dangerouslySetInnerHTML: { __html: I.x } })),
            ]),
            h('div', { className: 'sy-sh-b', key: 'body' }, widget.type === 'subscription'
              ? [
                h('label', { className: 'sy-fld', key: 'title' }, [
                  h('span', { key: 'l' }, '标题'),
                  h('input', { key: 'i', type: 'text', name: 'title', defaultValue: widget.title ?? '', placeholder: widgetTitle(widget, context) }),
                ]),
                h('div', { className: 'sy-fld', key: 'sources' }, [
                  h('span', { key: 'l' }, '来源（可多选）'),
                  h('div', { className: 'sy-chips', key: 'c' }, (context.sources ?? []).map((source) => h('button', {
                    key: source.id,
                    className: 'sy-chipbtn',
                    'aria-pressed': (settings.sources ?? []).includes(source.id),
                    onClick: () => {
                      const current = settings.sources ?? []
                      const next = current.includes(source.id)
                        ? (current.length > 1 ? current.filter((entry) => entry !== source.id) : current)
                        : [...current, source.id]
                      void onRun('widget.update', { id: widget.id, settings: { ...settings, sources: next } })
                    },
                  }, source.label))),
                ]),
                h('div', { className: 'sy-fld', key: 'pres' }, [
                  h('span', { key: 'l' }, '呈现'),
                  h('div', { className: 'sy-seg sm', key: 's' }, ['图文', '榜单', '论文', '产品', '视频'].map((entry) => h('button', {
                    key: entry,
                    'aria-pressed': (settings.pres ?? '图文') === entry,
                    onClick: () => void onRun('widget.update', { id: widget.id, settings: { ...settings, pres: entry } }),
                  }, entry))),
                ]),
                h('div', { className: 'sy-fld', key: 'deck' }, [
                  h('span', { key: 'l' }, '布局'),
                  h('div', { className: 'sy-seg sm', key: 's' }, [
                    h('button', { key: 'l', 'aria-pressed': !settings.deck, onClick: () => void onRun('widget.update', { id: widget.id, settings: { ...settings, deck: false } }) }, '列表'),
                    h('button', { key: 'd', 'aria-pressed': Boolean(settings.deck), onClick: () => void onRun('widget.update', { id: widget.id, settings: { ...settings, deck: true } }) }, '卡片流 · 一次一条'),
                  ]),
                ]),
                h('div', { className: 'sy-fld', key: 'sort' }, [
                  h('span', { key: 'l' }, '排序'),
                  h('div', { className: 'sy-seg sm', key: 's' }, SUB_SORTS.map(([key, label]) => h('button', {
                    key,
                    'aria-pressed': (settings.sort ?? 'new') === key,
                    onClick: () => void onRun('widget.update', { id: widget.id, settings: { ...settings, sort: key } }),
                  }, label))),
                ]),
                h('label', { className: 'sy-fld', key: 'interests' }, [
                  h('span', { key: 'l' }, '关注词（逗号分隔，所有订阅共用）'),
                  h('input', {
                    key: 'i',
                    type: 'text',
                    name: 'interests',
                    defaultValue: (context.interests ?? []).join('，'),
                    onBlur: (event) => void onRun('interests.set', { text: event.target.value }),
                  }),
                  h('span', { className: 'meta', key: 'm', style: { whiteSpace: 'normal' } }, '命中的条目会带上标记；排序选「关注优先」时排在前面。'),
                ]),
              ]
              : h('p', { style: { margin: 0, fontSize: 13, color: 'var(--sy-ink2)', whiteSpace: 'normal' } }, `「${types[widget.type]?.name ?? ''}」目前没有可配置项。尺寸在卡片菜单里改。`)),
            h('footer', { className: 'sy-sh-f', key: 'f' },
              h('button', { className: 'sy-btn sy-btn-ink', 'data-act': 'modal-close' }, '完成')),
          ]))
      }

      return null
    }

    // ---- sidebar icon ------------------------------------------------------

    function SooyoIcon(props) {
      const size = props?.size ?? 18
      const cells = [[3, 3, 8, 8], [13, 3, 8, 5], [13, 10, 8, 11], [3, 13, 8, 8]]
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block', opacity: props?.active ? 1 : 0.72 },
      }, cells.map((box, index) => h('rect', {
        key: index,
        x: box[0], y: box[1], width: box[2], height: box[3], rx: 2,
        fill: 'currentColor',
        opacity: 0.28 + index * 0.16,
      })))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // `id` addresses the matching `main` key: the sidebar owns the button and switches
        // the central panel, so no manual selectPanel call is needed.
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: 'sooyo daily' }, SooyoIcon),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, SooyoPanel),
        )
      },
    }
  },
})
