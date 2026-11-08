import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { MovieCard as Movie } from '@/lib/types'
import { MovieCard } from './MovieCard'
import { PosterSkeleton, SectionHeader } from './ui'

/**
 * Horizontal carousel: native scroll-snap (swipe on touch), arrow buttons on desktop,
 * keyboard reachable (every card is focusable), lazily rendered images.
 */
export function MovieCarousel({ title, items, href, icon, loading, priority, extra }: { title: string; items: Movie[]; href?: string | null; icon?: ReactNode; loading?: boolean; priority?: boolean; extra?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
  }, [])
  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, items.length])

  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  if (!loading && !items.length) return null
  const id = `row-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section className="relative" aria-labelledby={id}>
      <div className="container-page">
        <div id={id}>
          <SectionHeader title={title} icon={icon} href={href}>{extra}</SectionHeader>
        </div>
      </div>
      <div className="group/row relative">
        <div
          ref={ref}
          onScroll={update}
          className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-2 pb-3 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:scroll-px-10 lg:px-10 3xl:px-16"
          role="list"
        >
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="w-[38vw] shrink-0 xs:w-[34vw] sm:w-[180px] xl:w-[196px] 3xl:w-[220px]">
                  <PosterSkeleton />
                </div>
              ))
            : items.map((m, i) => (
                <div key={m.id} role="listitem" className="w-[38vw] shrink-0 snap-start xs:w-[34vw] sm:w-[180px] xl:w-[196px] 3xl:w-[220px]">
                  <MovieCard movie={m} priority={priority && i < 6} showType />
                </div>
              ))}
        </div>
        {!edges.start && (
          <button aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)} className="absolute top-2 bottom-16 left-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-bg to-transparent text-white opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 md:flex">
            <ChevronLeft className="size-8" />
          </button>
        )}
        {!edges.end && (
          <button aria-label={`Scroll ${title} right`} onClick={() => scroll(1)} className="absolute top-2 right-0 bottom-16 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-bg to-transparent text-white opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 md:flex">
            <ChevronRight className="size-8" />
          </button>
        )}
      </div>
    </section>
  )
}
