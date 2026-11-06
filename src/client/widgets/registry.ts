import * as React from 'react'
import { taskWidgetDefinition } from './task/TaskWidget.tsx'
import { subscriptionWidgetDefinition } from './subscription/SubscriptionWidget.tsx'
import { captureWidgetDefinition } from './capture/CaptureWidget.tsx'
import { noteWidgetDefinition } from './notes/NoteWidget.tsx'
import { bookmarksWidgetDefinition } from './bookmarks/BookmarksWidget.tsx'
import { projectWidgetDefinition } from './project/ProjectWidget.tsx'
import { readLaterWidgetDefinition } from './readlater/ReadLaterWidget.tsx'
import { habitWidgetDefinition } from './habit/HabitWidget.tsx'
import { focusWidgetDefinition } from './focus/FocusWidget.tsx'
import { agentInboxWidgetDefinition } from './agent-inbox/AgentInboxWidget.tsx'
import type { WidgetDefinition, WidgetRendererProps } from '../../shared/widget.ts'

export function UnknownWidgetFallback({ widget }: WidgetRendererProps<Record<string, unknown>>) {
  return React.createElement(
    'div',
    { className: 'sy-empty', style: { padding: '12px 6px' } },
    React.createElement(
      'div',
      { className: 'meta' },
      `暂不支持的组件类型 (${widget.type ?? 'unknown'})，配置已完整保留`,
    ),
  )
}

export function SoonWidgetFallback({ widget, context }: WidgetRendererProps<Record<string, unknown>>) {
  const label = widget?.title || context?.types?.[widget?.type]?.name || '这个 Widget'
  return React.createElement(
    'div',
    { className: 'sy-soon' },
    `${label}需要一个数据来源，还没接上。这个 Widget 暂时只占位。`,
  )
}

function makeSoonDefinition(
  type: 'calendar' | 'weather' | 'briefing' | 'embed',
  name: string,
  desc: string,
  sizes: Partial<Record<'S' | 'M' | 'L' | 'Wide', [number, number]>>,
): WidgetDefinition<Record<string, unknown>> {
  return {
    type,
    name,
    desc,
    priority: 'P2',
    soon: true,
    sizes,
    defaultSize: 'S',
    actions: [],
    defaultSettings: () => ({}),
    normalizeSettings: (raw) => (raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}),
    Component: SoonWidgetFallback,
    computeLayoutMeta: () => ({ sub: '即将推出' }),
  }
}

export const WIDGET_REGISTRY: Record<string, WidgetDefinition<any>> = {
  task: taskWidgetDefinition,
  subscription: subscriptionWidgetDefinition,
  capture: captureWidgetDefinition,
  notes: noteWidgetDefinition,
  bookmarks: bookmarksWidgetDefinition,
  project: projectWidgetDefinition,
  readlater: readLaterWidgetDefinition,
  agentInbox: agentInboxWidgetDefinition,
  habit: habitWidgetDefinition,
  focus: focusWidgetDefinition,
  calendar: makeSoonDefinition('calendar', '今日日程', '接入日历后展示', { S: [3, 2], M: [3, 4], L: [6, 4] }),
  weather: makeSoonDefinition('weather', '天气', '接入位置与天气源后展示', { S: [3, 2], M: [6, 2] }),
  briefing: makeSoonDefinition('briefing', 'AI 简报', '基于今日内容生成一段简报', { M: [6, 2], L: [6, 4] }),
  embed: makeSoonDefinition('embed', '嵌入网页', '放一个可嵌入的页面', { M: [6, 2], L: [6, 4] }),
}

export function getWidgetDefinition(type: string): WidgetDefinition<any> | null {
  return WIDGET_REGISTRY[type] ?? null
}
