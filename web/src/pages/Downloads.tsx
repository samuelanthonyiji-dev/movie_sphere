import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Download, ExternalLink, HardDrive, Info, Loader2, Play, RotateCcw, Trash2, X, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui'
import { api } from '@/lib/api'
import { cx, formatBytes, timeAgo } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { useDownloads, type DownloadRecord } from '@/state/downloads'
import { useUI } from '@/state/ui'

export default function Downloads() {
  useDocumentTitle('Downloads')
  const dl = useDownloads()
  const { user } = useAuth()
  const { confirm, toast } = useUI()
  const history = useQuery({ queryKey: ['me', 'downloads'], queryFn: api.me.downloads, enabled: !!user })

  const stored = dl.records.filter((r) => r.mode === 'offline' && r.status === 'stored')
  const active = dl.records.filter((r) => r.status === 'downloading' || r.status === 'checking')
  const failed = dl.records.filter((r) => r.status === 'failed' || r.status === 'cancelled')
  const sent = dl.records.filter((r) => r.mode === 'device' && r.status === 'sent')

  const clear = async () => {
    if (!(await confirm({ title: 'Clear download history?', message: 'Removes the history of downloads from this device' + (user ? ' and your account' : '') + '. Films stored for offline viewing are kept, and files already saved to your device are not affected.', confirmLabel: 'Clear history', destructive: true }))) return
    await dl.clearHistory()
    if (user) {
      await api.me.clearDownloads().catch(() => {})
      history.refetch()
    }
    toast('Download history cleared', 'info')
  }
  const retry = (r: DownloadRecord) => dl.retry(r.id).then(() => r.mode === 'device' && toast('Download started'), (e) => toast((e as Error).message, 'error'))

  const empty = !dl.records.length && !history.data?.length
  return (
    <div className="container-page pt-24 lg:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl"><Download className="size-7 text-accent" aria-hidden /> Downloads</h1>
          <p className="mt-2 text-sm text-muted">Manage files saved to your device and films stored in the app for offline viewing.</p>
        </div>
        {!empty && <button className="btn-ghost text-xs" onClick={clear}><Trash2 className="size-4" /> Clear download history</button>}
      </div>

      {dl.storage && dl.storage.quota > 0 && (
        <div className="card mt-6 flex flex-wrap items-center gap-4 p-4 text-sm">
          <HardDrive className="size-5 text-muted" aria-hidden />
          <div className="min-w-48 flex-1">
            <div className="flex justify-between text-xs text-subtle"><span>App storage used on this device</span><span>{formatBytes(dl.storage.usage)} of {formatBytes(dl.storage.quota)}</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (dl.storage.usage / dl.storage.quota) * 100)}%` }} /></div>
          </div>
          <span className="text-xs text-subtle">{dl.storage.persisted ? 'Persistent storage granted' : 'The browser may clear stored films if space runs low'}</span>
        </div>
      )}

      <details className="mt-4 rounded-xl border border-line bg-surface/60 p-4 text-sm text-muted">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-white"><Info className="size-4" /> What do these statuses mean?</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><dt className="font-semibold text-white">Downloading</dt><dd>Being transferred into the app right now, with live progress.</dd></div>
          <div><dt className="font-semibold text-white">Sent to browser</dt><dd>Handed to your browser’s download manager. The file lands in your device’s Downloads folder; the app can’t see whether it finished.</dd></div>
          <div><dt className="font-semibold text-white">Stored in app</dt><dd>Saved inside CineVault’s storage on this device and verified after saving.</dd></div>
          <div><dt className="font-semibold text-white">Available offline</dt><dd>A stored film that can be played in the CineVault player with no connection.</dd></div>
        </dl>
      </details>

      {empty ? (
        <EmptyState icon={<Download className="size-7" />} title="No downloads yet" action={<Link to="/movies?downloadable=1" className="btn-primary">Find downloadable titles</Link>}>
          Titles with authorized files show download options on their detail page. Only public-domain, licensed or rights-holder-approved files are offered.
        </EmptyState>
      ) : (
        <div className="mt-8 space-y-10">
          {active.length > 0 && <Group title="Downloading">{active.map((r) => <Row key={r.id} r={r} onCancel={() => dl.cancel(r.id)} />)}</Group>}
          {stored.length > 0 && (
            <Group title="Available offline · stored in app">
              {stored.map((r) => (
                <Row key={r.id} r={r} onRemove={async () => {
                  if (await confirm({ title: `Remove ${r.movie.title} from this device?`, message: `Frees ${formatBytes(r.size)}. You can save it again later.`, confirmLabel: 'Remove', destructive: true })) {
                    await dl.removeOffline(r.id)
                    toast('Removed from offline storage', 'info')
                  }
                }} />
              ))}
            </Group>
          )}
          {failed.length > 0 && <Group title="Failed or cancelled">{failed.map((r) => <Row key={r.id} r={r} onRetry={() => retry(r)} onRemove={() => dl.removeOffline(r.id)} />)}</Group>}
          {sent.length > 0 && <Group title="Sent to your browser (this device)">{sent.map((r) => <Row key={r.id} r={r} onRetry={() => retry(r)} onRemove={() => dl.removeOffline(r.id)} />)}</Group>}
          {user && (history.data?.length ?? 0) > 0 && (
            <Group title="Account download history">
              {history.data!.map((h) => (
                <li key={h.id} className="flex items-center gap-4 p-3 sm:p-4">
                  <img src={h.movie.posterUrl ?? ''} alt="" className="h-16 w-11 shrink-0 rounded object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/movie/${h.movie.slug}`} className="block truncate font-semibold hover:underline">{h.movie.title}</Link>
                    <p className="text-xs text-subtle">{h.quality} · {h.format.toUpperCase()} · {formatBytes(h.fileSize)} · {timeAgo(h.createdAt)}</p>
                  </div>
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="label">{title}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card/40">{children}</ul>
    </section>
  )
}

