import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Film } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FilterBar, GenreChips, type Filters } from '@/components/CategoryFilter'
import { MovieGrid } from '@/components/MovieGrid'
import { EmptyState, ErrorState } from '@/components/ui'
import { api } from '@/lib/api'
import { useDocumentTitle, useInView } from '@/lib/hooks'

type Mode = 'movies' | 'series' | 'latest' | 'trending'
const META: Record<Mode, { title: string; sort: string; type: string; blurb: string }> = {
  movies: { title: 'Movies', sort: 'popular', type: 'movie', blurb: 'Feature films from public-domain classics to MovieSphere Originals.' },
  series: { title: 'TV Series', sort: 'popular', type: 'series', blurb: 'Episodic stories to settle into.' },
  latest: { title: 'Latest releases', sort: 'latest', type: '', blurb: 'The newest titles by release year.' },
  trending: { title: 'Trending', sort: 'popular', type: '', blurb: 'What people are watching and saving right now.' },
}

export default function Browse({ mode }: { mode: Mode }) {
  const { facet } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const meta = META[mode]
  const { data: genres } = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 600_000 })

  // /movies/2026 → year facet, /movies/action → genre facet
  const facetYear = facet && /^\d{4}$/.test(facet) ? facet : ''
  const facetGenre = facet && !facetYear ? facet : ''
  const filters: Filters = {
    genre: [...new Set([facetGenre, ...(params.get('genre')?.split(',') ?? [])].filter(Boolean))],
    year: params.get('year') ?? facetYear,
    country: params.get('country') ?? '',
    language: params.get('language') ?? '',
    minRating: params.get('minRating') ?? '',
    quality: params.get('quality') ?? '',
    type: params.get('type') ?? meta.type,
    recent: params.get('recent') === '1' ? '1' : '',
    downloadable: params.get('downloadable') ?? '',
    sort: params.get('sort') ?? meta.sort,
  }

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }
    const p = new URLSearchParams()
    if (next.genre.length) p.set('genre', next.genre.join(','))
    for (const k of ['year', 'country', 'language', 'minRating', 'quality', 'recent', 'downloadable'] as const) if (next[k]) p.set(k, next[k])
    if (next.type !== meta.type) p.set('type', next.type || 'all')
    if (next.sort !== meta.sort) p.set('sort', next.sort)
    // Leaving a facet URL (e.g. /movies/action) once filters diverge from it.
    const base = mode === 'movies' ? '/movies' : `/${mode}`
    if (facet) nav(`${base}?${p}`, { replace: true })
    else setParams(p, { replace: true })
  }
  const reset = () => (facet ? nav(mode === 'movies' ? '/movies' : `/${mode}`) : setParams({}, { replace: true }))

  const query = useMemo(
    () => ({
      genre: filters.genre.join(','),
      year: filters.year,
      country: filters.country,
      language: filters.language,
      minRating: filters.minRating,
      quality: filters.quality,
      type: filters.type === 'all' ? '' : filters.type,
      recent: filters.recent,
      downloadable: filters.downloadable,
      sort: filters.sort,
      limit: 24,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString(), facet, mode],
  )

  const q = useInfiniteQuery({
    queryKey: ['browse', query],
    queryFn: ({ pageParam }) => api.movies({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  })
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const total = q.data?.pages[0]?.total

  const [sentinel, inView] = useInView<HTMLDivElement>()
  useEffect(() => {
    if (inView && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage()
  }, [inView, q])

  const genreName = filters.genre.length === 1 ? genres?.find((g) => g.slug === filters.genre[0])?.name : undefined
  const title = facetGenre && genreName ? `${genreName} ${mode === 'series' ? 'Series' : 'Movies'}` : facetYear ? `${meta.title} from ${facetYear}` : meta.title
  useDocumentTitle(title, `${meta.blurb} Browse, filter and download authorized titles on MovieSphere.`)

  return (
    <div className="container-page pt-24 lg:pt-28">
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Film className="size-7 text-accent" aria-hidden /> {title}
        </h1>
        <p className="mt-2 text-sm text-muted">{meta.blurb}</p>
      </header>
      <div className="space-y-4 border-y border-line py-5">
        <GenreChips value={filters.genre} onChange={(genre) => update({ genre })} />
        <FilterBar value={filters} onChange={update} onReset={reset} total={total} hideType={mode === 'movies' || mode === 'series'} />
      </div>
      <div className="mt-8">
        {q.error && !items.length ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.isLoading && items.length === 0 ? (
          <EmptyState icon={<Film className="size-7" />} title="No titles match these filters" action={<button className="btn-primary" onClick={reset}>Reset filters</button>}>
            Try a broader year, lower the minimum rating, or remove a genre.
          </EmptyState>
        ) : (
          <MovieGrid items={items} loading={q.isLoading || q.isFetchingNextPage} skeletons={q.isLoading ? 12 : 6} />
        )}
        <div ref={sentinel} className="h-px" />
        {q.hasNextPage && !q.isFetchingNextPage && (
          <div className="mt-8 flex justify-center">
            <button className="btn-dark" onClick={() => q.fetchNextPage()}>Load more</button>
          </div>
        )}
      </div>
    </div>
  )
}
