import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Clock, Loader2, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useDebounced } from '@/lib/hooks'
import { addSearchHistory, clearSearchHistory, getSearchHistory, removeSearchHistory } from '@/lib/searchHistory'
import { Rating } from './ui'

const QUICK = ['Sci-Fi', 'Horror', 'Comedy', 'Buster Keaton', '1927', 'Germany', 'Documentary']

/** Search overlay with debounced live suggestions, keyboard navigation and search history. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(-1)
  const [history, setHistory] = useState(getSearchHistory)
  const debounced = useDebounced(q.trim(), 250)
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const { data, isFetching, isError } = useQuery({
    queryKey: ['suggest', debounced],
    queryFn: ({ signal }) => api.suggest(debounced, signal),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  })
  const items = debounced.length >= 2 ? data?.items ?? [] : []

  useEffect(() => {
    input.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  useEffect(() => setActive(-1), [debounced])

  const submit = (term = q) => {
    if (!term.trim()) return
    addSearchHistory(term)
    onClose()
    nav(`/search?q=${encodeURIComponent(term.trim())}`)
  }
  const open = (slug: string) => {
    addSearchHistory(q)
    onClose()
    nav(`/movie/${slug}`)
  }

  return (
    <div className="fixed inset-0 z-[80] animate-fade-in bg-black/80 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="mx-auto mt-0 w-full max-w-3xl animate-rise border-b border-line bg-surface pt-safe shadow-2xl sm:mt-20 sm:rounded-2xl sm:border">
        <form
          role="search"
          className="flex items-center gap-2 border-b border-line px-3 sm:px-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (active >= 0 && items[active]) open(items[active].slug)
            else submit()
          }}
        >
          <Search className="size-5 shrink-0 text-subtle" aria-hidden />
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
            }}
            placeholder="Titles, people, genres, years, countries…"
            className="h-16 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-subtle sm:text-lg"
            aria-label="Search movies and series"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
          />
          {isFetching && <Loader2 className="size-5 animate-spin text-subtle" aria-label="Searching" />}
          {q && (
            <button type="button" className="btn-icon size-9" onClick={() => { setQ(''); input.current?.focus() }} aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="px-2 text-sm font-semibold text-muted hover:text-white">Cancel</button>
        </form>

        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto p-3 sm:max-h-[60vh] sm:p-4">
          {debounced.length < 2 ? (
            <div className="space-y-6 p-1">
              {history.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="label mb-0">Recent searches</h3>
                    <button className="text-xs font-semibold text-muted hover:text-white" onClick={() => { clearSearchHistory(); setHistory([]) }}>Clear all</button>
                  </div>
                  <ul>
                    {history.map((h) => (
                      <li key={h} className="flex items-center">
                        <button className="flex min-h-11 flex-1 items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-white/5" onClick={() => { setQ(h); submit(h) }}>
                          <Clock className="size-4 text-subtle" aria-hidden /> {h}
                        </button>
                        <button className="btn-icon size-9 text-subtle" aria-label={`Remove “${h}” from history`} onClick={() => { removeSearchHistory(h); setHistory(getSearchHistory()) }}>
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="label">Try searching for</h3>
                <div className="flex flex-wrap gap-2">
                  {QUICK.map((t) => (
                    <button key={t} className="chip" onClick={() => setQ(t)}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : isError ? (
            <p className="p-4 text-sm text-muted">Search is unavailable right now{!navigator.onLine && ' — you’re offline'}.</p>
          ) : items.length === 0 && !isFetching ? (
            <div className="p-4 text-sm text-muted">
              <p className="font-semibold text-white">No results for “{debounced}”.</p>
              <p className="mt-1">Check the spelling, try a director or actor name, a year like “1927”, or browse a genre.</p>
            </div>
          ) : (
            <>
              <ul id={listId} role="listbox" aria-label="Suggestions">
                {items.map((m, idx) => (
                  <li key={m.id} id={`${listId}-${idx}`} role="option" aria-selected={idx === active}>
                    <button onClick={() => open(m.slug)} onMouseEnter={() => setActive(idx)} className={cx('flex w-full items-center gap-3 rounded-lg p-2 text-left', idx === active ? 'bg-white/10' : 'hover:bg-white/5')}>
                      <img src={m.posterUrl ?? ''} alt="" className="h-16 w-11 shrink-0 rounded object-cover" loading="lazy" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{m.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-subtle">
                          {m.year} · {m.type === 'SERIES' ? 'Series' : 'Movie'} · {m.genres.map((g) => g.name).slice(0, 2).join(', ')}
                          {m.originalTitle && m.originalTitle !== m.title ? ` · ${m.originalTitle}` : ''}
                        </span>
                      </span>
                      <Rating value={m.rating} className="text-xs" />
                    </button>
                  </li>
                ))}
              </ul>
              {data && data.total > 0 && (
                <button onClick={() => submit()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-semibold text-muted hover:text-white">
                  See all {data.total} result{data.total === 1 ? '' : 's'} <ArrowRight className="size-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
