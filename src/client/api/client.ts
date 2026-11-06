import type { CommandPrecondition } from '../../shared/commands.js'
import type { DailySnapshot } from '../../shared/domain.js'

export const API = '/sooyo'

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API + path, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const text = await response.text()
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })()
    : null
  if (!response.ok) throw new Error(parsed?.error ?? `HTTP ${response.status}`)
  return parsed as T
}

export function action<T = any>(name: string, body: unknown, precondition?: CommandPrecondition): Promise<T> {
  return api<T>('/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      body: body ?? {},
      ...(precondition ? { precondition } : {}),
    }),
  })
}

export function inferPrecondition(
  daily: DailySnapshot | null | undefined,
  name: string,
  body: Record<string, any> | null | undefined,
): CommandPrecondition | undefined {
  if (!daily || !body) return undefined
  if (name === 'task.update' || name === 'task.remove') {
    const task = (daily.tasks ?? []).find((entry) => entry.id === body.id)
    if (Number.isSafeInteger(task?.revision)) {
      return { entity: 'task', id: task!.id, revision: task!.revision! }
    }
  }
  if (name === 'note.remove') {
    const note = (daily.notes ?? []).find((entry) => entry.id === body.id)
    if (Number.isSafeInteger(note?.revision)) {
      return { entity: 'note', id: note!.id, revision: note!.revision! }
    }
  }
  if (name === 'board.rename' || name === 'board.remove') {
    const board = (daily.boards ?? []).find((entry) => entry.id === body.id)
    if (Number.isSafeInteger(board?.revision)) {
      return { entity: 'board', id: board!.id, revision: board!.revision! }
    }
  }
  if (name === 'widget.update' || name === 'widget.remove') {
    const widget = daily.widgets?.[body.id]
    if (Number.isSafeInteger(widget?.revision)) {
      return { entity: 'widget', id: widget!.id, revision: widget!.revision! }
    }
  }
  if (name === 'layout.set' || name === 'widget.resize') {
    const boardId = body.boardId ?? daily.active
    const cols = body.cols ?? 12
    const lKey = `${boardId}-${cols}`.replace(/[^a-zA-Z0-9_-]/g, '-')
    const rev = daily.layoutRevisions?.[lKey]
    if (Number.isSafeInteger(rev)) {
      return { entity: 'layout', id: lKey, revision: rev! }
    }
  }
  const settingsMap: Record<string, string> = {
    'interests.set': 'interests',
    'bookmarks.set': 'bookmarks',
    'habit.tick': 'habits',
    'focus.set': 'focus',
  }
  const sKey = settingsMap[name]
  if (sKey) {
    const rev = daily.settingsRevisions?.[sKey]
    if (Number.isSafeInteger(rev) && (rev ?? 0) > 0) {
      return { entity: 'settings', id: sKey, revision: rev! }
    }
  }
  return undefined
}
