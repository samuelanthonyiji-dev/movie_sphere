import { X } from 'lucide-react'
import type { MovieCard } from '@/lib/types'
import { Modal } from '@/state/ui'
import { VideoPlayer } from './VideoPlayer'

export function TrailerModal({ movie, onClose }: { movie: Pick<MovieCard, 'title' | 'trailerUrl' | 'backdropUrl'>; onClose: () => void }) {
  if (!movie.trailerUrl) return null
  const external = /^https?:\/\//.test(movie.trailerUrl)
  return (
    <Modal onClose={onClose} size="xl" bare labelledBy="trailer-title">
      <div className="overflow-hidden rounded-none bg-black sm:rounded-2xl sm:border sm:border-line">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 id="trailer-title" className="truncate font-semibold">{movie.title} — Trailer</h2>
          <button className="btn-icon -mr-2" onClick={onClose} aria-label="Close trailer">
            <X className="size-5" />
          </button>
        </div>
        {external ? (
          <div className="p-6 text-sm text-muted">
            This trailer is hosted externally.{' '}
            <a className="text-white underline" href={movie.trailerUrl} target="_blank" rel="noopener noreferrer">Open trailer in a new tab</a>
          </div>
        ) : (
          <VideoPlayer className="aspect-video w-full" title={`${movie.title} — Trailer`} poster={movie.backdropUrl} sources={[{ id: 'trailer', label: 'Auto', url: movie.trailerUrl, kind: 'mp4' }]} />
        )}
      </div>
    </Modal>
  )
}
