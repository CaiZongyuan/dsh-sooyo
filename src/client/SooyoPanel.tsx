import * as React from 'react'
import { api, action } from './api/client.ts'
import { useDaily } from './api/hooks.ts'
import { PluginUpdates, PluginUpdateButton } from './updates/PluginUpdates.js'
import { columnsFor, sizeOrder } from './layout/breakpoints.ts'
import { pack, startDrag, startResize } from './layout/bento-packer.ts'
import { BoardTabs } from './shell/BoardTabs.tsx'
import { MenuLayer, type MenuState } from './shell/WidgetFrame.tsx'
import { WidgetGrid } from './shell/WidgetGrid.tsx'
import { ModalLayer, type ModalState } from './shell/WidgetSettings.tsx'
import {
  CaptureModal,
  EntryDetailModal,
  KIND_BADGE_LABELS,
  KIND_FILTER_OPTIONS,
  MediaCollectionCard,
  buildUnifiedEntries,
  type UnifiedCardEntry,
} from './views/Cards.tsx'
import { ContentView } from './views/ContentView.tsx'
import { RetroView } from './views/RetroView.tsx'
import { ScheduleView } from './views/ScheduleView.tsx'
import { MiniStamps, useDayFootprintMap } from './views/Stamps.tsx'
import {
  ASSET,
  BRAND_APP,
  I,
  SvgIcon,
  WEEK,
  greeting,
  projectsOf,
  safeUrl,
} from './widgets/shared.tsx'
import { DECK_SIZE, subItemsOf } from './widgets/subscription/SubscriptionWidget.tsx'
import CSS from './styles/tokens.css'
import type {
  CollectionKind,
  FeedItem,
  GridColumns,
  LayoutEntry,
  WidgetSize,
} from '../shared/domain.ts'
import type { WidgetRenderContext } from '../shared/widget.ts'

const { useState, useEffect, useRef, useCallback, useMemo } = React

export type AppView = 'home' | 'content' | 'schedule' | 'retro'

interface CommandEntry {
  group?: string
  k?: string
  label?: string
  keep?: boolean
  href?: string
  run?: () => void
}

function InlineHeadlineIcon({ name, rotated, text }: { name: string; rotated: boolean; text: string }) {
  const [hidden, setHidden] = useState(false)
  return (
    <span className="sy-nw">
      {!hidden ? (
        <img
          className={`sy-hi${rotated ? ' r' : ''}`}
          src={`${ASSET}/${name}.webp`}
          alt=""
          onError={() => setHidden(true)}
        />
      ) : null}
      <b>{text}</b>
    </span>
  )
}

