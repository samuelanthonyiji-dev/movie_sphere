import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Check, ChevronDown, ChevronUp, Film, Flag, Folder, LayoutDashboard, Loader2, Plus, Search, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { api } from '@/lib/api'
import { cx, timeAgo } from '@/lib/format'
import { useDebounced, useDocumentTitle } from '@/lib/hooks'
import type { Genre } from '@/lib/types'
import { useUI } from '@/state/ui'
import MovieEditor from './MovieEditor'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/movies', label: 'Titles', icon: Film },
  { to: '/admin/genres', label: 'Genres', icon: Folder },
  { to: '/admin/sections', label: 'Homepage', icon: BarChart3 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
]

export default function Admin() {
  useDocumentTitle('Admin dashboard')
  return (
    <div className="container-page pt-20 lg:pt-24">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin</h1>
        <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">Restricted</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Admin" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium', isActive ? 'bg-accent-soft text-white' : 'text-muted hover:bg-white/5 hover:text-white')}>
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="movies" element={<MoviesAdmin />} />
            <Route path="movies/new" element={<MovieEditor />} />
            <Route path="movies/:id" element={<MovieEditor />} />
            <Route path="genres" element={<GenresAdmin />} />
            <Route path="sections" element={<SectionsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="reports" element={<ReportsAdmin />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

interface Stats {
  users: number
  newUsers: number
  movies: number
  series: number
  files: number
  authorizedFiles: number
  downloads: number
  openReports: number
  downloadsByDay: Array<{ date: string; count: number }>
  top: Array<{ title: string; slug: string; downloadCount: number; popularity: number }>
}

function Overview() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.admin.get<Stats>('/stats') })
  if (isLoading || !data) return <div className="skeleton h-64 rounded-2xl" />
  const tiles = [
    ['Users', data.users, `+${data.newUsers} in 14 days`],
    ['Movies', data.movies, `${data.series} series`],
    ['Media files', data.files, `${data.authorizedFiles} authorized`],
    ['Downloads', data.downloads, 'All time (tracked)'],
    ['Open reports', data.openReports, 'Awaiting review'],
  ] as const
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <DownloadsChart data={data.downloadsByDay} />
        <div className="card p-5">
          <h2 className="font-semibold">Most downloaded</h2>
          <ol className="mt-3 divide-y divide-line text-sm">
            {data.top.map((t, i) => (
              <li key={t.slug} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-subtle tabular-nums">{i + 1}</span>
                <Link to={`/movie/${t.slug}`} className="flex-1 truncate hover:underline">{t.title}</Link>
                <span className="text-muted tabular-nums">{t.downloadCount.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-subtle">Counts include seeded sample values.</p>
        </div>
      </div>
    </div>
  )
}

/** Single-series bar chart: one hue, thin rounded bars, per-bar tooltip, table alternative. */
function DownloadsChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <figure className="card p-5">
      <figcaption className="flex items-baseline justify-between">
        <h2 className="font-semibold">Downloads per day</h2>
        <span className="text-xs text-muted">{total} in the last 14 days</span>
      </figcaption>
      <div className="relative mt-6 h-44" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 bottom-0 border-t border-line" aria-hidden />
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/5" aria-hidden />
        <span className="absolute -top-4 right-0 text-[10px] text-subtle tabular-nums" aria-hidden>{max}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden>
          {data.map((d, i) => (
            <div key={d.date} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
              <div className={cx('w-full max-w-5 rounded-t-[4px] transition-opacity', d.count ? 'bg-accent' : 'bg-white/10', hover !== null && hover !== i && 'opacity-50')} style={{ height: `${d.count ? Math.max(3, (d.count / max) * 100) : 1.5}%` }} />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl">
                  <span className="text-muted">{fmt(d.date)}</span> · <strong className="tabular-nums">{d.count}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-subtle" aria-hidden>
        <span>{fmt(data[0].date)}</span>
        <span>{fmt(data[data.length - 1].date)}</span>
      </div>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 w-full">
          <thead><tr><th className="text-left font-semibold">Date</th><th className="text-right font-semibold">Downloads</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.date}><td>{fmt(d.date)}</td><td className="text-right tabular-nums">{d.count}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  )
}

interface AdminMovieRow {
  id: string
  slug: string
  title: string
  type: string
  releaseYear: number
  posterUrl: string | null
  featured: boolean
  isPublished: boolean
  rightsBasis: string
  downloadCount: number
  _count: { files: number }
}

function MoviesAdmin() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q, 300)
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'movies', dq, page], queryFn: () => api.admin.get<{ items: AdminMovieRow[]; total: number; totalPages: number }>(`/movies?q=${encodeURIComponent(dq)}&page=${page}`) })
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input className="field pl-9" placeholder="Search titles" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="Search titles" />
        </div>
        <Link to="/admin/movies/new" className="btn-primary"><Plus className="size-4" /> Add title</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface text-xs tracking-wide text-subtle uppercase">
            <tr><th className="px-4 py-3">Title</th><th className="px-3">Rights</th><th className="px-3">Files</th><th className="px-3">Status</th><th className="px-3 text-right">Downloads</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr>}
            {data?.items.map((m) => (
              <tr key={m.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-2.5">
                  <Link to={`/admin/movies/${m.id}`} className="flex items-center gap-3 hover:underline">
                    <img src={m.posterUrl ?? ''} alt="" className="h-12 w-8 rounded object-cover" loading="lazy" />
                    <span><span className="font-semibold">{m.title}</span> <span className="text-subtle">({m.releaseYear}{m.type === 'SERIES' ? ', series' : ''})</span></span>
                  </Link>
                </td>
                <td className="px-3 text-xs text-muted">{m.rightsBasis.replace(/_/g, ' ').toLowerCase()}</td>
                <td className="px-3 text-muted">{m._count.files}</td>
                <td className="px-3 text-xs">
                  <span className={m.isPublished ? 'text-success' : 'text-subtle'}>{m.isPublished ? 'Published' : 'Draft'}</span>
                  {m.featured && <span className="ml-2 text-gold">Featured</span>}
                </td>
                <td className="px-3 text-right text-muted tabular-nums">{m.downloadCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button className="btn-dark min-h-9" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-muted">Page {page} of {data.totalPages}</span>
          <button className="btn-dark min-h-9" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}

function GenresAdmin() {
  const qc = useQueryClient()
  const { toast, confirm } = useUI()
  const { data } = useQuery({ queryKey: ['genres'], queryFn: api.genres })
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['genres'] })
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      refresh()
      toast(msg)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <div className="max-w-xl">
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api.admin.send('/genres', 'POST', { name }), 'Genre added').then(() => setName('')) }}>
        <input className="field" placeholder="New genre name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} aria-label="New genre name" />
        <button className="btn-primary"><Plus className="size-4" /> Add</button>
      </form>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {data?.map((g: Genre) => (
          <li key={g.id} className="flex items-center gap-3 px-4 py-2">
            {editing?.id === g.id ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api.admin.send(`/genres/${g.id}`, 'PATCH', { name: editing.name }), 'Genre renamed').then(() => setEditing(null)) }}>
                <input className="field" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus aria-label="Genre name" />
                <button className="btn-primary min-h-10"><Check className="size-4" /></button>
              </form>
            ) : (
              <>
                <span className="flex-1">{g.name} <span className="text-xs text-subtle">/{g.slug} · {g.count}</span></span>
                <button className="btn-ghost min-h-9 text-xs" onClick={() => setEditing({ id: g.id, name: g.name })}>Rename</button>
                <button className="btn-icon size-9 text-subtle" aria-label={`Delete ${g.name}`} onClick={async () => { if (await confirm({ title: `Delete genre “${g.name}”?`, message: `It will be removed from ${g.count} title(s).`, destructive: true, confirmLabel: 'Delete' })) run(() => api.admin.send(`/genres/${g.id}`, 'DELETE'), 'Genre deleted') }}>
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Section { id: string; key: string; title: string; enabled: boolean; sortOrder: number }
function SectionsAdmin() {
  const { toast } = useUI()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['admin', 'sections'], queryFn: () => api.admin.get<Section[]>('/sections') })
  const [rows, setRows] = useState<Section[] | null>(null)
  const list = rows ?? data ?? []
  const move = (i: number, d: -1 | 1) => {
    const n = [...list]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    setRows(n)
  }
  const save = async () => {
    try {
      const r = await api.admin.send<Section[]>('/sections', 'PUT', list.map((s, i) => ({ id: s.id, title: s.title, enabled: s.enabled, sortOrder: i })))
      setRows(r)
      qc.invalidateQueries({ queryKey: ['home'] })
      toast('Homepage sections saved')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm text-muted">Reorder, rename or hide homepage carousels. Featured titles (hero) are set per title in the editor.</p>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {list.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-col">
              <button className="btn-icon size-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${s.title} up`}><ChevronUp className="size-4" /></button>
              <button className="btn-icon size-7" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${s.title} down`}><ChevronDown className="size-4" /></button>
            </div>
            <input className="field h-10 min-h-10" value={s.title} onChange={(e) => setRows(list.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} aria-label={`Title for ${s.key}`} />
            <span className="hidden w-32 truncate text-xs text-subtle sm:block">{s.key}</span>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" className="size-4 accent-[#e50914]" checked={s.enabled} onChange={(e) => setRows(list.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)))} /> Show
            </label>
          </li>
        ))}
      </ul>
      <button className="btn-primary mt-4" onClick={save}>Save changes</button>
    </div>
  )
}

interface AdminUser { id: string; username: string; email: string; displayName: string | null; role: 'USER' | 'ADMIN'; createdAt: string; _count: { watchlist: number; downloads: number } }
function UsersAdmin() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const { toast, confirm } = useUI()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['admin', 'users', dq], queryFn: () => api.admin.get<AdminUser[]>(`/users?q=${encodeURIComponent(dq)}`) })
  return (
    <div>
      <input className="field mb-4 max-w-sm" placeholder="Search by email or username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-surface text-xs tracking-wide text-subtle uppercase"><tr><th className="px-4 py-3">User</th><th className="px-3">Joined</th><th className="px-3">List</th><th className="px-3">Downloads</th><th className="px-3">Role</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5"><p className="font-semibold">{u.displayName ?? u.username}</p><p className="text-xs text-subtle">@{u.username} · {u.email}</p></td>
                <td className="px-3 text-xs text-muted">{timeAgo(u.createdAt)}</td>
                <td className="px-3 text-muted">{u._count.watchlist}</td>
                <td className="px-3 text-muted">{u._count.downloads}</td>
                <td className="px-3">
                  <select className="field h-9 min-h-9 w-auto text-xs" value={u.role} aria-label={`Role for ${u.username}`} onChange={async (e) => {
                    const role = e.target.value
                    if (!(await confirm({ title: `Change ${u.username} to ${role}?`, message: role === 'ADMIN' ? 'Admins can edit the catalog, upload media and see user accounts.' : undefined, confirmLabel: 'Change role', destructive: role === 'ADMIN' }))) return
                    try { await api.admin.send(`/users/${u.id}`, 'PATCH', { role }); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast('Role updated') } catch (err) { toast((err as Error).message, 'error') }
                  }}>
                    <option value="USER">User</option><option value="ADMIN">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface Report { id: string; kind: string; movieSlug: string | null; name: string; email: string; message: string; status: string; createdAt: string }
function ReportsAdmin() {
  const qc = useQueryClient()
  const { toast } = useUI()
  const { data } = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api.admin.get<Report[]>('/reports') })
  if (data && !data.length) return <p className="text-sm text-muted">No reports or contact messages yet.</p>
  return (
    <ul className="space-y-3">
      {data?.map((r) => (
        <li key={r.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cx('rounded px-2 py-0.5 font-bold uppercase', r.kind === 'copyright' ? 'bg-accent text-white' : 'bg-white/10')}>{r.kind}</span>
            {r.movieSlug && <Link to={`/movie/${r.movieSlug}`} className="text-muted underline">{r.movieSlug}</Link>}
            <span className="text-subtle">{r.name} &lt;{r.email}&gt; · {timeAgo(r.createdAt)}</span>
            <select className="field ml-auto h-9 min-h-9 w-auto text-xs" value={r.status} aria-label="Report status" onChange={async (e) => {
              try { await api.admin.send(`/reports/${r.id}`, 'PATCH', { status: e.target.value }); qc.invalidateQueries({ queryKey: ['admin', 'reports'] }); toast('Status updated') } catch (err) { toast((err as Error).message, 'error') }
            }}>
              {['open', 'reviewing', 'resolved', 'rejected'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{r.message}</p>
        </li>
      ))}
    </ul>
  )
}
