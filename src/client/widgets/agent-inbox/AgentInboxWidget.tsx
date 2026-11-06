import * as React from 'react'
import { EmptyWidgetState, I, OPERATION_LABELS, STATUS_LABELS, SvgIcon, WidgetIcon, relTime } from '../shared.tsx'
import type { AgentInboxWidgetSettings, Proposal } from '../../../shared/domain.ts'
import type { WidgetDefinition, WidgetRendererProps } from '../../../shared/widget.ts'

function ProposalRow({ proposal, actionable }: { proposal: Proposal; actionable: boolean }) {
  return (
    <div
      className="sy-row"
      style={{
        alignItems: 'flex-start',
        gap: 10,
        padding: '7px 0',
        marginInline: 0,
        borderBottom: '1px solid var(--sy-line)',
      }}
    >
      <div className="grow" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="c2" style={{ fontSize: 13.5, fontWeight: 520 }}>
          {proposal.reason}
        </span>
        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(proposal.operations ?? []).map((operation, idx) => (
            <span key={idx} className="sy-chip" title={operation.name}>
              {OPERATION_LABELS[operation.name] ?? operation.name}
            </span>
          ))}
        </span>
        <span className="meta">
          {relTime(proposal.createdAt)}
          {(proposal.evidenceRefs ?? []).length ? ` · ${proposal.evidenceRefs.length} 条证据` : ''}
          {(proposal.preview?.diff ?? []).length ? ` · ${proposal.preview?.diff?.length ?? 0} 处变更` : ''}
        </span>
      </div>
      {actionable ? (
        <span
          className="sy-acts"
          style={{ flex: 'none', display: 'flex', position: 'static', transform: 'none', alignItems: 'center' }}
        >
          {proposal.status === 'pending' ? (
            <>
              <button
                data-act="proposal-approve"
                data-proposal={proposal.id}
                title="批准并执行"
                aria-label="批准并执行"
              >
                <SvgIcon svg={I.check} />
              </button>
              <button data-act="proposal-reject" data-proposal={proposal.id} title="拒绝" aria-label="拒绝">
                <SvgIcon svg={I.x} />
              </button>
            </>
          ) : proposal.status === 'applied' ? (
            <>
              <span className="meta">{STATUS_LABELS[proposal.status] ?? proposal.status}</span>
              <button
                data-act="proposal-rollback"
                data-proposal={proposal.id}
                title="撤销改动"
                aria-label="撤销改动"
              >
                <SvgIcon svg={I.reset} />
              </button>
            </>
          ) : (
            <span className="meta">{STATUS_LABELS[proposal.status] ?? proposal.status}</span>
          )}
        </span>
      ) : null}
    </div>
  )
}

export function AgentInboxWidget({ widget, size, context }: WidgetRendererProps<AgentInboxWidgetSettings>) {
  const all = context.agentInbox ?? []
  const pending = all.filter((entry) => entry.status === 'pending')
  const decided = all.filter(
    (entry) => entry.status === 'applied' || entry.status === 'rejected' || entry.status === 'rolled_back',
  )
  if (all.length === 0) {
    return <EmptyWidgetState widget={widget} size={size} context={context} />
  }

  if (size === 'S') {
    const first = pending[0] ?? decided[0]
    return (
      <>
        <div className="sy-s-lab">
          <WidgetIcon type="agentInbox" size={16} />
          待批建议
        </div>
        <div className="sy-s-main">
          <div className="sy-s-big">{pending.length}</div>
          <div className="sy-s-sub">{pending.length ? '条等你决定' : '都处理完了'}</div>
        </div>
        {first ? (
          <div className="sy-s-narrow">
            <span className="c1" style={{ fontSize: 13 }}>
              {first.reason}
            </span>
          </div>
        ) : null}
      </>
    )
  }

  if (size === 'M') {
    return (
      <>
        <div className="sy-list sy-fit" style={{ gap: 0 }}>
          {(pending.length ? pending : decided).slice(0, 4).map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} actionable={true} />
          ))}
        </div>
        <div className="meta" style={{ flex: 'none' }}>
          {pending.length} 条待批 · {decided.length} 条已处理
        </div>
      </>
    )
  }

  return (
    <>
      <div className="sy-list sy-fit" style={{ gap: 0 }}>
        {(pending.length ? pending : decided).slice(0, 6).map((proposal) => (
          <ProposalRow key={proposal.id} proposal={proposal} actionable={true} />
        ))}
      </div>
      <div className="meta" style={{ flex: 'none' }}>
        审批只在<b>这台设备</b>上发生：Agent 不能自己批准自己的建议。批准后按条执行，失败的会标记为 failed。
      </div>
    </>
  )
}

export const agentInboxWidgetDefinition: WidgetDefinition<AgentInboxWidgetSettings> = {
  type: 'agentInbox',
  name: 'Agent 收件箱',
  desc: '后台审阅给出的建议，等你批准或拒绝',
  priority: 'P0',
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: 'S',
  actions: ['查看差异', '批准', '拒绝'],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: AgentInboxWidget,
  computeLayoutMeta: ({ context }) => {
    const all = context.agentInbox ?? []
    if (all.length === 0) return { sub: '空' }
    const pending = all.filter((entry) => entry.status === 'pending')
    return { sub: pending.length ? `${pending.length} 条待批` : '已清空' }
  },
}
