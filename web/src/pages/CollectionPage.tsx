import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { MovieGrid } from '@/components/MovieGrid'
import { ErrorState } from '@/components/ui'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'

export default function CollectionPage() {
  const { slug = '' } = useParams()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['collection', slug], queryFn: () => api.collection(slug) })
  useDocumentTitle(data?.title, data?.description ?? undefined)
  return (
    <div className="container-page pt-24 lg:pt-28">
      <Link to="/collections" className="text-xs font-semibold tracking-wide text-subtle uppercase hover:text-white">‹ All collections</Link>
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{data?.title ?? <span className="skeleton inline-block h-9 w-64 rounded" />}</h1>
          {data?.description && <p className="mt-2 max-w-2xl text-sm text-muted">{data.description}</p>}
          <div className="mt-8"><MovieGrid items={data?.items ?? []} loading={isLoading} /></div>
        </>
      )}
    </div>
  )
}
