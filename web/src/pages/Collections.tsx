import { useQuery } from '@tanstack/react-query'
import { Library } from 'lucide-react'
import { MovieCarousel } from '@/components/MovieCarousel'
import { ErrorState } from '@/components/ui'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'

export default function Collections() {
  useDocumentTitle('Collections', 'Hand-picked collections of authorized films.')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['collections'], queryFn: api.collections, staleTime: 600_000 })
  return (
    <div className="pt-24 lg:pt-28">
      <div className="container-page mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl"><Library className="size-7 text-accent" aria-hidden /> Collections</h1>
        <p className="mt-2 text-sm text-muted">Curated sets from the MovieSphere catalog.</p>
      </div>
      {error && !data ? <ErrorState error={error} onRetry={() => refetch()} /> : (
        <div className="space-y-10">
          {isLoading && <MovieCarousel title="Loading" items={[]} loading />}
          {data?.map((c) => <MovieCarousel key={c.slug} title={c.title} items={c.items} href={`/collections/${c.slug}`} />)}
        </div>
      )}
    </div>
  )
}
