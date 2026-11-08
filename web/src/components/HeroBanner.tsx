import { Check, Clock, Download, Info, Play, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cx, formatRuntime, srcSetFor } from '@/lib/format'
import { useReducedMotion } from '@/lib/hooks'
import type { MovieCard } from '@/lib/types'
import { useLibrary } from '@/state/library'
import { TrailerModal } from './TrailerModal'
import { Badge, Rating } from './ui'

export function HeroBanner({ items }: { items: MovieCard[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [trailer, setTrailer] = useState<MovieCard | null>(null)
  const reduced = useReducedMotion()
  const lib = useLibrary()
  const nav = useNavigate()

  useEffect(() => {
    if (paused || reduced || items.length < 2 || trailer) return
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 9000)
    return () => clearInterval(t)
  }, [paused, reduced, items.length, trailer])

  if (!items.length) return <div className="skeleton h-[72vh] min-h-[460px] w-full" aria-hidden />
  const m = items[i]
  const inList = lib.inList(m.id)

  return (
    <section
      className="relative h-[78svh] max-h-[860px] min-h-[520px] w-full overflow-hidden sm:h-[72vh] lg:h-[86vh]"
      aria-roledescription="carousel"
      aria-label="Featured titles"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {items.map((x, idx) => (
        <img
          key={x.id}
          src={x.backdropUrl ?? x.posterUrl ?? undefined}
          srcSet={srcSetFor(x.backdropUrl, 'backdrop')}
          sizes="100vw"
          alt=""
          aria-hidden
          fetchPriority={idx === 0 ? 'high' : 'low'}
          loading={idx === 0 ? 'eager' : 'lazy'}
          className={cx('absolute inset-0 size-full object-cover object-[65%_center] transition-[opacity,transform] duration-[1200ms] ease-out sm:object-center', idx === i ? 'scale-100 opacity-100' : 'scale-105 opacity-0')}
        />
      ))}
      <div className="hero-fade absolute inset-0" aria-hidden />

      <div className="relative z-10 flex h-full items-end pb-16 sm:items-center sm:pb-0">
        <div className="container-page">
          <div key={m.id} className="max-w-2xl animate-rise" aria-live="polite">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted sm:text-sm">
              {m.rightsBasis === 'PLATFORM_ORIGINAL' && <Badge tone="red">CineVault Original</Badge>}
              {m.rightsBasis === 'PUBLIC_DOMAIN' && <Badge tone="outline">Public domain</Badge>}
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatRuntime(m.runtime)}{m.type === 'SERIES' && ' / ep'}</span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <Rating value={m.rating} />
              <span className="text-subtle">·</span>
              <span className="text-muted">{m.year}</span>
              <span className="text-subtle">·</span>
              <span className="text-muted">{m.genres.slice(0, 3).map((g) => g.name).join(' | ')}</span>
              <Badge tone="outline">{m.ageRating}</Badge>
            </div>
            <h1 className="max-w-xl text-4xl leading-[1.02] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">{m.title}</h1>
            {m.tagline && <p className="mt-3 text-sm font-medium tracking-wide text-white/90 sm:text-base">{m.tagline}</p>}
            <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-6 text-muted sm:text-[15px]">{m.description}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {m.streamable ? (
                <button className="btn-primary px-6" onClick={() => nav(`/watch/${m.slug}`)}>
                  <Play className="size-4 fill-white" /> Watch
                </button>
              ) : m.trailerUrl ? null : (
                <Link className="btn-primary px-6" to={`/movie/${m.slug}`}>
                  <Info className="size-4" /> Movie details
                </Link>
              )}
              {m.trailerUrl && (
                <button className="btn-dark" onClick={() => setTrailer(m)}>
                  <Play className="size-4" /> Watch trailer
                </button>
              )}
              {m.streamable || m.trailerUrl ? (
                <Link className="btn-dark" to={`/movie/${m.slug}`}>
                  <Info className="size-4" /> <span className="hidden xs:inline">Details</span>
                </Link>
              ) : null}
              {m.downloadable && (
                <Link className="btn-dark" to={`/movie/${m.slug}#downloads`} aria-label={`Download ${m.title}`}>
                  <Download className="size-4" /> <span className="hidden sm:inline">Download</span>
                </Link>
              )}
              <button className="btn-dark" onClick={() => lib.toggleList(m)} aria-pressed={inList} aria-label={inList ? 'Remove from My List' : 'Add to My List'}>
                {inList ? <Check className="size-4" /> : <Plus className="size-4" />}
                <span className="hidden sm:inline">{inList ? 'In My List' : 'My List'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2" role="tablist" aria-label="Choose featured title">
          {items.map((x, idx) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={idx === i}
              aria-label={x.title}
              onClick={() => setI(idx)}
              className="group/dot flex h-6 items-center"
            >
              <span className={cx('block h-[3px] rounded-full transition-all duration-500', idx === i ? 'w-10 bg-white' : 'w-6 bg-white/30 group-hover/dot:bg-white/60')} />
            </button>
          ))}
        </div>
      )}
      {trailer && <TrailerModal movie={trailer} onClose={() => setTrailer(null)} />}
    </section>
  )
}
