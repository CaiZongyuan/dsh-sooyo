import * as React from 'react'
import { I, SvgIcon } from '../widgets/shared.tsx'
import type { Board } from '../../shared/domain.ts'

export interface BoardTabsProps {
  boards: readonly Board[]
  activeBoard: string | null
}

export function BoardTabs({ boards, activeBoard }: BoardTabsProps) {
  return (
    <div className="sy-seg sy-seg-boards" role="tablist">
      {boards.map((entry) => (
        <button
          key={entry.id}
          role="tab"
          aria-pressed={entry.id === activeBoard}
          data-act="board"
          data-board={entry.id}
        >
          {entry.name}
        </button>
      ))}
      <button className="sy-seg-add" data-act="board-new" aria-label="新建 Board" title="新建 Board">
        <SvgIcon svg={I.plus} />
      </button>
    </div>
  )
}
