import { useQuery } from '@tanstack/react-query'
import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/ui'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'

const TINTS = ['#e50914', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316']

export default function Categories() {
  useDocumentTitle('Categories', 'Browse movies and series by genre, decade and collection.')
  const { data, error, refetch } = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 600_000 })
  const { data: facets } = useQuery({ queryKey: ['facets'], queryFn: api.facets, staleTime: 600_000 })
  const decades = [...new Set((facets?.years ?? []).map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a)

  return (
    <div className="container-page pt-24 lg:pt-28">
      <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
        <LayoutGrid className="size-7 text-accent" aria-hidden /> Categories
      </h1>
      <p className="mt-2 text-sm text-muted">Pick a genre to start exploring. Every filter combines on the next page.</p>
      {error && !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(data ?? Array.from({ length: 17 }, () => null)).map((g, i) =>
            g ? (
              <li key={g.slug}>
                <Link to={`/movies/${g.slug}`} className="group relative flex h-28 flex-col justify-end overflow-hidden rounded-xl border border-line bg-card p-4 transition-colors hover:border-white/25 sm:h-32">
                  <span className="absolute -top-8 -right-8 size-28 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-50" style={{ background: TINTS[i % TINTS.length] }} aria-hidden />
                  <span className="relative text-lg font-bold">{g.name}</span>
                  <span className="relative text-xs text-subtle">{g.count} title{g.count === 1 ? '' : 's'}</span>
                </Link>
              </li>
            ) : (
              <li key={i} className="skeleton h-28 rounded-xl sm:h-32" />
            ),
          )}
        </ul>
      )}
      {decades.length > 0 && (
        <section className="mt-12" aria-labelledby="decades">
          <h2 id="decades" className="section-title mb-4">By decade</h2>
          <div className="flex flex-wrap gap-2">
            {decades.map((d) => (
              <Link key={d} to={`/search?decade=${d}&sort=latest`} className="chip h-11 px-5 text-sm">
                {d}s
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="mt-12" aria-labelledby="more">
        <h2 id="more" className="section-title mb-4">More ways to browse</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/series" className="chip h-11 px-5 text-sm">TV Series</Link>
          <Link to="/collections" className="chip h-11 px-5 text-sm">Collections</Link>
          <Link to="/movies?downloadable=1" className="chip h-11 px-5 text-sm">Downloadable now</Link>
          <Link to="/movies?sort=added&recent=1" className="chip h-11 px-5 text-sm">Recently added</Link>
          <Link to="/movies?sort=rating" className="chip h-11 px-5 text-sm">Top rated</Link>
        </div>
      </section>
    </div>
  )
}
