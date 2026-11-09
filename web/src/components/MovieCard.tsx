import { Check, Download, Heart, Info, Play, Plus } from 'lucide-react'
import { memo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cx, qualityBadge, ratingSourceLabel, srcSetFor } from '@/lib/format'
import type { MovieCard as Movie } from '@/lib/types'
import { useLibrary } from '@/state/library'
import { Badge, Rating } from './ui'

export const MovieCard = memo(function MovieCard({ movie, className, priority, showType }: { movie: Movie; className?: string; priority?: boolean; showType?: boolean }) {
  const lib = useLibrary()
  const nav = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const inList = lib.inList(movie.id)
  const fav = lib.isFavorite(movie.id)
  const href = `/movie/${movie.slug}`
  const genre = movie.genres[0]?.name

  return (
    <article className={cx('group/card relative w-full', className)} aria-label={`${movie.title} (${movie.year})`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] ring-1 ring-white/5 transition-[transform,box-shadow] duration-300 group-hover/card:shadow-[0_18px_40px_-12px_rgb(0_0_0/0.9)] motion-safe:group-hover/card:-translate-y-1 [@media(hover:hover)]:group-hover/card:ring-white/20">
        <Link to={href} className="absolute inset-0 z-[1]" aria-label={`Open details for ${movie.title}`} />
        {!loaded && <div className="skeleton absolute inset-0" aria-hidden />}
        {movie.posterUrl && (
          <img
            src={movie.posterUrl}
            srcSet={srcSetFor(movie.posterUrl, 'poster')}
            sizes="(min-width:1280px) 200px, (min-width:640px) 180px, 45vw"
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cx('size-full object-cover transition-[opacity,transform] duration-500 motion-safe:group-hover/card:scale-[1.04]', loaded ? 'opacity-100' : 'opacity-0')}
          />
        )}
        <div className="pointer-events-none absolute top-2 left-2 z-[2] flex flex-col items-start gap-1">
          {movie.isNew && <Badge tone="red">New</Badge>}
          {movie.isTrending && <Badge tone="gold">Trending</Badge>}
          {showType && movie.type === 'SERIES' && <Badge>Series</Badge>}
        </div>
        {movie.topQuality && (
          <div className="pointer-events-none absolute top-2 right-2 z-[2]">
            <Badge>{qualityBadge(movie.topQuality)}</Badge>
          </div>
        )}
        {movie.progress !== undefined && movie.progress > 0 && (
          <div className="absolute inset-x-2 bottom-2 z-[2] h-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Watched" aria-valuenow={Math.round(movie.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent" style={{ width: `${Math.round(movie.progress * 100)}%` }} />
          </div>
        )}
        {/* Desktop hover layer with quick actions */}
        <div className="pointer-events-none absolute inset-0 z-[3] hidden flex-col justify-end bg-gradient-to-t from-black via-black/70 to-transparent p-3 opacity-0 transition-opacity duration-300 group-focus-within/card:opacity-100 group-hover/card:opacity-100 [@media(hover:hover)]:flex">
          <p className="line-clamp-3 text-[11px] leading-4 text-white/80">{movie.description}</p>
          <div className="pointer-events-auto mt-2.5 flex items-center gap-1.5">
            <button
              className="grid size-9 place-items-center rounded-full bg-white text-black transition-transform hover:scale-105"
              aria-label={movie.streamable ? `Play ${movie.title}` : `Details for ${movie.title}`}
              onClick={() => nav(movie.streamable ? `/watch/${movie.slug}` : href)}
            >
              {movie.streamable ? <Play className="size-4 fill-black" /> : <Info className="size-4" />}
            </button>
            <button className="grid size-9 place-items-center rounded-full border border-white/40 bg-black/50 hover:border-white" aria-label={inList ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`} aria-pressed={inList} onClick={() => lib.toggleList(movie)}>
              {inList ? <Check className="size-4" /> : <Plus className="size-4" />}
            </button>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-white/80" title={movie.downloadable ? `Download available: ${movie.downloadQualities.join(', ')}` : 'Download currently unavailable'}>
              <Download className={cx('size-3.5', movie.downloadable ? 'text-success' : 'text-white/40')} aria-hidden />
              <span className="sr-only">{movie.downloadable ? 'Download available' : 'Download unavailable'}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-[13px] font-semibold text-white sm:text-sm">
          <Link to={href} className="hover:underline focus-visible:underline">{movie.title}</Link>
        </h3>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-subtle sm:text-xs">
          <span>{movie.year}</span>
          {genre && <span className="hidden truncate xs:inline">· {genre}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              className={cx('relative z-[4] -m-1.5 grid size-8 place-items-center rounded-full transition-colors hover:text-white', fav ? 'text-accent' : 'text-subtle')}
              aria-label={fav ? `Remove ${movie.title} from favourites` : `Add ${movie.title} to favourites`}
              aria-pressed={fav}
              onClick={() => lib.toggleFavorite(movie)}
            >
              <Heart className={cx('size-3.5', fav && 'fill-accent')} />
            </button>
            <Download className={cx('mx-1 size-3.5', movie.downloadable ? 'text-success' : 'text-white/20')} aria-label={movie.downloadable ? 'Download available' : 'Download unavailable'} />
            <Rating value={movie.rating} source={ratingSourceLabel(movie.ratingSource)} className="text-[11px] sm:text-xs" />
          </span>
        </div>
      </div>
    </article>
  )
})
