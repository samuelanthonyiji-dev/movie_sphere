import { Heart, ListVideo, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MovieCard } from '@/components/MovieCard'
import { EmptyState } from '@/components/ui'
import { cx } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { useLibrary } from '@/state/library'
import { useUI } from '@/state/ui'

const SORTS = { added: 'Recently added', title: 'Title A–Z', year: 'Release year', rating: 'Rating' } as const

export default function MyList() {
  useDocumentTitle('My List')
  const lib = useLibrary()
  const { user } = useAuth()
  const { confirm, toast } = useUI()
  const [tab, setTab] = useState<'all' | 'fav'>('all')
  const [sort, setSort] = useState<keyof typeof SORTS>('added')

  const rows = useMemo(() => {
    const r = lib.list.filter((x) => tab === 'all' || x.favorite)
    return [...r].sort((a, b) =>
      sort === 'title' ? a.movie.title.localeCompare(b.movie.title) : sort === 'year' ? b.movie.year - a.movie.year : sort === 'rating' ? b.movie.rating - a.movie.rating : b.addedAt.localeCompare(a.addedAt),
    )
  }, [lib.list, tab, sort])
  const favCount = lib.list.filter((x) => x.favorite).length

  const clearAll = async () => {
    if (!(await confirm({ title: 'Clear My List?', message: `This removes all ${lib.list.length} saved titles${user ? ' from your account' : ' from this device'}.`, confirmLabel: 'Clear list', destructive: true }))) return
    for (const r of [...lib.list]) await lib.removeFromList(r.movie.id).catch(() => {})
    toast('My List cleared', 'info')
  }

  return (
    <div className="container-page pt-24 lg:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl"><ListVideo className="size-7 text-accent" aria-hidden /> My List</h1>
          <p className="mt-2 text-sm text-muted">
            {user ? 'Synced with your account across devices.' : <>Saved on this device. <Link to="/login" className="text-white underline underline-offset-4">Sign in</Link> to sync it to your account.</>}
          </p>
        </div>
        {lib.list.length > 0 && (
          <button className="btn-ghost text-xs" onClick={clearAll}><Trash2 className="size-4" /> Clear list</button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-4">
        <div role="tablist" aria-label="Filter list" className="flex gap-2">
          <button role="tab" aria-selected={tab === 'all'} className="chip" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All <span className="opacity-60">{lib.list.length}</span></button>
          <button role="tab" aria-selected={tab === 'fav'} className="chip" aria-pressed={tab === 'fav'} onClick={() => setTab('fav')}><Heart className="size-3.5" /> Favourites <span className="opacity-60">{favCount}</span></button>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-subtle">
          Sort
          <select className="field h-10 min-h-10 w-auto rounded-full text-xs font-semibold" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {!lib.listReady ? null : rows.length === 0 ? (
        <EmptyState
          icon={tab === 'fav' ? <Heart className="size-7" /> : <ListVideo className="size-7" />}
          title={tab === 'fav' ? 'No favourites yet' : 'Your list is empty'}
          action={<><Link to="/" className="btn-primary">Discover titles</Link><Link to="/categories" className="btn-dark">Browse categories</Link></>}
        >
          {tab === 'fav' ? 'Tap the heart on any title to mark it as a favourite.' : 'Use “My List” or the + button on any title to save it here for later — it works offline, too.'}
        </EmptyState>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 xs:gap-x-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {rows.map((r) => (
            <li key={r.movie.id} className="group/item relative animate-fade-in">
              <MovieCard movie={r.movie} showType />
              <button
                onClick={() => lib.toggleList(r.movie)}
                className={cx('absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-full bg-black/80 text-white ring-1 ring-white/20 transition-opacity hover:bg-accent', '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100')}
                aria-label={`Remove ${r.movie.title} from My List`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
