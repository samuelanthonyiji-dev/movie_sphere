import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BrandLoader } from '@/components/Logo'
import { ErrorState } from '@/components/ui'
import { VideoPlayer, type PlayerSource } from '@/components/VideoPlayer'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { useDownloads } from '@/state/downloads'
import { useLibrary } from '@/state/library'
import { getLocalPrefs } from '@/state/prefs'
import { useUI } from '@/state/ui'

const ORDER = ['2160p', '1080p', '720p', '480p']

export default function Watch() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const lib = useLibrary()
  const dl = useDownloads()
  const { toast } = useUI()
  const [restartKey, setRestartKey] = useState(0)
  const lastSave = useRef(0)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['movie', slug], queryFn: () => api.movie(slug) })
  const movie = data?.movie
  useDocumentTitle(movie ? `Watching ${movie.title}` : 'Player')

  const sources: PlayerSource[] = useMemo(() => {
    if (!movie) return []
    const mp4 = movie.files
      .filter((f) => f.streamable && f.streamUrl && f.format !== 'hls')
      .sort((a, b) => ORDER.indexOf(a.quality) - ORDER.indexOf(b.quality))
      .map((f) => ({ id: f.id, label: `${f.quality}${dl.isStoredOffline(f.id) ? ' · offline' : ''}`, url: f.streamUrl!, kind: 'mp4' as const }))
    const hls = movie.files.filter((f) => f.streamable && f.format === 'hls' && f.streamUrl).map((f) => ({ id: f.id, label: 'Auto (adaptive)', url: f.streamUrl!, kind: 'hls' as const }))
    return [...hls, ...mp4]
  }, [movie, dl])

  const prefs = { ...getLocalPrefs(), ...(user?.preferences ?? {}) }
  const initial = useMemo(() => {
    const fromUrl = params.get('file')
    if (fromUrl && sources.some((s) => s.id === fromUrl)) return fromUrl
    if (!navigator.onLine) return sources.find((s) => dl.isStoredOffline(s.id))?.id
    return sources.find((s) => s.label.startsWith(prefs.preferredQuality ?? '___'))?.id ?? sources.find((s) => s.kind === 'mp4' && s.label.startsWith('720p'))?.id ?? sources[0]?.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length])

  const progress = movie ? lib.getProgress(movie.id) : undefined
  const startAt = restartKey === 0 && progress && progress.duration && progress.position / progress.duration < 0.95 ? progress.position : 0

  useEffect(() => {
    if (startAt > 5) toast(`Resuming from ${formatTime(startAt)}`, 'info', { label: 'Start over', onClick: () => setRestartKey((k) => k + 1) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id])

  if (isLoading) return <div className="min-h-dvh bg-black"><BrandLoader className="min-h-dvh" label="Preparing player" /></div>
  if (error || !movie) return <div className="min-h-dvh bg-bg pt-20"><ErrorState error={error} onRetry={() => refetch()} /></div>
  if (!sources.length)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Streaming unavailable</h1>
          <p className="mt-2 text-sm text-muted">There is no authorized stream for “{movie.title}” yet.</p>
          <Link to={`/movie/${movie.slug}`} className="btn-primary mt-6">Back to details</Link>
        </div>
      </div>
    )

  return (
    <div className="fixed inset-0 bg-black">
      <VideoPlayer
        key={restartKey}
        className="size-full"
        title={movie.type === 'SERIES' ? `${movie.title} · S1 E1${movie.episodes[0] ? ` · ${movie.episodes[0].title}` : ''}` : movie.title}
        poster={movie.backdropUrl}
        sources={sources}
        initialSourceId={initial}
        subtitles={movie.subtitles.map((s) => ({ id: s.id, label: s.label, language: s.language, url: s.url }))}
        initialSubtitle={prefs.subtitleLanguage}
        startAt={startAt}
        onBack={() => (window.history.length > 1 ? nav(-1) : nav(`/movie/${movie.slug}`))}
        onProgress={(pos, dur) => {
          const now = Date.now()
          if (now - lastSave.current < 4000 && pos < dur - 1) return
          lastSave.current = now
          lib.saveProgress(movie, pos, dur)
        }}
      />
    </div>
  )
}
