import * as React from 'react'
import { api, action, inferPrecondition } from './client.js'
import type { DailySnapshot, FeedItem } from '../../shared/domain.js'
import type { CommandPrecondition } from '../../shared/commands.js'

const { useState, useEffect, useCallback } = React

export interface ToastMessage {
  text: string
}

export interface RunActionOptions {
  toast?: string
  precondition?: CommandPrecondition
}

export function useDaily() {
  const [daily, setDaily] = useState<DailySnapshot | null>(null)
  const [items, setItems] = useState<FeedItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'refreshing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const load = useCallback(async () => {
    try {
      const [snapshot, listing] = await Promise.all([
        api<DailySnapshot>('/daily'),
        api<{ items?: FeedItem[] }>('/items?limit=400&kind=all'),
      ])
      setDaily(snapshot)
      setItems(listing?.items ?? [])
      setError(null)
      setStatus('ready')
      return { snapshot, items: listing?.items ?? [] }
    } catch (failure: unknown) {
      setError(String((failure as Error)?.message ?? failure))
      setStatus('error')
      return null
    }
  }, [])

  useEffect(() => {
    let live = true
    void load().then((result) => {
      if (!live || !result) return
      if ((result.items ?? []).length === 0) {
        void api('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          .then(() =>
            setTimeout(() => {
              if (live) void load()
            }, 1500),
          )
          .catch(() => {})
      }
    })
    return () => {
      live = false
    }
  }, [load])

  const run = useCallback(
    async (name: string, body: Record<string, any>, options: RunActionOptions = {}) => {
      try {
        const precondition =
          options.precondition !== undefined ? options.precondition : inferPrecondition(daily, name, body)
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
      } catch (failure: unknown) {
        setToast({ text: String((failure as Error)?.message ?? failure) })
        return null
      }
    },
    [load, daily],
  )

  const refreshSources = useCallback(async () => {
    setStatus('refreshing')
    try {
      await api('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    } catch (failure: unknown) {
      setToast({ text: String((failure as Error)?.message ?? failure) })
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
