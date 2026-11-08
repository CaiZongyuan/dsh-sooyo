import * as React from 'react'
import { sameBuild } from '../../shared/build.js'
import { updateSession } from './session.js'

const { useEffect, useState } = React

function useUpdateState() {
  const session = updateSession()
  const [view, setView] = useState(() => session.snapshot())
  useEffect(() => session.subscribe(() => setView(session.snapshot())), [session])
  return { session, view }
}

export function PluginUpdateButton({ onClick }: { onClick: () => void }) {
  const { view } = useUpdateState()
  const target = view.status?.candidate
  return <button className={`sy-icon-btn sy-update-trigger${target ? ' has-update' : ''}`}
    aria-label="插件更新" title={target ? `发现新版本 ${target.version}` : '插件更新'} onClick={onClick}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 16V4m-4 4 4-4 4 4M5 14v5h14v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {target ? <i aria-label="有可用更新" /> : null}
  </button>
}

export function PluginUpdates({ rootRef, open, onClose }: {
  rootRef: React.RefObject<HTMLDivElement | null>; open: boolean; onClose: () => void
}) {
  const { session, view } = useUpdateState()
  useEffect(() => rootRef.current ? session.attach(rootRef.current) : undefined, [rootRef, session])
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !view.busy) onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open, view.busy, onClose])
  const status = view.status
  const target = status?.candidate
  const mismatch = view.runtime && !sameBuild(view.runtime.build, view.build)
  const completed = view.receipt?.outcome === 'applied' && view.runtime?.ready
    && view.runtime.phase === 'running' && view.runtime.build.version === view.receipt.target && !mismatch

  return <>
    {open ? <div className="sy-scrim sy-update-scrim" onClick={(event) => {
      if (event.target === event.currentTarget && !view.busy) onClose()
    }}>
      <section className="sy-modal sy-update-modal" role="dialog" aria-modal="true" aria-labelledby="sy-update-title">
        <div className="sy-modal-h">
          <div><h2 id="sy-update-title">sooyo 更新</h2><p>当前设备 · {view.runtime?.role ?? '正在连接'}</p></div>
          <button className="sy-icon-btn" aria-label="关闭更新面板" disabled={view.busy} onClick={onClose}>×</button>
        </div>
        <div className="sy-modal-b">
          <dl className="sy-update-versions">
            <div><dt>本机服务</dt><dd>{view.runtime?.build.version ?? '正在读取'}{view.runtime?.ready ? ' · 已就绪' : ''}</dd></div>
            <div><dt>当前界面</dt><dd>{view.build.version ?? '未知版本'}</dd></div>
            {status?.installedVersion && status.installedVersion !== view.runtime?.build.version
              ? <div><dt>已安装</dt><dd>{status.installedVersion} · 等待生效</dd></div> : null}
          </dl>
          {mismatch ? <p className="sy-update-notice">界面与本机服务版本尚未一致，写入暂不可用。请等待重新加载完成。</p> : null}
          {status?.source === 'checkout' ? <p className="sy-update-notice">这是源码开发副本，仅提供检查。请在工作树中手动拉取、构建，并按宿主提示重新加载。</p> : null}
          {status?.development ? <p className="sy-update-muted">开发提交：{status.development.installedCommit?.slice(0, 7) ?? '未知'}
            {status.development.latestCommit ? ` → ${status.development.latestCommit.slice(0, 7)}` : ''}
            {status.development.changed ? ' · 与上游不同' : ''}</p> : null}
          {target ? <div className="sy-update-release">
            <div><strong>正式版本 {target.version}</strong>{target.publishedAt ? <time>{new Date(target.publishedAt).toLocaleDateString()}</time> : null}</div>
            <p>{target.notes}</p>
            {target.reason ? <p className="sy-update-notice">{target.reason}</p> : null}
          </div> : <p className="sy-update-muted">{status?.state === 'current' ? '当前已是最新正式版本。' : '后台会自动检查正式版本，也可以立即检查。'}</p>}
          {status?.reason && status.source !== 'checkout' ? <p className="sy-update-notice">{status.reason}</p> : null}
          {status?.error ? <p className="sy-update-notice" role="alert">{status.error}</p> : null}
          {!view.native ? <p className="sy-update-muted">当前宿主未提供一键更新能力，可在 DSH「设置 → 插件」中更新。</p> : null}
          {view.dirty ? <p className="sy-update-notice">有未提交内容，请先保存或取消，再升级。</p> : null}
          {view.message ? <p className={`sy-update-message${completed ? ' is-complete' : ''}`} role="status">{view.message}</p> : null}
          {view.receipt?.detail && view.message !== view.receipt.detail
            ? <p className="sy-update-muted">{view.receipt.detail}</p> : null}
          <p className="sy-update-muted">升级时面板会短暂重新加载。需要重启 DSH 时会提示你安排；升级失败后会尝试恢复旧插件，并显示恢复结果。</p>
        </div>
        <div className="sy-modal-f">
          <button className="sy-btn" disabled={view.busy} onClick={() => void session.check()}>{view.busy ? '正在处理…' : '检查更新'}</button>
          {target ? <button className="sy-btn sy-btn-add" disabled={view.busy || view.dirty || !status?.canUpdate || !view.native}
            onClick={() => void session.upgrade()}>升级到 {target.version}</button> : null}
        </div>
      </section>
    </div> : null}
  </>
}
