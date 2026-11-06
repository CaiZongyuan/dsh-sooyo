import * as React from 'react'
import { EmptyWidgetState, I, ProgressBar, ProgressRing, SvgIcon, WidgetIcon, hueOf, projectsOf } from '../shared.tsx'
import type { ProjectWidgetSettings } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

const colourOf = (name: string): string =>
  (['var(--sy-t-project)', 'var(--sy-t-task)', 'var(--sy-t-bookmarks)', 'var(--sy-t-habit)'] as const)[
    hueOf(name) % 4
  ]!

export function ProjectWidget({ widget, size, context }: WidgetRendererProps<ProjectWidgetSettings>) {
  const projects = projectsOf(context.tasks)
  if (projects.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }

  if (size === 'S') {
    const project = projects[0]!
    return (
      <>
        <div className="sy-s-lab">
          <WidgetIcon type="project" size={16} />
          项目
        </div>
        <div className="sy-pj-s">
          <ProgressRing
            pct={project.progress}
            size={60}
            stroke={7}
            colour={colourOf(project.name)}
            label={`${Math.round(project.progress * 100)}%`}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }} className="c1">
              {project.name}
            </div>
            <div className="meta">{project.open} 件待办</div>
          </div>
        </div>
        <div className="meta c1" style={{ whiteSpace: 'normal' }}>
          {projects.length} 个项目在推进
        </div>
      </>
    )
  }

  const rows = projects.map((project) => (
    <div key={project.name} className="sy-pj-row">
      <div className="sy-pj-h">
        <span className="sy-pj-dot" style={{ '--c': colourOf(project.name) } as React.CSSProperties} />
        <b className="c1">{project.name}</b>
        <span className="grow" />
        <span className="meta">
          {Math.round(project.progress * 100)}% · {project.open} 件待办
        </span>
      </div>
      <ProgressBar pct={project.progress} colour={colourOf(project.name)} />
    </div>
  ))

  if (size === 'M') {
    return (
      <div className="sy-list sy-fit" style={{ gap: 9 }}>
        {rows}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 'none' }}>{rows}</div>
      <div className="sy-agenda-h">最近完成</div>
      <div className="sy-list sy-fit" style={{ gap: 3 }}>
        {context.tasks
          .filter((task) => task.done)
          .slice(0, 6)
          .map((task) => (
            <div key={task.id} className="sy-row" style={{ minHeight: 28 }}>
              <span className="sy-chk sy-done">
                <SvgIcon svg={I.check} />
              </span>
              <span className="tt c1 grow">{task.title}</span>
              <span className="meta">{task.project ?? ''}</span>
            </div>
          ))}
      </div>
    </>
  )
}

export const projectWidgetDefinition: WidgetDefinition<ProjectWidgetSettings> = {
  type: 'project',
  name: '项目',
  desc: '按任务完成度看每个 Project 的进度',
  priority: 'P0',
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: 'S',
  actions: ['查看动态'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: ProjectWidget,
  computeLayoutMeta: ({ size, context }) => {
    const projects = projectsOf(context.tasks)
    if (projects.length === 0) return { sub: '空' }
    if (size === 'S') return {}
    return { sub: `${projects.length} 个进行中` }
  },
}
