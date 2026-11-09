import { AlertTriangle, CheckCircle2, Download, FileText, HardDriveDownload, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatBytes, licenseLabel, QUALITY_LABEL, RIGHTS_LABEL } from '@/lib/format'
import type { MovieDetail, MovieFile } from '@/lib/types'
import { useDownloads } from '@/state/downloads'
import { useUI } from '@/state/ui'

/** Lists ONLY the authorized files that exist for a title. Never invents options. */
export function DownloadOptions({ movie }: { movie: MovieDetail }) {
  const dl = useDownloads()
  const { toast, confirm } = useUI()
  const [busy, setBusy] = useState<string | null>(null)
  const files = movie.files.filter((f) => f.downloadable && f.downloadUrl)
  const offlineSupported = 'caches' in window && 'ReadableStream' in window

  const toDevice = async (f: MovieFile) => {
    const ok = await confirm({
      title: `Download ${movie.title} (${f.quality})?`,
      message: (
        <>
          {formatBytes(f.fileSize)} · {f.format.toUpperCase()}. The file will be saved by your browser to your device’s Downloads folder.
          {f.fileSize > 1024 ** 3 && ' This is a large file — a Wi-Fi connection is recommended.'}
        </>
      ),
      confirmLabel: 'Download',
    })
    if (!ok) return
    setBusy(f.id)
    try {
      await dl.startDevice(movie, f)
      toast('Download started — check your browser’s downloads', 'success', { label: 'View', onClick: () => (location.href = '/downloads') })
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const toOffline = async (f: MovieFile) => {
    const ok = await confirm({
      title: `Save ${f.quality} for offline viewing?`,
      message: <>Stores {formatBytes(f.fileSize)} inside the MovieSphere app on this device so you can watch without a connection. You can remove it anytime from Downloads.</>,
      confirmLabel: 'Save offline',
    })
    if (!ok) return
    toast('Saving for offline… you can follow progress in Downloads', 'info')
    dl.startOffline(movie, f).then(
      () => toast(`${movie.title} (${f.quality}) is available offline`),
      (e) => toast((e as Error).message, 'error', { label: 'Retry', onClick: () => dl.retry(`offline:${f.id}`) }),
    )
  }

  return (
    <section id="downloads" aria-labelledby="dl-title" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 id="dl-title" className="section-title">
          <HardDriveDownload className="size-5 text-accent" aria-hidden /> Download options
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
          <ShieldCheck className="size-4 text-success" aria-hidden /> {RIGHTS_LABEL[movie.rightsBasis]}
        </span>
      </div>

      {files.length === 0 ? (
        <div className="card flex items-start gap-4 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Download currently unavailable.</p>
            <p className="mt-1 leading-6 text-muted">
              No authorized file is available for this title yet. {movie.rightsNote}
            </p>
            <p className="mt-2 text-muted">
              Rights holder? <Link to={`/contact?topic=licensing&movie=${movie.slug}`} className="text-white underline underline-offset-4">Contact us about distribution</Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Available download files for {movie.title}</caption>
            <thead className="hidden bg-surface text-xs tracking-wide text-subtle uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Quality</th>
                <th scope="col" className="px-3 py-3 font-semibold">Size</th>
                <th scope="col" className="px-3 py-3 font-semibold">Format</th>
                <th scope="col" className="px-3 py-3 font-semibold">Language</th>
                <th scope="col" className="px-3 py-3 font-semibold">Subtitles</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {files.map((f) => {
                const stored = dl.isStoredOffline(f.id)
                const rec = dl.records.find((r) => r.id === `offline:${f.id}`)
                const saving = rec?.status === 'downloading' || rec?.status === 'checking'
                return (
                  <tr key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-card/40 p-4 md:table-row md:p-0">
                    <td className="w-full md:w-auto md:px-5 md:py-4">
                      <span className="font-semibold">{QUALITY_LABEL[f.quality] ?? f.quality}</span>
                      {f.hostedBy && <span className="mt-0.5 block text-[11px] text-subtle">Hosted by {f.hostedBy}</span>}
                    </td>
                    <td className="text-muted md:px-3"><span className="md:hidden">Size: </span>{formatBytes(f.fileSize)}</td>
                    <td className="text-muted md:px-3">{f.format.toUpperCase()}</td>
                    <td className="text-muted md:px-3">{f.language}</td>
                    <td className="text-muted md:px-3">{f.subtitles.length ? f.subtitles.join(', ') : 'None'}</td>
                    <td className="mt-3 flex w-full flex-col gap-2 xs:flex-row md:mt-0 md:w-auto md:justify-end md:px-5 md:py-3">
                      <button className="btn-primary min-h-10 flex-1 px-4 md:flex-none" onClick={() => toDevice(f)} disabled={busy === f.id}>
                        {busy === f.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download
                        <span className="sr-only"> {f.quality}</span>
                      </button>
                      {offlineSupported && f.streamable && (
                        stored ? (
                          <Link to={`/watch/${movie.slug}?file=${f.id}`} className="btn-dark min-h-10 flex-1 px-4 text-success md:flex-none">
                            <CheckCircle2 className="size-4" /> Offline ready
                          </Link>
                        ) : (
                          <button className="btn-dark min-h-10 flex-1 px-4 md:flex-none" onClick={() => toOffline(f)} disabled={saving}>
                            {saving ? <><Loader2 className="size-4 animate-spin" /> {rec && rec.size ? Math.round((rec.received / rec.size) * 100) : 0}%</> : <><HardDriveDownload className="size-4" /> Save offline</>}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {movie.subtitles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold tracking-wide text-subtle uppercase">Subtitle files:</span>
          {movie.subtitles.map((s) => (
            <a key={s.id} href={s.downloadUrl} className="chip" download>
              <FileText className="size-3.5" /> {s.label} (.{s.format})
            </a>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-subtle">
        {movie.sourceUrl && <>Files come from the <a className="underline" href={movie.sourceUrl} target="_blank" rel="noopener noreferrer">original source page</a>{movie.license && <> under {licenseLabel(movie.license)}</>}. </>}
        “Download” saves a copy to your device via your browser. “Save offline” stores the film inside the app for offline playback; it is listed as ready only after the browser confirms it was stored.
      </p>
    </section>
  )
}
