import * as React from 'react'
import { SooyoPanel } from './SooyoPanel.tsx'
import { BRAND_SMALL } from './widgets/shared.tsx'
import { BUILD } from '../shared/build.js'
import { updateSession } from './updates/session.js'

export const PANEL_ID = 'sooyo'

export function SooyoIcon(props: { size?: number; active?: boolean }) {
  const size = props?.size ?? 18
  return React.createElement('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    'aria-hidden': true,
    style: { display: 'block', opacity: props?.active ? 1 : 0.72 },
    dangerouslySetInnerHTML: { __html: BRAND_SMALL },
  })
}

export const clientPlugin = {
  inject: ['slots'],
  apply(ctx: any) {
    const updates = updateSession()
    updates.bind(BUILD, () => undefined)
    ctx.inject?.(['remote', 'remote.pluginManager'], (remoteCtx: any) =>
      updates.bind(BUILD, () => remoteCtx.remote.pluginManager),
    )
    ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register(
        { name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: 'sooyo daily' },
        SooyoIcon,
      ),
    )
    ctx.slots.inject('main', () => {
      const dispose = ctx.slots.register({ name: 'main', key: PANEL_ID }, SooyoPanel)
      ctx.inject?.(['layout'], (layoutCtx: any) => updates.bindNavigation({
        begin: () => layoutCtx.layout.beginNavigation?.(),
        open: () => layoutCtx.layout.selectPanel(PANEL_ID),
      }))
      return dispose
    })
  },
}

export default clientPlugin
