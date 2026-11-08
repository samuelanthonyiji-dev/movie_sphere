import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Clapperboard, Clock, Flame, Heart, History, Plus, Sparkles, Star, TrendingUp } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroBanner } from '@/components/HeroBanner'
import { MovieCarousel } from '@/components/MovieCarousel'
import { ErrorState } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import type { Genre, MovieCard } from '@/lib/types'
import { useLibrary } from '@/state/library'

const ICONS: Record<string, React.ReactNode> = {
  trending: <TrendingUp className="size-5 text-accent" />,
  popular: <Flame className="size-5 text-accent" />,
  'top-rated': <Star className="size-5 text-accent" />,
  recommended: <Sparkles className="size-5 text-accent" />,
  continue: <Clock className="size-5 text-accent" />,
  featured: <Clapperboard className="size-5 text-accent" />,
}

export default function Home() {
  useDocumentTitle('CineVault — Discover & download authorized movies')
  const lib = useLibrary()
  // Guest personalisation: genre hints from on-device history and list (never sent with identity).
  const likes = useMemo(() => [...new Set([...lib.recent.map((r) => r.movie.slug), ...lib.list.map((r) => r.movie.slug), ...lib.progress.map((p) => p.movie.slug)])].slice(0, 20), [lib.recent, lib.list, lib.progress])
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['home', likes], queryFn: () => api.home(likes), placeholderData: keepPreviousData })

  const continueItems: MovieCard[] = useMemo(
    () =>
      lib.progress
        .filter((p) => p.duration > 0 && p.position > 5 && p.position / p.duration < 0.95)
        .map((p) => ({ ...p.movie, progress: p.position / p.duration })),
    [lib.progress],
  )

  if (error && !data) return <div className="pt-24"><ErrorState error={error} onRetry={() => refetch()} /></div>

  const sections = data?.sections ?? []
  const spotlight = data?.hero.find((m) => m.trailerUrl)

  return (
    <div className="pb-6">
      <HeroBanner items={data?.hero ?? []} />
      <div className="relative z-10 -mt-6 space-y-10 sm:-mt-10 sm:space-y-12">
        <TrendsNow />
        {isLoading && <MovieCarousel title="Loading" items={[]} loading />}
        {sections.map((s, idx) => {
          const items = s.key === 'continue' ? (s.items.length ? s.items : continueItems) : s.items
          return (
            <Fragment key={s.key}>
              <MovieCarousel title={s.title} items={items} href={s.href} icon={ICONS[s.key]} priority={idx < 2} />
              {idx === 4 && spotlight && <Spotlight movie={spotlight} />}
            </Fragment>
          )
        })}
        {lib.recent.length > 2 && <MovieCarousel title="Recently Viewed" icon={<History className="size-5 text-accent" />} items={lib.recent.map((r) => r.movie)} />}
        <CollectionsStrip />
      </div>
    </div>
  )
}

