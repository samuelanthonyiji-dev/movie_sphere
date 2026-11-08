import { useQuery } from '@tanstack/react-query'
import { ChevronDown, RotateCcw, SlidersHorizontal, Star, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'

export interface Filters {
  genre: string[]
  year: string
  country: string
  language: string
  minRating: string
  quality: string
  type: string
  recent: string
  downloadable: string
  sort: string
}

export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'az', label: 'A–Z' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'added', label: 'Recently added' },
]

export function activeFilterCount(f: Filters, ignore: Array<keyof Filters> = []) {
  let n = 0
  for (const k of ['year', 'country', 'language', 'minRating', 'quality', 'recent', 'downloadable'] as const) if (f[k] && !ignore.includes(k)) n++
  if (!ignore.includes('genre')) n += f.genre.length
  if (f.type && !ignore.includes('type')) n++
  return n
}

/** Genre chip row (multi-select). */
export function GenreChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { data } = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 600_000 })
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Genres">
      {(data ?? Array.from({ length: 10 }, (_, i) => ({ slug: `s${i}`, name: '', count: 1, id: '' }))).map((g) =>
        g.name ? (
          <button key={g.slug} className="chip" aria-pressed={value.includes(g.slug)} onClick={() => onChange(value.includes(g.slug) ? value.filter((x) => x !== g.slug) : [...value, g.slug])}>
            {g.name}
            <span className="text-[10px] opacity-60">{g.count}</span>
          </button>
        ) : (
          <span key={g.slug} className="skeleton h-9 w-20 shrink-0 rounded-full" />
        ),
      )}
    </div>
  )
}

function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; className?: string }) {
  return (
    <label className={cx('relative block', className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-10 min-h-10 appearance-none rounded-full pr-9 text-xs font-semibold" aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
    </label>
  )
}

/** Toolbar (sort / year / rating) + expandable advanced filter panel. All filters combine. */
export function FilterBar({ value, onChange, onReset, total, hideType }: { value: Filters; onChange: (patch: Partial<Filters>) => void; onReset: () => void; total?: number; hideType?: boolean }) {
  const [open, setOpen] = useState(false)
  const { data: facets } = useQuery({ queryKey: ['facets'], queryFn: api.facets, staleTime: 600_000 })
  const count = activeFilterCount(value, hideType ? ['type'] : [])
  const rating = Number(value.minRating || 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden text-xs font-semibold text-subtle sm:inline">Sort by:</span>
        <div className="no-scrollbar hidden gap-2 lg:flex">
          {SORT_OPTIONS.slice(0, 6).map((s) => (
            <button key={s.value} className="chip" aria-pressed={value.sort === s.value} onClick={() => onChange({ sort: s.value })}>{s.label}</button>
          ))}
        </div>
        <Select className="lg:hidden" label="Sort by" value={value.sort} onChange={(sort) => onChange({ sort })} options={SORT_OPTIONS} />
        <Select label="Release year" value={value.year} onChange={(year) => onChange({ year })} options={[{ value: '', label: 'Any year' }, ...(facets?.years ?? []).map((y) => ({ value: String(y), label: String(y) }))]} />
        <button className={cx('chip h-10', count > 0 && 'border-white/40 text-white')} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="filter-panel">
          <SlidersHorizontal className="size-4" /> Filters {count > 0 && <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] text-white">{count}</span>}
        </button>
        <div className="ml-auto flex w-full items-center gap-3 sm:w-auto">
          <Star className="size-4 shrink-0 fill-gold text-gold" aria-hidden />
          <input
            type="range"
            className="range w-full sm:w-36"
            min={0}
            max={9}
            step={0.5}
            value={rating}
            style={{ ['--fill' as string]: `${(rating / 9) * 100}%` }}
            onChange={(e) => onChange({ minRating: e.target.value === '0' ? '' : e.target.value })}
            aria-label="Minimum rating"
            aria-valuetext={rating ? `${rating} or higher` : 'Any rating'}
          />
          <span className="w-10 text-right text-xs font-semibold tabular-nums">{rating ? `${rating.toFixed(1)}+` : 'Any'}</span>
        </div>
      </div>

      {open && (
        <div id="filter-panel" className="card grid animate-rise gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="label">Country</span>
            <Select label="Country" value={value.country} onChange={(country) => onChange({ country })} options={[{ value: '', label: 'Any country' }, ...(facets?.countries ?? []).map((c) => ({ value: c, label: c }))]} />
          </div>
          <div>
            <span className="label">Language</span>
            <Select label="Language" value={value.language} onChange={(language) => onChange({ language })} options={[{ value: '', label: 'Any language' }, ...(facets?.languages ?? []).map((c) => ({ value: c, label: c }))]} />
          </div>
          <div>
            <span className="label">Download quality</span>
            <Select label="Video quality" value={value.quality} onChange={(quality) => onChange({ quality })} options={[{ value: '', label: 'Any quality' }, { value: '480p', label: '480p' }, { value: '720p', label: '720p HD' }, { value: '1080p', label: '1080p Full HD' }, { value: '2160p', label: '4K UHD' }]} />
          </div>
          {!hideType && (
            <div>
              <span className="label">Type</span>
              <Select label="Movie or TV series" value={value.type} onChange={(type) => onChange({ type })} options={[{ value: '', label: 'Movies & series' }, { value: 'movie', label: 'Movies' }, { value: 'series', label: 'TV series' }]} />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button className="chip" aria-pressed={value.recent === '1'} onClick={() => onChange({ recent: value.recent === '1' ? '' : '1' })}>Added in last 30 days</button>
            <button className="chip" aria-pressed={value.downloadable === '1'} onClick={() => onChange({ downloadable: value.downloadable === '1' ? '' : '1' })}>Downloadable only</button>
            <button className="btn-ghost ml-auto min-h-9 text-xs" onClick={onReset}>
              <RotateCcw className="size-3.5" /> Reset filters
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-6 flex-wrap items-center gap-2 text-xs text-subtle" aria-live="polite">
        {total !== undefined && <span><strong className="text-white">{total}</strong> title{total === 1 ? '' : 's'}</span>}
        {count > 0 && (
          <>
            <span aria-hidden>·</span>
            <button className="inline-flex items-center gap-1 font-semibold text-muted hover:text-white" onClick={onReset}>
              <X className="size-3.5" /> Clear {count} filter{count > 1 ? 's' : ''}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
