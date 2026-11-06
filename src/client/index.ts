import * as React from 'react'
import { SooyoPanel } from './SooyoPanel.tsx'
import { BRAND_SMALL } from './widgets/shared.tsx'

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
    ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register(
        { name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: 'sooyo daily' },
        SooyoIcon,
      ),
    )
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, SooyoPanel))
  },
}

export default clientPlugin
