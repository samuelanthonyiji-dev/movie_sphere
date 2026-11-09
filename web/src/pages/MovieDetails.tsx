import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Copy, Download, Flag, Globe, Heart, Languages, Play, Plus, Share2, Star, Subtitles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { DownloadOptions } from '@/components/DownloadOptions'
import { MovieCarousel } from '@/components/MovieCarousel'
import { TrailerModal } from '@/components/TrailerModal'
import { Badge, ErrorState, Rating } from '@/components/ui'
import { BrandLoader } from '@/components/Logo'
import { api } from '@/lib/api'
import { cx, formatRuntime, licenseLabel, QUALITY_LABEL, RIGHTS_LABEL, ratingSourceLabel, srcSetFor } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { copyText, shareMovie } from '@/lib/share'
import type { MovieDetail } from '@/lib/types'
import { useAuth } from '@/state/auth'
import { useLibrary } from '@/state/library'
import { useUI } from '@/state/ui'

export default function MovieDetails() {
  const { slug = '' } = useParams()
  const { hash } = useLocation()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['movie', slug], queryFn: () => api.movie(slug) })
  const lib = useLibrary()
  const movie = data?.movie
  useDocumentTitle(movie ? `${movie.title} (${movie.year})` : undefined, movie?.description)

  useEffect(() => {
    if (movie) lib.markViewed(movie)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id])
  useEffect(() => {
    if (movie && hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [movie, hash])

  if (isLoading) return <BrandLoader className="min-h-[80vh]" />
  if (error || !movie) return <div className="pt-24"><ErrorState error={error ?? new Error('Not found')} onRetry={() => refetch()} /></div>
  return (
    <>
      <Hero movie={movie} />
      <div className="container-page mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          {movie.episodes.length > 0 && <Episodes movie={movie} />}
          <DownloadOptions movie={movie} />
        </div>
        <Facts movie={movie} />
      </div>
      {data.related.length > 0 && (
        <div className="mt-14">
          <MovieCarousel title="More like this" items={data.related} />
        </div>
      )}
    </>
  )
}

function Hero({ movie }: { movie: MovieDetail }) {
  const lib = useLibrary()
  const { toast } = useUI()
  const nav = useNavigate()
  const [trailer, setTrailer] = useState(false)
  const inList = lib.inList(movie.id)
  const fav = lib.isFavorite(movie.id)
  const progress = lib.getProgress(movie.id)
  const resume = progress && progress.duration && progress.position > 5 && progress.position / progress.duration < 0.95

  const share = async () => {
    const r = await shareMovie(movie)
    if (r === 'copied') toast('Link copied to clipboard')
  }

  return (
    <section className="relative isolate overflow-hidden pt-20 lg:pt-24">
      <img src={movie.backdropUrl ?? ''} srcSet={srcSetFor(movie.backdropUrl, 'backdrop')} sizes="100vw" alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover opacity-60" fetchPriority="high" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/80 to-bg/30" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg/90 via-bg/40 to-transparent" aria-hidden />
      <div className="container-page grid gap-6 pt-6 pb-10 sm:grid-cols-[200px_1fr] sm:gap-8 lg:grid-cols-[260px_1fr] lg:pt-14 lg:pb-14">
        <img src={movie.posterUrl ?? ''} srcSet={srcSetFor(movie.posterUrl, 'poster')} sizes="260px" alt={`${movie.title} poster`} className="mx-auto aspect-[2/3] w-44 rounded-xl object-cover shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/10 sm:mx-0 sm:w-full" />
        <div className="min-w-0 self-end">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Badge tone={movie.rightsBasis === 'PLATFORM_ORIGINAL' ? 'red' : 'outline'}>{RIGHTS_LABEL[movie.rightsBasis]}</Badge>
            {movie.source === 'internet_archive' && <Badge tone="outline">Internet Archive</Badge>}
            {movie.type === 'SERIES' && <Badge>Series</Badge>}
            {movie.isNew && <Badge tone="red">New</Badge>}
            {movie.isTrending && <Badge tone="gold">Trending</Badge>}
            {movie.downloadQualities.map((q) => <Badge key={q} tone="outline">{q === '2160p' ? '4K' : q}</Badge>)}
          </div>
          <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">{movie.title}</h1>
          {movie.originalTitle && movie.originalTitle !== movie.title && <p className="mt-1 text-sm text-subtle italic">{movie.originalTitle}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
            {movie.rating > 0 && (
              <>
                <Rating value={movie.rating} source={ratingSourceLabel(movie.ratingSource)} />
                <span aria-hidden>·</span>
              </>
            )}
            <span>{movie.year}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatRuntime(movie.runtime)}{movie.type === 'SERIES' && ' / episode'}</span>
            <Badge tone="outline">{movie.ageRating}</Badge>
            <span className="w-full sm:w-auto">{movie.genres.map((g, i) => <span key={g.slug}>{i > 0 && ', '}<Link className="hover:text-white hover:underline" to={`/movies/${g.slug}`}>{g.name}</Link></span>)}</span>
          </div>
          {movie.tagline && <p className="mt-4 font-medium text-white/90">{movie.tagline}</p>}
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted">{movie.description}</p>

          {resume && (
            <div className="mt-5 max-w-sm">
              <div className="flex justify-between text-xs text-subtle"><span>Continue watching</span><span>{Math.round((progress.position / progress.duration) * 100)}%</span></div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-accent" style={{ width: `${(progress.position / progress.duration) * 100}%` }} /></div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2.5">
            {movie.streamable ? (
              <button className="btn-primary px-6" onClick={() => nav(`/watch/${movie.slug}`)}>
                <Play className="size-4 fill-white" /> {resume ? 'Resume' : movie.type === 'SERIES' ? 'Watch episode 1' : 'Watch movie'}
              </button>
            ) : (
              <span className="btn border border-line text-subtle" title="No authorized stream is available">Streaming unavailable</span>
            )}
            {movie.trailerUrl && (
              <button className="btn-dark" onClick={() => setTrailer(true)}>
                <Play className="size-4" /> Trailer
              </button>
            )}
            <a href="#downloads" className="btn-dark" onClick={(e) => { e.preventDefault(); document.getElementById('downloads')?.scrollIntoView({ behavior: 'smooth' }) }}>
              <Download className="size-4" /> {movie.downloadable ? 'Download' : 'Download info'}
            </a>
            <button className="btn-dark" onClick={() => lib.toggleList(movie)} aria-pressed={inList}>
              {inList ? <Check className="size-4" /> : <Plus className="size-4" />} {inList ? 'In My List' : 'My List'}
            </button>
            <button className="btn-icon border border-white/10 bg-black/60" onClick={() => lib.toggleFavorite(movie)} aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}>
              <Heart className={cx('size-5', fav && 'fill-accent text-accent')} />
            </button>
            <button className="btn-icon border border-white/10 bg-black/60" onClick={share} aria-label="Share">
              <Share2 className="size-5" />
            </button>
            <button className="btn-icon border border-white/10 bg-black/60" onClick={async () => { await copyText(`${location.origin}/movie/${movie.slug}`); toast('Link copied to clipboard') }} aria-label="Copy link">
              <Copy className="size-5" />
            </button>
          </div>
        </div>
      </div>
      {trailer && <TrailerModal movie={movie} onClose={() => setTrailer(false)} />}
    </section>
  )
}

function Facts({ movie }: { movie: MovieDetail }) {
  const qualities = movie.files.map((f) => (f.format === 'hls' ? 'Adaptive stream (HLS)' : QUALITY_LABEL[f.quality] ?? f.quality))
  return (
    <aside className="space-y-6" aria-label="Movie information">
      <UserRating movie={movie} />
      <dl className="card divide-y divide-line text-sm">
        <Fact label="Director">{movie.director}</Fact>
        <Fact label="Cast">{movie.cast.map((c, i) => <span key={c}>{i > 0 && ', '}<Link className="hover:text-white hover:underline" to={`/search?q=${encodeURIComponent(c)}`}>{c}</Link></span>)}</Fact>
        {movie.production && <Fact label="Production">{movie.production}</Fact>}
        <Fact label="Country" icon={<Globe className="size-3.5" />}>{movie.country}</Fact>
        <Fact label="Language" icon={<Languages className="size-3.5" />}>{movie.language}</Fact>
        <Fact label="Age rating">{movie.ageRating}</Fact>
        <Fact label="Runtime">{formatRuntime(movie.runtime)}</Fact>
        <Fact label="Available resolutions">{qualities.length ? [...new Set(qualities)].join(', ') : 'None yet'}</Fact>
        <Fact label="Subtitles" icon={<Subtitles className="size-3.5" />}>{movie.subtitles.length ? movie.subtitles.map((s) => s.label).join(', ') : 'None'}</Fact>
        <Fact label="Distribution">{RIGHTS_LABEL[movie.rightsBasis]}</Fact>
        {movie.license && <Fact label="Licence"><a className="underline hover:text-white" href={movie.license} target="_blank" rel="noopener noreferrer">{licenseLabel(movie.license)}</a></Fact>}
        {movie.sourceUrl && <Fact label="Source"><a className="underline hover:text-white" href={movie.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(movie.sourceUrl).hostname.replace(/^www\./, '')}</a></Fact>}
      </dl>
      <Link to={`/report?movie=${movie.slug}`} className="inline-flex items-center gap-2 text-xs text-subtle hover:text-white">
        <Flag className="size-3.5" /> Report this title (copyright, broken file, other)
      </Link>
    </aside>
  )
}

function Fact({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">{icon}{label}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  )
}

function UserRating({ movie }: { movie: MovieDetail }) {
  const { user } = useAuth()
  const { toast } = useUI()
  const qc = useQueryClient()
  const [hover, setHover] = useState(0)
  const [mine, setMine] = useState(movie.myRating ?? 0)
  const [agg, setAgg] = useState(movie.userRating)
  const rate = async (n: number) => {
    try {
      const r = await api.me.rate(movie.id, n)
      setMine(r.myRating)
      setAgg(r.userRating)
      qc.invalidateQueries({ queryKey: ['movie', movie.slug] })
      toast(`You rated ${movie.title} ${n}/10`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{movie.ratingSource === 'TMDB' ? 'TMDB rating' : 'MovieSphere score'}</p>
          <p className="mt-1 text-2xl font-bold"><Rating value={movie.rating} className="text-2xl" source={ratingSourceLabel(movie.ratingSource)} /></p>
          <p className="text-[11px] text-subtle">{movie.ratingSource === 'TMDB' ? 'Community average from TMDB' : movie.rating > 0 ? 'Editorial score (sample data)' : 'No rating available'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Member rating</p>
          <p className="mt-1 text-2xl font-bold">{agg ? agg.average.toFixed(1) : '—'}</p>
          <p className="text-[11px] text-subtle">{agg ? `${agg.count} rating${agg.count === 1 ? '' : 's'}` : 'No ratings yet'}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4">
        {user ? (
          <>
            <p id="rate-label" className="mb-2 text-xs text-muted">{mine ? `Your rating: ${mine}/10` : 'Rate this title'}</p>
            <div className="flex" role="radiogroup" aria-labelledby="rate-label" onMouseLeave={() => setHover(0)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} role="radio" aria-checked={mine === n} aria-label={`${n} out of 10`} className="grid size-7 place-items-center" onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onClick={() => rate(n)}>
                  <Star className={cx('size-5 transition-colors', n <= (hover || mine) ? 'fill-gold text-gold' : 'text-white/25')} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted"><Link to="/login" className="text-white underline underline-offset-4">Sign in</Link> to rate this title.</p>
        )}
      </div>
    </div>
  )
}

function Episodes({ movie }: { movie: MovieDetail }) {
  const seasons = [...new Set(movie.episodes.map((e) => e.season))]
  const [season, setSeason] = useState(seasons[0])
  return (
    <section aria-labelledby="ep-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="ep-title" className="section-title">Episodes</h2>
        {seasons.length > 1 && (
          <div role="tablist" className="flex gap-1">
            {seasons.map((s) => (
              <button key={s} role="tab" aria-selected={s === season} className="chip" aria-pressed={s === season} onClick={() => setSeason(s)}>Season {s}</button>
            ))}
          </div>
        )}
      </div>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {movie.episodes.filter((e) => e.season === season).map((e) => (
          <li key={e.id} className="flex gap-4 bg-card/40 p-4">
            <span className="w-8 shrink-0 text-2xl font-bold text-subtle tabular-nums">{e.number}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{e.title}</h3>
                <span className="shrink-0 text-xs text-subtle">{e.runtime}m</span>
              </div>
              {e.synopsis && <p className="mt-1 text-sm text-muted">{e.synopsis}</p>}
              {e.season === 1 && e.number === 1 && movie.streamable && <p className="mt-2 text-xs text-success">Sample stream available</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
