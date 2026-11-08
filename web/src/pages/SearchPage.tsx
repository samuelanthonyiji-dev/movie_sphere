import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar, GenreChips, type Filters } from '@/components/CategoryFilter'
import { MovieGrid } from '@/components/MovieGrid'
import { EmptyState, ErrorState } from '@/components/ui'
import { api } from '@/lib/api'
import { useDebounced, useDocumentTitle, useInView } from '@/lib/hooks'
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/searchHistory'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const debounced = useDebounced(q.trim(), 300)
  const [history, setHistory] = useState(getSearchHistory)
  useDocumentTitle(debounced ? `Search: ${debounced}` : 'Search')

  const filters: Filters = {
    genre: params.get('genre')?.split(',').filter(Boolean) ?? [],
    year: params.get('year') ?? '',
    country: params.get('country') ?? '',
    language: params.get('language') ?? '',
    minRating: params.get('minRating') ?? '',
    quality: params.get('quality') ?? '',
    type: params.get('type') ?? '',
    recent: params.get('recent') ?? '',
    downloadable: params.get('downloadable') ?? '',
    sort: params.get('sort') ?? 'popular',
  }
  const decade = params.get('decade') ?? ''

  // keep URL in sync with the debounced query
  useEffect(() => {
    const p = new URLSearchParams(params)
    if (debounced) p.set('q', debounced)
    else p.delete('q')
    if (p.toString() !== params.toString()) setParams(p, { replace: true })
    if (debounced.length >= 2) {
      const t = setTimeout(() => { addSearchHistory(debounced); setHistory(getSearchHistory()) }, 1500)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const update = (patch: Partial<Filters>) => {
    const n = { ...filters, ...patch }
    const p = new URLSearchParams()
    if (debounced) p.set('q', debounced)
    if (decade) p.set('decade', decade)
    if (n.genre.length) p.set('genre', n.genre.join(','))
    for (const k of ['year', 'country', 'language', 'minRating', 'quality', 'type', 'recent', 'downloadable'] as const) if (n[k]) p.set(k, n[k])
    if (n.sort !== 'popular') p.set('sort', n.sort)
    setParams(p, { replace: true })
  }

  const active = debounced.length > 0 || filters.genre.length > 0 || !!decade || !!filters.year
  const query = { ...filters, genre: filters.genre.join(','), q: debounced, decade, limit: 24 }
  const r = useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam }) => api.movies({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (l) => (l.page < l.totalPages ? l.page + 1 : undefined),
    enabled: active,
    placeholderData: keepPreviousData,
  })
  const items = r.data?.pages.flatMap((p) => p.items) ?? []
  const total = r.data?.pages[0]?.total
  const [sentinel, inView] = useInView<HTMLDivElement>()
  useEffect(() => {
    if (inView && r.hasNextPage && !r.isFetchingNextPage) r.fetchNextPage()
  }, [inView, r])

  return (
    <div className="container-page pt-24 lg:pt-28">
      <h1 className="sr-only">Search</h1>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, director, actor, genre, year, country or language"
          className="field h-14 rounded-full pr-24 pl-12 text-base"
          aria-label="Search the catalog"
          enterKeyHint="search"
        />
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
          {r.isFetching && <Loader2 className="size-5 animate-spin text-subtle" aria-label="Searching" />}
          {q && (
            <button type="button" className="btn-icon size-9" onClick={() => setQ('')} aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
      </form>

      <div className="mt-5 space-y-4">
        <GenreChips value={filters.genre} onChange={(genre) => update({ genre })} />
        {active && <FilterBar value={filters} onChange={update} onReset={() => setParams(debounced ? { q: debounced } : {}, { replace: true })} total={total} />}
        {decade && <p className="text-xs text-muted">Showing the {decade}s · <button className="underline" onClick={() => { const p = new URLSearchParams(params); p.delete('decade'); setParams(p) }}>remove</button></p>}
      </div>

      <div className="mt-8">
        {!active ? (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="label mb-0">Recent searches</h2>
                {history.length > 0 && <button className="text-xs font-semibold text-muted hover:text-white" onClick={() => { clearSearchHistory(); setHistory([]) }}>Clear</button>}
              </div>
              {history.length ? (
                <div className="flex flex-wrap gap-2">{history.map((h) => <button key={h} className="chip" onClick={() => setQ(h)}>{h}</button>)}</div>
              ) : (
                <p className="text-sm text-subtle">Your searches will appear here (stored on this device only).</p>
              )}
            </div>
            <div>
              <h2 className="label">Popular searches</h2>
              <div className="flex flex-wrap gap-2">
                {['Chaplin', 'Silent', 'Fritz Lang', 'Thriller', 'Korean', 'Animation', '2026'].map((t) => <button key={t} className="chip" onClick={() => setQ(t)}>{t}</button>)}
              </div>
            </div>
          </div>
        ) : r.error && !items.length ? (
          <ErrorState error={r.error} onRetry={() => r.refetch()} />
        ) : !r.isLoading && items.length === 0 ? (
          <EmptyState icon={<Search className="size-7" />} title={debounced ? `No results for “${debounced}”` : 'No matching titles'} action={<><Link to="/categories" className="btn-primary">Browse categories</Link><Link to="/movies?sort=rating" className="btn-dark">Top rated</Link></>}>
            Check the spelling, search for a person (e.g. “Keaton”), a country (“France”), a language or a year (“1927”), or remove some filters.
          </EmptyState>
        ) : (
          <>
            {total !== undefined && debounced && <p className="mb-4 text-sm text-muted" aria-live="polite">{total} result{total === 1 ? '' : 's'} for <strong className="text-white">“{debounced}”</strong></p>}
            <MovieGrid items={items} loading={r.isLoading || r.isFetchingNextPage} />
          </>
        )}
        <div ref={sentinel} className="h-px" />
      </div>
    </div>
  )
}