export function SooyoPanel() {
  const state = useDaily()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState<GridColumns>(12)
  const [appView, setAppView] = useState<AppView>('home')
  const [homeMode, setHomeMode] = useState<'bento' | 'wall'>('bento')
  const [homeKindFilter, setHomeKindFilter] = useState<string>('all')
  const [heroInput, setHeroInput] = useState('')
  const [heroCaptureMode, setHeroCaptureMode] = useState<'auto' | 'note' | 'collection' | 'task'>('auto')
  const [captureModalTab, setCaptureModalTab] = useState<'note' | 'collection' | 'task' | 'batch' | null>(null)
  const [activeEntryDetail, setActiveEntryDetail] = useState<UnifiedCardEntry | null>(null)
  const [scheduleFocusDay, setScheduleFocusDay] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [deck, setDeck] = useState<{ index: Record<string, number>; flipped: Record<string, boolean> }>({
    index: {},
    flipped: {},
  })
  const [query, setQuery] = useState('')
  const [cmdOpen, setCmdOpen] = useState(false)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const daily = state.daily
  const widgets = daily?.widgets ?? {}
  const types = daily?.types ?? {}
  const boards = daily?.boards ?? []
  const activeBoard = daily?.active ?? boards[0]?.id ?? null
  const layout: readonly LayoutEntry[] = activeBoard
    ? (daily?.layouts?.[activeBoard]?.[cols] ?? daily?.layouts?.[activeBoard]?.[12] ?? [])
    : []

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const stored = (() => {
      try {
        return window.localStorage.getItem('sooyo:theme') as 'light' | 'dark' | null
      } catch {
        return null
      }
    })()
    const sync = () => setTheme(stored ?? (media.matches ? 'dark' : 'light'))
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0
    if (typeof window !== 'undefined') window.scrollTo(0, 0)
  }, [appView])

  useEffect(() => {
    const element = gridRef.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const apply = () => setCols(columnsFor(gridRef.current?.clientWidth || element.clientWidth || 1200))
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => observer.disconnect()
  }, [daily, appView, homeMode])

  const byId = useMemo(() => {
    const map = new Map<string, FeedItem>()
    for (const [id, snap] of Object.entries(daily?.readLaterEntries ?? {})) {
      if (snap && typeof snap === 'object') map.set(id, snap)
    }
    for (const item of state.items) map.set(item.id, item)
    return map
  }, [state.items, daily?.readLaterEntries])

  const saved = useMemo(() => new Set<string>(daily?.readLater ?? []), [daily?.readLater])

  const dayMap = useDayFootprintMap(
    daily?.notes ?? [],
    daily?.tasks ?? [],
    daily?.readLaterEntries ?? {},
    daily?.retros ?? {},
  )

  const unifiedEntries = useMemo(
    () =>
      buildUnifiedEntries(
        daily?.notes ?? [],
        daily?.readLaterEntries ?? {},
        daily?.bookmarks ?? [],
        state.items,
        false,
      ),
    [daily?.notes, daily?.readLaterEntries, daily?.bookmarks, state.items],
  )

  const filteredHomeEntries = useMemo(() => {
    return unifiedEntries.filter((entry) => {
      if (homeKindFilter !== 'all' && entry.kind !== homeKindFilter) return false
      return entry.status !== 'archived'
    })
  }, [unifiedEntries, homeKindFilter])

  const relatedHeroEntries = useMemo(() => {
    const q = heroInput.trim().toLowerCase()
    if (q.length < 2) return []
    return unifiedEntries
      .filter(
        (entry) =>
          entry.title.toLowerCase().includes(q) ||
          entry.body.toLowerCase().includes(q) ||
          entry.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 3)
  }, [heroInput, unifiedEntries])

  const layoutSizes = useMemo(() => {
    const map: Record<string, WidgetSize> = {}
    for (const entry of layout) map[entry.id] = entry.size
    return map
  }, [layout])

  const context: WidgetRenderContext = useMemo(
    () => ({
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
      sizesOf: (type: string) => sizeOrder.filter((size) => Boolean(types[type]?.sizes?.[size])),
    }),
    [state.items, byId, saved, daily, types, cols, layoutSizes, deck],
  )

  const positions = useMemo(() => pack(types, widgets, layout, cols), [types, widgets, layout, cols])

  const decide = useCallback(
    async (proposalId: string | undefined, decision: 'approve' | 'reject' | 'rollback') => {
      if (!proposalId) return
      try {
        const proposal = (daily?.agentInbox ?? []).find((entry) => entry.id === proposalId)
        const precondition = Number.isSafeInteger(proposal?.revision)
          ? { entity: 'proposal', id: proposal!.id, revision: proposal!.revision! }
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
          const failed = Array.isArray(applied)
            ? applied.filter((entry: any) => !entry.ok)
            : (applied?.failed ?? [])
          state.setToast({
            text:
              failed.length > 0 || applied?.ok === false
                ? `已批准，但执行失败：${String(failed[0]?.error ?? applied?.error ?? '未知原因')}`
                : '已批准并执行',
          })
        } else if (decision === 'rollback') {
          state.setToast({ text: '已撤销这条提议的改动' })
        } else {
          state.setToast({ text: '已拒绝这条建议' })
        }
      } catch (failure: unknown) {
        state.setToast({ text: String((failure as Error)?.message ?? failure) })
      }
      await state.reload()
    },
    [state, daily?.agentInbox],
  )

  const deckItemsOf = useCallback(
    (widget: any) => {
      const list = subItemsOf(widget, state.items, daily?.interests ?? [])
      return list.slice(0, DECK_SIZE)
    },
    [state.items, daily?.interests],
  )

  const stepDeck = useCallback(
    (widgetId: string | undefined, delta: number) => {
      if (!widgetId) return
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
    },
    [widgets, deckItemsOf],
  )

  const currentDeckItem = useCallback(
    (widgetId: string | undefined): FeedItem | null => {
      if (!widgetId) return null
      const widget = widgets[widgetId]
      if (!widget) return null
      const list = deckItemsOf(widget)
      return list[Math.min(deck.index[widgetId] ?? 0, Math.max(0, list.length - 1))] ?? null
    },
    [widgets, deckItemsOf, deck.index],
  )

  const addWidget = useCallback(
    (type: string, size: WidgetSize, settings: Record<string, unknown>, title?: string) => {
      void state.run(
        'widget.add',
        { type, size, settings, title, boardId: activeBoard },
        { toast: `已添加「${types[type]?.name ?? type}」` },
      )
    },
    [state, activeBoard, types],
  )

  const setSize = useCallback(
    (widgetId: string | undefined, size: string | undefined) => {
      if (!widgetId || !size) return
      void state.run('widget.resize', { id: widgetId, size, cols, boardId: activeBoard })
    },
    [state, cols, activeBoard],
  )

  const removeWidget = useCallback(
    (widgetId: string | undefined) => {
      if (!widgetId) return
      void state.run('widget.remove', { id: widgetId }, { toast: '已移除这个 Widget' })
    },
    [state],
  )

  const duplicateWidget = useCallback(
    (widgetId: string | undefined) => {
      if (!widgetId) return
      void state.run('widget.duplicate', { id: widgetId, boardId: activeBoard }, { toast: '已复制' })
    },
    [state, activeBoard],
  )

  const toggleLater = useCallback(
    (itemId: string | undefined, forceOff?: boolean) => {
      if (!itemId) return
      const on = saved.has(itemId)
      void state.run(
        'readlater.set',
        { itemId, on: forceOff ? false : !on },
        { toast: on || forceOff ? '已移出稍后读' : '已存到稍后读' },
      )
    },
    [state, saved],
  )

  const itemToTask = useCallback(
    (itemId: string | undefined) => {
      if (!itemId) return
      const item = byId.get(itemId)
      if (!item) return
      void state.run(
        'item.toTask',
        {
          title: item.title.length > 60 ? `${item.title.slice(0, 59)}…` : item.title,
          origin: { source: item.sourceLabel ?? '', url: item.url ?? '' },
        },
        { toast: `已转为任务，放进收件箱 · 出处：${item.sourceLabel ?? ''}` },
      )
    },
    [state, byId],
  )

  const itemToNote = useCallback(
    (itemId: string | undefined) => {
      if (!itemId) return
      const item = byId.get(itemId)
      if (!item) return
      void state.run(
        'item.toNote',
        {
          title: item.title,
          origin: { source: item.sourceLabel ?? '', url: item.url ?? '' },
        },
        { toast: `已转为 Note · 出处：${item.sourceLabel ?? ''}` },
      )
    },
    [state, byId],
  )

  const onRootClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) return
      if (
        menu &&
        !target.closest('.sy-pop') &&
        !target.closest('[data-act="w-menu"]') &&
        !target.closest('[data-act="board-new"]')
      ) {
        setMenu(null)
      }

      const opened = target.closest<HTMLElement>('a[data-open]')
      if (opened?.dataset.open) {
        void action('item.state', { ids: [opened.dataset.open], seen: true }).catch(() => {})
      }

      const element = target.closest<HTMLElement>('[data-act]')
      if (!element) return
      const act = element.dataset.act
      const ds = element.dataset

      switch (act) {
        case 'app-view':
          if (ds.view === 'home' || ds.view === 'content' || ds.view === 'schedule' || ds.view === 'retro') {
            setAppView(ds.view)
            setEditing(false)
          }
          break
        case 'capture-modal-open':
          setCaptureModalTab(
            (ds.tab as 'note' | 'collection' | 'task' | 'batch' | undefined) ?? 'note',
          )
          break
        case 'board':
          setAppView('home')
          void state.run('board.active', { id: ds.board })
          break
        case 'board-new': {
          const rect = element.getBoundingClientRect()
          setMenu({ kind: 'board-new', rect })
          break
        }
        case 'edit-toggle':
          setEditing((value) => !value)
          break
        case 'gallery-open':
          setModal({ kind: 'gallery', type: 'subscription', size: 'M', sources: ['aihot'], pres: null })
          break
        case 'w-menu': {
          const rect = element.getBoundingClientRect()
          setMenu({ kind: 'w-menu', id: ds.w, rect })
          break
        }
        case 'w-size':
          setMenu(null)
          setSize(ds.w, ds.size)
          break
        case 'w-dup':
          setMenu(null)
          duplicateWidget(ds.w)
          break
        case 'w-remove':
          setMenu(null)
          removeWidget(ds.w)
          break
        case 'w-settings':
          setMenu(null)
          if (ds.w) setModal({ kind: 'settings', id: ds.w })
          break
        case 'w-refresh':
          setMenu(null)
          void state.refreshSources()
          break
        case 'task-toggle':
          void state.run('task.update', {
            id: ds.task,
            done: !daily?.tasks?.find((task) => task.id === ds.task)?.done,
          })
          break
        case 'task-today':
          void state.run('task.update', { id: ds.task, list: 'today' }, { toast: '已移到今天' })
          break
        case 'task-remove':
          void state.run('task.remove', { id: ds.task }, { toast: '已删除' })
          break
        case 'note-remove':
          void state.run('note.remove', { id: ds.note }, { toast: '已删除' })
          break
        case 'habit-tick':
          void state.run('habit.tick', { id: ds.habit })
          break
        case 'item-later':
          toggleLater(ds.item, ds.off === '1')
          break
        case 'item-task':
          itemToTask(ds.item)
          break
        case 'rl-note':
          itemToNote(ds.item)
          break
        case 'sub-cat': {
          const widget = ds.w ? widgets[ds.w] : undefined
          if (widget && ds.w) {
            void state.run('widget.update', { id: ds.w, settings: { ...widget.settings, cat: ds.v || null } })
          }
          break
        }
        case 'dk-next':
          stepDeck(ds.w, 1)
          break
        case 'dk-prev':
          stepDeck(ds.w, -1)
          break
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
        case 'dk-flip':
          if (ds.w) {
            const wId = ds.w
            setDeck((current) => ({
              ...current,
              flipped: { ...current.flipped, [wId]: !current.flipped[wId] },
            }))
          }
          break
        case 'focus-toggle':
          void state.run('focus.set', { action: daily?.focus?.running ? 'pause' : 'start' })
          break
        case 'focus-reset':
          void state.run('focus.set', { action: 'reset' })
          break
        case 'focus-next-task': {
          const open = (daily?.tasks ?? []).filter((task) => task.list === 'today' && !task.done)
          const index = open.findIndex((task) => task.id === daily?.focus?.task)
          void state.run('focus.set', {
            action: 'task',
            task: open[(index + 1) % Math.max(1, open.length)]?.id ?? null,
          })
          break
        }
        case 'modal-close':
          setModal(null)
          setCaptureModalTab(null)
          setActiveEntryDetail(null)
          break
        case 'scrim':
          if (target === element) {
            setModal(null)
            setCaptureModalTab(null)
            setActiveEntryDetail(null)
          }
          break
        case 'proposal-approve':
          void decide(ds.proposal, 'approve')
          break
        case 'proposal-reject':
          void decide(ds.proposal, 'reject')
          break
        case 'proposal-rollback':
          void decide(ds.proposal, 'rollback')
          break
        default:
          break
      }
    },
    [
      menu,
      state,
      widgets,
      daily,
      toggleLater,
      itemToTask,
      itemToNote,
      stepDeck,
      currentDeckItem,
      setSize,
      duplicateWidget,
      removeWidget,
      decide,
    ],
  )

  const onRootSubmit = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const form = event.target instanceof Element ? event.target.closest<HTMLFormElement>('[data-form]') : null
      if (!form) return
      event.preventDefault()
      if (form.dataset.form === 'hero-capture') {
        const value = heroInput.trim()
        if (!value) return
        const isUrl = /^https?:\/\/\S+$/i.test(value)
        if (heroCaptureMode === 'collection' || (heroCaptureMode === 'auto' && isUrl)) {
          void state
            .run(
              'collection.save',
              isUrl ? { url: value, title: value } : { title: value },
              { toast: '已存入偏好收藏库' },
            )
            .then(() => setHeroInput(''))
          return
        }
        if (heroCaptureMode === 'note') {
          void state
            .run('capture', { text: value, mode: 'note' }, { toast: '已记入速记备忘' })
            .then(() => setHeroInput(''))
          return
        }
        if (heroCaptureMode === 'task') {
          void state
            .run('capture', { text: value, mode: 'task' }, { toast: '已加入待排期收件箱' })
            .then(() => setHeroInput(''))
          return
        }
        // auto mode: default to quick memo/inspiration unless prefixed with todo: / task:
        if (/^(todo|task)[:：\s]/i.test(value)) {
          const clean = value.replace(/^(todo|task)[:：\s]+/i, '').trim()
          void state
            .run('capture', { text: clean || value, mode: 'task' }, { toast: '已加入待排期收件箱' })
            .then(() => setHeroInput(''))
        } else {
          void state
            .run('capture', { text: value, mode: 'note' }, { toast: '已记入速记与灵感墙' })
            .then(() => setHeroInput(''))
        }
        return
      }
      const input = form.querySelector('input')
      const value = (input?.value ?? '').trim()
      if (!value) return
      if (form.dataset.form === 'capture') {
        void state.run('capture', { text: value }).then(() => {
          if (input) input.value = ''
        })
      }
      if (form.dataset.form === 'task-add') {
        void state.run('task.add', { title: value, list: 'today' }).then(() => {
          if (input) input.value = ''
        })
      }
      if (form.dataset.form === 'board-new') {
        void state.run('board.create', { name: value }).then(() => setMenu(null))
      }
    },
    [state, heroInput, heroCaptureMode],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        rootRef.current?.querySelector<HTMLInputElement>('input[name="cmd"]')?.focus()
        return
      }
      if (event.key === 'Escape') {
        if (menu) setMenu(null)
        else if (captureModalTab) setCaptureModalTab(null)
        else if (activeEntryDetail) setActiveEntryDetail(null)
        else if (modal) setModal(null)
        else if (cmdOpen) setCmdOpen(false)
        else if (editing) setEditing(false)
        return
      }
      if (inField) return
      const deckElement =
        document.activeElement?.closest?.<HTMLElement>('[data-deck]') ??
        rootRef.current?.querySelector<HTMLElement>('[data-deck]:focus-within')
      if (!deckElement) return
      const widgetId = deckElement.dataset.deck
      if (!widgetId) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        stepDeck(widgetId, 1)
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        stepDeck(widgetId, -1)
      }
      if (event.key.toLowerCase() === 'l') {
        const item = currentDeckItem(widgetId)
        if (item) toggleLater(item.id)
      }
      if (event.key === ' ' || event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setDeck((current) => ({
          ...current,
          flipped: { ...current.flipped, [widgetId]: !current.flipped[widgetId] },
        }))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menu, captureModalTab, activeEntryDetail, modal, cmdOpen, editing, stepDeck, currentDeckItem, toggleLater])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || event.button !== 0) return

      if (editing) {
        const card = target.closest<HTMLElement>('.sy-w')
        if (!card || target.closest('.sy-e-bar')) return
        event.preventDefault()
        const widgetId = card.dataset.id
        if (!widgetId) return
        if (target.closest('[data-rz]')) {
          startResize(event, card, widgetId, cols, types, widgets, layout, (id, size) => setSize(id, size))
          return
        }
        startDrag(event, card, widgetId, layout, activeBoard, (order) => {
          void state.run('layout.set', { boardId: activeBoard, cols, order })
        })
        return
      }

      const card = target.closest<HTMLElement>('.sy-dk-card[data-pos="cur"]')
      if (!card || target.closest('button, a, .sy-ctl')) return
      const deckElement = card.closest<HTMLElement>('[data-deck]')
      if (!deckElement) return
      const vertical = deckElement.classList.contains('v')
      const widgetId = deckElement.dataset.deck
      if (!widgetId) return
      const startX = event.clientX
      const startY = event.clientY
      let delta = 0
      let moved = false
      const move = (moveEvent: PointerEvent) => {
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
            setDeck((current) => ({
              ...current,
              flipped: { ...current.flipped, [widgetId]: !current.flipped[widgetId] },
            }))
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
    },
    [editing, cols, types, widgets, layout, activeBoard, state, setSize, stepDeck, currentDeckItem, toggleLater],
  )

  const commands = useMemo(() => {
    const text = query.trim()
    const out: CommandEntry[] = []
    const head = (text.match(/^(\S+)\s*(.*)$/)?.[1] ?? '').toLowerCase()
    const rest = text.match(/^(\S+)\s*(.*)$/)?.[2] ?? ''
    if (!text) {
      out.push({ group: '命令' })
      out.push({
        k: 'todo',
        label: '新建任务',
        run: () => {
          setQuery('todo ')
        },
        keep: true,
      })
      out.push({
        k: 'note',
        label: '记一条 Note',
        run: () => {
          setQuery('note ')
        },
        keep: true,
      })
      out.push({
        k: 'save',
        label: '录入偏好收藏 (GitHub / X / 视频 / 网站)',
        run: () => {
          setCaptureModalTab('collection')
          setCmdOpen(false)
        },
      })
      out.push({
        k: 'add',
        label: '添加 Widget',
        run: () => setModal({ kind: 'gallery', type: 'subscription', size: 'M', sources: ['aihot'], pres: null }),
      })
      out.push({ group: '视图导航' })
      out.push({
        k: 'view',
        label: '首页 · 灵感与工作台',
        run: () => {
          setAppView('home')
          setCmdOpen(false)
        },
      })
      out.push({
        k: 'view',
        label: '内容 · 收藏与速记库',
        run: () => {
          setAppView('content')
          setCmdOpen(false)
        },
      })
      out.push({
        k: 'view',
        label: '排期 · 待办与日历',
        run: () => {
          setAppView('schedule')
          setCmdOpen(false)
        },
      })
      out.push({
        k: 'view',
        label: '复盘 · 节奏与个人总结',
        run: () => {
          setAppView('retro')
          setCmdOpen(false)
        },
      })
      out.push({ group: '前往 Board' })
      for (const board of boards) {
        out.push({
          k: 'go',
          label: board.name,
          run: () => {
            setAppView('home')
            void state.run('board.active', { id: board.id })
            setCmdOpen(false)
          },
        })
      }
      return out
    }
    if (['todo', 't', 'task'].includes(head)) {
      out.push({ group: '新建' })
      if (rest) {
        out.push({
          k: '↵',
          label: `新建任务「${rest}」→ 收件箱`,
          run: () => {
            void state.run('capture', { text: rest }, { toast: '已存进收件箱' })
            setQuery('')
            setCmdOpen(false)
          },
        })
      } else {
        out.push({ k: '…', label: '继续输入任务内容', keep: true, run: () => {} })
      }
      return out
    }
    if (head === 'note') {
      out.push({ group: '新建' })
      if (rest) {
        out.push({
          k: '↵',
          label: `存为 Note「${rest}」`,
          run: () => {
            void state.run('capture', { text: `#note ${rest}` }, { toast: '已存为 Note' })
            setQuery('')
            setCmdOpen(false)
          },
        })
      } else {
        out.push({ k: '…', label: '继续输入 Note 内容', keep: true, run: () => {} })
      }
      return out
    }
    if (head === 'add' || head === 'widget') {
      out.push({ group: 'Widget' })
      for (const [type, definition] of Object.entries(types)) {
        if (definition.soon) continue
        if (rest && !definition.name.includes(rest)) continue
        out.push({
          k: definition.soon ? 'soon' : 'P0',
          label: `添加「${definition.name}」`,
          run: () => setModal({ kind: 'gallery', type, size: 'M', sources: ['aihot'], pres: null }),
        })
      }
      return out
    }
    const lowered = text.toLowerCase()
    const matchedBoards = boards.filter((board) => board.name.includes(text))
    const matchedTasks = (daily?.tasks ?? [])
      .filter((task) => task.title.toLowerCase().includes(lowered))
      .slice(0, 4)
    const matchedItems = state.items
      .filter((item) => String(item.title).toLowerCase().includes(lowered))
      .slice(0, 5)
    if (matchedBoards.length) {
      out.push({ group: 'Board' })
      for (const board of matchedBoards) {
        out.push({
          k: 'go',
          label: board.name,
          run: () => {
            setAppView('home')
            void state.run('board.active', { id: board.id })
            setCmdOpen(false)
          },
        })
      }
    }
    if (matchedTasks.length) {
      out.push({ group: '任务' })
      for (const task of matchedTasks) {
        out.push({
          k: task.done ? '✓' : '·',
          label: task.title,
          run: () => {
            void state.run('task.update', { id: task.id, done: !task.done })
            setCmdOpen(false)
          },
        })
      }
    }
    if (matchedItems.length) {
      out.push({ group: '订阅内容' })
      for (const item of matchedItems) {
        out.push({ k: item.sourceLabel ?? '', label: item.title, href: safeUrl(item.url) })
      }
    }
    out.push({ group: '新建' })
    out.push({
      k: 'todo',
      label: `新建任务「${text}」`,
      run: () => {
        void state.run('capture', { text }, { toast: '已存进收件箱' })
        setQuery('')
        setCmdOpen(false)
      },
    })
    return out
  }, [query, boards, daily?.tasks, state.items, types, state])

  const screenshotTheme = theme === 'dark' ? 'dark' : 'light'
  const board = boards.find((entry) => entry.id === activeBoard) ?? null
  const openTasks = (daily?.tasks ?? []).filter((task) => task.list === 'today' && !task.done).length
  const freshItems = state.items.filter(
    (item) =>
      item.itemKind !== 'rank' && Date.now() - Date.parse(item.publishedAt ?? '') < 24 * 3600e3,
  ).length
  const erroring = (daily?.sources ?? []).filter((source) => source.lastError).length
  const readLaterCount = daily?.readLater?.length ?? 0

  const renderHeadline = () => {
    if (!board) return <>{greeting()}。</>
    if (board.id === 'home') {
      return (
        <>
          {greeting()}。今天还有 <InlineHeadlineIcon name="task" rotated={false} text={`${openTasks} 件事`} />，
          <InlineHeadlineIcon name="subscription" rotated={true} text={`${freshItems} 条`} />
          新内容。
        </>
      )
    }
    if (board.id === 'work') {
      return (
        <>
          工作。<InlineHeadlineIcon name="task" rotated={false} text={`${openTasks} 件任务`} />
          待办，
          <InlineHeadlineIcon
            name="project"
            rotated={true}
            text={`${projectsOf(daily?.tasks ?? []).length} 个项目`}
          />
          在推进。
        </>
      )
    }
    if (board.id === 'life') {
      return (
        <>
          生活。<InlineHeadlineIcon name="habit" rotated={false} text={`${(daily?.habits ?? []).length} 个习惯`} />
          在坚持，
          <InlineHeadlineIcon name="bookmarks" rotated={true} text={`${(daily?.bookmarks ?? []).length} 个书签`} />
          常去。
        </>
      )
    }
    if (board.id === 'read') {
      return (
        <>
          阅读。<InlineHeadlineIcon name="subscription" rotated={false} text={`${freshItems} 条`} />
          新内容，<InlineHeadlineIcon name="readlater" rotated={true} text={`${readLaterCount} 篇`} />
          稍后读。
        </>
      )
    }
    return (
      <>
        {board.name}。这个 Board 上有 <b>{layout.length} 个 Widget</b>。
      </>
    )
  }

  return (
    <div
      className="sy-root"
      data-theme={screenshotTheme}
      ref={rootRef}
      onClick={onRootClick}
      onSubmit={onRootSubmit}
      onPointerDown={onPointerDown}
    >
      <style>{CSS}</style>
      <div className="sy-grain" aria-hidden="true" />
      <div className="sy-page">
        <div className={`sy-frame${editing ? ' sy-editing' : ''}`} data-cols={cols}>
          <header className="sy-topbar">
            <div className="sy-brand">
              <svg
                viewBox="0 0 320 320"
                width={26}
                height={26}
                aria-hidden={true}
                dangerouslySetInnerHTML={{ __html: BRAND_APP }}
              />
              sooyo
              <span>daily</span>
            </div>

            <nav className="sy-seg sy-app-nav" role="tablist" aria-label="主视图导航">
              <button
                type="button"
                role="tab"
                aria-selected={appView === 'home'}
                data-act="app-view"
                data-view="home"
              >
                首页
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appView === 'content'}
                data-act="app-view"
                data-view="content"
              >
                内容
                {unifiedEntries.length > 0 ? <small>{unifiedEntries.length}</small> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appView === 'schedule'}
                data-act="app-view"
                data-view="schedule"
              >
                排期
                {openTasks > 0 ? <small>{openTasks}</small> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appView === 'retro'}
                data-act="app-view"
                data-view="retro"
              >
                复盘
              </button>
            </nav>

            <div className="sy-cmd">
              <div className="sy-cmd-box">
                <SvgIcon svg={I.search} />
                <input
                  name="cmd"
                  value={query}
                  placeholder="搜索，或输入 todo · note · save · add"
                  autoComplete="off"
                  aria-label="搜索或输入命令"
                  onFocus={() => setCmdOpen(true)}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setCmdOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      const first = commands.find((entry) => typeof entry.run === 'function')
                      event.preventDefault()
                      first?.run?.()
                    }
                  }}
                />
                <kbd>⌘K</kbd>
              </div>
              {cmdOpen && commands.length > 0 ? (
                <div className="sy-cmd-pop" role="listbox">
                  {commands.map((entry, index) =>
                    entry.group ? (
                      <div key={`g${index}`} className="sy-cmd-group">
                        {entry.group}
                      </div>
                    ) : entry.href ? (
                      <a
                        key={`i${index}`}
                        className="sy-cmd-item"
                        role="option"
                        href={entry.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (!entry.keep) setCmdOpen(false)
                          entry.run?.()
                        }}
                      >
                        <span className="k">{entry.k ?? ''}</span>
                        <span className="ci-t c1">{entry.label}</span>
                      </a>
                    ) : (
                      <button
                        key={`i${index}`}
                        className="sy-cmd-item"
                        role="option"
                        onClick={() => {
                          if (!entry.keep) setCmdOpen(false)
                          entry.run?.()
                        }}
                      >
                        <span className="k">{entry.k ?? ''}</span>
                        <span className="ci-t c1">{entry.label}</span>
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </div>

            <div className="sy-actions">
              <PluginUpdateButton onClick={() => setUpdatesOpen(true)} />
              <button
                type="button"
                className="sy-btn sy-btn-capture"
                data-act="capture-modal-open"
                data-tab="collection"
              >
                <SvgIcon svg={I.plus} />
                <span className="lbl">录入收藏</span>
              </button>
              {appView === 'home' ? (
                <>
                  <button
                    className="sy-switch"
                    role="switch"
                    aria-checked={editing}
                    data-act="edit-toggle"
                  >
                    <span className="lbl">编辑</span>
                    <span className="sy-sw" aria-hidden={true} />
                  </button>
                  <button className="sy-btn sy-btn-add" data-act="gallery-open">
                    <SvgIcon svg={I.plus} />
                    <span className="lbl">添加 Widget</span>
                  </button>
                </>
              ) : null}
              <button
                className="sy-icon-btn"
                aria-label="切换浅色或深色"
                onClick={() => {
                  const next = screenshotTheme === 'dark' ? 'light' : 'dark'
                  setTheme(next)
                  try {
                    window.localStorage.setItem('sooyo:theme', next)
                  } catch {
                    /* storage unavailable */
                  }
                }}
              >
                <SvgIcon svg={screenshotTheme === 'dark' ? I.sun : I.moon} />
              </button>
              <button
                className="sy-icon-btn"
                aria-label="刷新信息源"
                title="刷新信息源"
                onClick={() => void state.refreshSources()}
              >
                <SvgIcon svg={I.reset} />
              </button>
            </div>
          </header>

          {appView === 'home' ? (
            <>
              <section className="sy-hero">
                <div className="sy-hero-main">
                  <div className="sy-hero-top-row">
                    <span className="sy-tag">
                      {`${new Date().getMonth() + 1}月${new Date().getDate()}日 · 星期${WEEK[new Date().getDay()]}`}
                    </span>
                    <div className="sy-status">
                      <i className={erroring > 0 ? 'warn' : ''} />
                      {`${(daily?.sources ?? []).length - erroring} 个来源正常 · ${state.items.length} 条内容`}
                    </div>
                  </div>
                  <h1 className="sy-headline">{renderHeadline()}</h1>

                  <form className="sy-hero-capture" data-form="hero-capture">
                    <div className="sy-hero-capture-modes">
                      {(
                        [
                          { id: 'auto', label: '智能识别' },
                          { id: 'note', label: '✎ 速记/闪念' },
                          { id: 'collection', label: '★ 偏好收藏' },
                          { id: 'task', label: '✓ 待办事项' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="sy-hero-mode-pill"
                          aria-pressed={heroCaptureMode === m.id}
                          onClick={() => setHeroCaptureMode(m.id)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="sy-hero-capture-row">
                      <input
                        name="hero-q"
                        value={heroInput}
                        onChange={(event) => setHeroInput(event.target.value)}
                        placeholder={
                          heroCaptureMode === 'collection'
                            ? '粘贴 GitHub / X / 网站 / 视频 / 音乐链接，回车保存元信息…'
                            : heroCaptureMode === 'task'
                              ? '输入待办事项，回车进入排期收件箱…'
                              : '随手记一条灵感备忘、贴入收藏链接，或输入 todo: 记待办…'
                        }
                        autoComplete="off"
                      />
                      <button type="submit" className="sy-btn sy-btn-ink">
                        记下来 ↵
                      </button>
                      <button
                        type="button"
                        className="sy-btn"
                        data-act="capture-modal-open"
                        data-tab="collection"
                        title="打开完整录入面板（支持缩略图、飞书外链、JSON/CSV 批量导入）"
                      >
                        详细录入
                      </button>
                    </div>
                    {relatedHeroEntries.length > 0 ? (
                      <div className="sy-hero-related">
                        <span className="meta">相似已收录：</span>
                        {relatedHeroEntries.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="sy-hero-related-chip"
                            onClick={() => setActiveEntryDetail(item)}
                          >
                            <span>{KIND_BADGE_LABELS[item.kind] ?? item.kind}</span>
                            <span className="c1">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </form>
                </div>

                <div className="sy-hero-aside">
                  <MiniStamps
                    dayMap={dayMap}
                    onCaptureToday={() => setCaptureModalTab('note')}
                    onOpenSchedule={(date) => {
                      if (date) setScheduleFocusDay(date)
                      setAppView('schedule')
                    }}
                  />
                </div>
              </section>

              <div className="sy-home-dock" role="toolbar" aria-label="看板与灵感墙切换">
                <div className="sy-home-dock-left">
                  <BoardTabs boards={boards} activeBoard={activeBoard} />
                  <div className="sy-seg sm">
                    <button
                      type="button"
                      aria-selected={homeMode === 'bento'}
                      onClick={() => setHomeMode('bento')}
                    >
                      工作台看板
                    </button>
                    <button
                      type="button"
                      aria-selected={homeMode === 'wall'}
                      onClick={() => setHomeMode('wall')}
                    >
                      {`灵感与收藏墙 (${filteredHomeEntries.length})`}
                    </button>
                  </div>
                </div>
                <div className="sy-home-dock-filters">
                  {KIND_FILTER_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      className="sy-chipbtn"
                      aria-pressed={homeKindFilter === f.value}
                      onClick={() => {
                        setHomeKindFilter(f.value)
                        if (f.value !== 'all') setHomeMode('wall')
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {homeMode === 'wall' ? (
                <section className="sy-home-wall-section">
                  {filteredHomeEntries.length === 0 ? (
                    <div className="sy-view-empty">
                      <p>当前分类还没有速记或偏好收藏。</p>
                      <button
                        type="button"
                        className="sy-btn sy-btn-ink"
                        data-act="capture-modal-open"
                        data-tab="collection"
                      >
                        + 录入第一条收藏或闪念
                      </button>
                    </div>
                  ) : (
                    <div className="sy-wall-grid">
                      {filteredHomeEntries.map((entry) => (
                        <MediaCollectionCard
                          key={entry.id}
                          entry={entry}
                          onOpen={setActiveEntryDetail}
                          onQuickTask={(item) =>
                            void state.run(
                              'item.toTask',
                              {
                                title: item.title.slice(0, 60),
                                origin: { source: KIND_BADGE_LABELS[item.kind] ?? '收藏', url: item.url },
                              },
                              { toast: '已转为待办任务' },
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {editing ? (
                <div className="sy-editbar">
                  <span className="grow">
                    {`正在编辑「${board?.name ?? ''}」的布局（${cols} 列）。拖动卡片排序，拖右下角改尺寸；不同宽度各自保存。`}
                  </span>
                  <button className="sy-btn" data-act="gallery-open">
                    添加
                  </button>
                  <button className="sy-btn sy-btn-ink" data-act="edit-toggle">
                    完成
                  </button>
                </div>
              ) : null}

              <WidgetGrid
                gridRef={gridRef}
                cols={cols}
                layout={layout}
                widgets={widgets}
                positions={positions}
                context={context}
              />

              <div className="meta" style={{ marginTop: 14, whiteSpace: 'normal', lineHeight: '19px' }}>
                数据来源：AIHOT（个人非商业使用）、HuggingFace、Product Hunt、YouTube。抓取到的内容一律视为资料，不作为指令执行。
              </div>
            </>
          ) : null}

          {appView === 'content' ? (
            <ContentView
              notes={daily?.notes ?? []}
              readLaterEntries={daily?.readLaterEntries ?? {}}
              bookmarks={daily?.bookmarks ?? []}
              feedItems={state.items}
              onRun={state.run}
              onOpenCapture={(tab) => setCaptureModalTab(tab)}
              onOpenEntry={(entry) => setActiveEntryDetail(entry)}
            />
          ) : null}

          {appView === 'schedule' ? (
            <ScheduleView
              tasks={daily?.tasks ?? []}
              dayMap={dayMap}
              initialFocusDay={scheduleFocusDay}
              onCaptureToday={() => setCaptureModalTab('task')}
              onRun={state.run}
            />
          ) : null}

          {appView === 'retro' ? (
            <RetroView
              daily={daily}
              items={state.items}
              onRun={state.run}
              onNavigate={(v) => setAppView(v)}
              onOpenEntry={(entry) => setActiveEntryDetail(entry)}
            />
          ) : null}
        </div>
      </div>

      <PluginUpdates rootRef={rootRef} open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
      {menu ? (
        <MenuLayer
          menu={menu}
          widgets={widgets}
          types={types}
          context={context}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {modal ? (
        <ModalLayer
          modal={modal}
          widgets={widgets}
          types={types}
          context={context}
          board={board}
          onClose={() => setModal(null)}
          onAdd={addWidget}
          onRun={state.run}
        />
      ) : null}
      {captureModalTab ? (
        <CaptureModal
          initialTab={captureModalTab}
          onClose={() => setCaptureModalTab(null)}
          onRun={state.run}
        />
      ) : null}
      {activeEntryDetail ? (
        <EntryDetailModal
          entry={activeEntryDetail}
          onClose={() => setActiveEntryDetail(null)}
          onRun={state.run}
        />
      ) : null}
      {state.toast ? (
        <div className="sy-toast" role="status">
          <span>{state.toast.text}</span>
        </div>
      ) : null}
    </div>
  )
}
