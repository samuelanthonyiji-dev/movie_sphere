import type { MovieCard as Movie } from '@/lib/types'
import { MovieCard } from './MovieCard'
import { PosterSkeleton } from './ui'

export function MovieGrid({ items, loading, skeletons = 12 }: { items: Movie[]; loading?: boolean; skeletons?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 xs:gap-x-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-8" role="list">
      {items.map((m) => (
        <div role="listitem" key={m.id} className="animate-fade-in">
          <MovieCard movie={m} showType />
        </div>
      ))}
      {loading && Array.from({ length: skeletons }, (_, i) => <PosterSkeleton key={`s${i}`} />)}
    </div>
  )
}