/** "Trends Now" block from the reference design: tabs + genre chips + carousel. */
function TrendsNow() {
  const [tab, setTab] = useState<'popular' | 'latest' | 'added'>('popular')
  const [genres, setGenres] = useState<string[]>([])
  const { data: allGenres } = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 600_000 })
  const { data, isLoading } = useQuery({
    queryKey: ['trends', tab, genres],
    queryFn: () => api.movies({ sort: tab, genre: genres.join(','), limit: 18 }),
    placeholderData: keepPreviousData,
  })
  const tabs = [
    { key: 'popular', label: 'Popular', icon: <Flame className="size-3.5" /> },
    { key: 'latest', label: 'Premieres', icon: <Star className="size-3.5" /> },
    { key: 'added', label: 'Recently added', icon: <Plus className="size-3.5" /> },
  ] as const
  const toggle = (g: Genre) => setGenres((gs) => (gs.includes(g.slug) ? gs.filter((x) => x !== g.slug) : [...gs, g.slug]))

  return (
    <section aria-labelledby="trends-title" className="pt-2">
      <div className="container-page">
        <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="trends-title" className="section-title text-xl sm:text-2xl">
            <TrendingUp className="size-6 text-accent" aria-hidden />
            <span className="relative">Trends Now<span className="absolute -bottom-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent" aria-hidden /></span>
          </h2>
          <div role="tablist" aria-label="Sort trends" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors', tab === t.key ? 'bg-white/10 text-white' : 'text-subtle hover:text-white')}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by genre">
          {(allGenres ?? []).filter((g) => g.count > 0).map((g) => (
            <button key={g.slug} className="chip" aria-pressed={genres.includes(g.slug)} onClick={() => toggle(g)}>
              {g.name}
            </button>
          ))}
          {genres.length > 0 && <button className="chip border-transparent bg-transparent underline" onClick={() => setGenres([])}>Reset</button>}
        </div>
      </div>
      <div className="mt-5">
        {!isLoading && data?.items.length === 0 ? (
          <p className="container-page py-10 text-sm text-muted">No titles match all of those genres. Try removing one.</p>
        ) : (
          <MovieCarousel title={tabs.find((t) => t.key === tab)!.label} items={data?.items ?? []} loading={isLoading} href={`/movies?sort=${tab}${genres.length ? `&genre=${genres.join(',')}` : ''}`} />
        )}
      </div>
    </section>
  )
}

function Spotlight({ movie }: { movie: MovieCard }) {
  const lib = useLibrary()
  const fav = lib.isFavorite(movie.id)
  return (
    <section className="container-page" aria-labelledby="spotlight-title">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-black shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 to-transparent p-4 sm:p-6">
          <div>
            <h2 id="spotlight-title" className="text-lg font-bold sm:text-2xl">{movie.title} ({movie.year})</h2>
            <p className="mt-1 text-xs text-muted">Trailer spotlight · press play to start</p>
          </div>
          <div className="pointer-events-auto flex gap-1">
            <button className="btn-icon" aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} onClick={() => lib.toggleFavorite(movie)}>
              <Heart className={cx('size-5', fav && 'fill-accent text-accent')} />
            </button>
            <Link to={`/movie/${movie.slug}`} className="btn-icon" aria-label={`Open ${movie.title}`}>
              <Plus className="size-5" />
            </Link>
          </div>
        </div>
        <VideoPlayer className="aspect-video max-h-[70vh] w-full" title={`${movie.title} — Trailer`} poster={movie.backdropUrl} sources={[{ id: 't', label: 'Auto', url: movie.trailerUrl!, kind: 'mp4' }]} />
      </div>
    </section>
  )
}

function CollectionsStrip() {
  const { data } = useQuery({ queryKey: ['collections'], queryFn: api.collections, staleTime: 600_000 })
  if (!data?.length) return null
  return (
    <section className="container-page" aria-labelledby="collections-title">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="collections-title" className="section-title">Collections</h2>
        <Link to="/collections" className="text-xs font-semibold tracking-wide text-muted uppercase hover:text-white">View all ›</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.map((c) => (
          <Link key={c.slug} to={`/collections/${c.slug}`} className="group relative h-36 overflow-hidden rounded-xl border border-line bg-card p-4">
            <div className="absolute inset-y-0 right-0 flex translate-x-6 items-center gap-0 transition-transform duration-500 group-hover:translate-x-2">
              {c.items.slice(0, 3).map((m, i) => (
                <img key={m.id} src={m.posterUrl ?? ''} alt="" loading="lazy" className="h-28 w-[75px] rounded-md object-cover shadow-xl ring-1 ring-black" style={{ transform: `rotate(${(i - 1) * 6}deg)`, marginLeft: i ? -28 : 0, zIndex: 3 - i }} />
              ))}
            </div>
            <div className="relative z-10 flex h-full max-w-[55%] flex-col justify-end">
              <h3 className="text-base leading-tight font-bold">{c.title}</h3>
              <p className="mt-1 text-xs text-subtle">{c.items.length} titles</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