function Row({ r, onCancel, onRetry, onRemove }: { r: DownloadRecord; onCancel?: () => void; onRetry?: () => void; onRemove?: () => void }) {
  const pct = r.size ? Math.min(100, Math.round((r.received / r.size) * 100)) : 0
  const status = {
    checking: <span className="text-muted"><Loader2 className="mr-1 inline size-3.5 animate-spin" />Checking availability…</span>,
    downloading: <span className="text-white">Downloading · {pct}% · {formatBytes(r.received)} of {formatBytes(r.size)}</span>,
    stored: <span className="text-success"><CheckCircle2 className="mr-1 inline size-3.5" />Stored in app · available offline</span>,
    sent: <span className="text-muted"><ExternalLink className="mr-1 inline size-3.5" />Sent to browser downloads</span>,
    failed: <span className="text-accent"><XCircle className="mr-1 inline size-3.5" />{r.error ?? 'Failed'}</span>,
    cancelled: <span className="text-subtle">Cancelled</span>,
  }[r.status]
  return (
    <li className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <img src={r.movie.posterUrl ?? ''} alt="" className="h-16 w-11 shrink-0 rounded object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <Link to={`/movie/${r.movie.slug}`} className="block truncate font-semibold hover:underline">{r.movie.title} <span className="font-normal text-subtle">({r.movie.year})</span></Link>
        <p className="text-xs text-subtle">{r.quality} · {r.format.toUpperCase()} · {formatBytes(r.size)} · {timeAgo(r.updatedAt)}</p>
        <p className="mt-1 text-xs">{status}</p>
        {r.status === 'downloading' && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Downloading ${r.movie.title}`}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {r.status === 'stored' && (
          <Link to={`/watch/${r.movie.slug}?file=${r.fileId}`} className="btn-primary min-h-9 px-3 text-xs" aria-label={`Play ${r.movie.title} offline`}>
            <Play className="size-3.5 fill-white" /> <span className="hidden sm:inline">Play</span>
          </Link>
        )}
        {onCancel && <button className="btn-icon size-9" onClick={onCancel} aria-label="Cancel download"><X className="size-4" /></button>}
        {onRetry && (r.status === 'failed' || r.status === 'cancelled' || r.status === 'sent') && (
          <button className={cx('btn-dark min-h-9 px-3 text-xs')} onClick={onRetry} aria-label={r.status === 'sent' ? 'Download again' : 'Retry download'}>
            <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">{r.status === 'sent' ? 'Again' : 'Retry'}</span>
          </button>
        )}
        {onRemove && <button className="btn-icon size-9 text-subtle" onClick={onRemove} aria-label="Remove"><Trash2 className="size-4" /></button>}
      </div>
    </li>
  )
}
