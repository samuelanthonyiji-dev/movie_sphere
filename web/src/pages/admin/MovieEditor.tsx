import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ImageUp, Loader2, Plus, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { useUI } from '@/state/ui'

interface AdminFile { id: string; quality: string; format: string; fileSize: number; language: string; authorizationStatus: 'PENDING' | 'AUTHORIZED' | 'REVOKED'; authorizationNote: string | null; downloadable: boolean; streamable: boolean }
interface AdminMovie {
  id: string; slug: string; type: 'MOVIE' | 'SERIES'; title: string; originalTitle: string | null; tagline: string | null; description: string
  releaseYear: number; runtime: number; rating: number; ageRating: string; country: string; language: string; director: string; cast: string[]
  production: string | null; trailerUrl: string | null; posterUrl: string | null; backdropUrl: string | null; genres: string[]
  rightsBasis: string; rightsNote: string | null; featured: boolean; isPublished: boolean; popularity: number
  files: AdminFile[]; subtitles: Array<{ id: string; language: string; label: string; format: string }>
  episodes: Array<{ id: string; season: number; number: number; title: string; runtime: number }>
}

const EMPTY = {
  type: 'MOVIE', title: '', originalTitle: '', tagline: '', description: '', releaseYear: new Date().getFullYear(), runtime: 90, rating: 7,
  ageRating: 'NR', country: '', language: 'English', director: '', cast: '', production: '', trailerUrl: '', genres: [] as string[],
  rightsBasis: 'METADATA_ONLY', rightsNote: '', featured: false, isPublished: false, popularity: 0,
}
type Form = typeof EMPTY

/** XHR upload so admins see real upload progress for large media files. */
function upload<T>(url: string, fd: FormData, onProgress: (p: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('X-MovieSphere', '1')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      const data = (() => { try { return JSON.parse(xhr.responseText) } catch { return null } })()
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new Error(data?.error ?? `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(fd)
  })
}

export default function MovieEditor() {
  const { id } = useParams()
  const isNew = !id
  const nav = useNavigate()
  const qc = useQueryClient()
  const { toast, confirm } = useUI()
  const { data: genres } = useQuery({ queryKey: ['genres'], queryFn: api.genres })
  const { data: movie, refetch } = useQuery({ queryKey: ['admin', 'movie', id], queryFn: () => api.admin.get<AdminMovie>(`/movies/${id}`), enabled: !isNew })
  const [f, setF] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (movie)
      setF({
        type: movie.type, title: movie.title, originalTitle: movie.originalTitle ?? '', tagline: movie.tagline ?? '', description: movie.description,
        releaseYear: movie.releaseYear, runtime: movie.runtime, rating: movie.rating, ageRating: movie.ageRating, country: movie.country, language: movie.language,
        director: movie.director, cast: movie.cast.join(', '), production: movie.production ?? '', trailerUrl: movie.trailerUrl ?? '', genres: movie.genres,
        rightsBasis: movie.rightsBasis, rightsNote: movie.rightsNote ?? '', featured: movie.featured, isPublished: movie.isPublished, popularity: movie.popularity,
      })
  }, [movie])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body = { ...f, cast: f.cast.split(',').map((c) => c.trim()).filter(Boolean), originalTitle: f.originalTitle || null, tagline: f.tagline || null, production: f.production || null, rightsNote: f.rightsNote || null }
    try {
      const r = isNew ? await api.admin.send<AdminMovie>('/movies', 'POST', body) : await api.admin.send<AdminMovie>(`/movies/${id}`, 'PATCH', body)
      qc.invalidateQueries()
      toast(isNew ? 'Title created — now add artwork and files' : 'Changes saved')
      if (isNew) nav(`/admin/movies/${r.id}`, { replace: true })
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!(await confirm({ title: `Delete “${f.title}”?`, message: 'This permanently deletes the title, its files, subtitles, ratings and list entries. This cannot be undone.', confirmLabel: 'Delete title', destructive: true }))) return
    try {
      await api.admin.send(`/movies/${id}`, 'DELETE')
      qc.invalidateQueries()
      toast('Title deleted', 'info')
      nav('/admin/movies')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/movies" className="text-xs font-semibold text-subtle uppercase hover:text-white">‹ Titles</Link>
        <h2 className="text-xl font-bold">{isNew ? 'Add title' : f.title || 'Edit title'}</h2>
        {movie && <Link to={`/movie/${movie.slug}`} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-white">View page <ExternalLink className="size-3.5" /></Link>}
      </div>

      <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Title *"><input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} required /></Field>
        <Field label="Original title"><input className="field" value={f.originalTitle} onChange={(e) => set('originalTitle', e.target.value)} /></Field>
        <Field label="Type"><select className="field" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="MOVIE">Movie</option><option value="SERIES">TV series</option></select></Field>
        <Field label="Tagline"><input className="field" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
        <Field label="Description *" wide><textarea className="field min-h-28 py-3" value={f.description} onChange={(e) => set('description', e.target.value)} required /></Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2 lg:grid-cols-6">
          <Field label="Year *"><input type="number" className="field" value={f.releaseYear} onChange={(e) => set('releaseYear', Number(e.target.value))} min={1870} max={2100} required /></Field>
          <Field label="Runtime (min) *"><input type="number" className="field" value={f.runtime} onChange={(e) => set('runtime', Number(e.target.value))} min={1} required /></Field>
          <Field label="Score (0–10)"><input type="number" step="0.1" className="field" value={f.rating} onChange={(e) => set('rating', Number(e.target.value))} min={0} max={10} /></Field>
          <Field label="Age rating"><input className="field" value={f.ageRating} onChange={(e) => set('ageRating', e.target.value)} /></Field>
          <Field label="Popularity"><input type="number" className="field" value={f.popularity} onChange={(e) => set('popularity', Number(e.target.value))} min={0} /></Field>
          <Field label="Country *"><input className="field" value={f.country} onChange={(e) => set('country', e.target.value)} required /></Field>
        </div>
        <Field label="Language *"><input className="field" value={f.language} onChange={(e) => set('language', e.target.value)} required /></Field>
        <Field label="Director *"><input className="field" value={f.director} onChange={(e) => set('director', e.target.value)} required /></Field>
        <Field label="Cast (comma separated)"><input className="field" value={f.cast} onChange={(e) => set('cast', e.target.value)} /></Field>
        <Field label="Production"><input className="field" value={f.production} onChange={(e) => set('production', e.target.value)} /></Field>
        <Field label="Trailer URL (https:// or uploaded below)" wide><input className="field" value={f.trailerUrl} onChange={(e) => set('trailerUrl', e.target.value)} placeholder="https://…" /></Field>
        <fieldset className="sm:col-span-2">
          <legend className="label">Genres</legend>
          <div className="flex flex-wrap gap-2">
            {genres?.map((g) => <button type="button" key={g.slug} className="chip" aria-pressed={f.genres.includes(g.slug)} onClick={() => set('genres', f.genres.includes(g.slug) ? f.genres.filter((x) => x !== g.slug) : [...f.genres, g.slug])}>{g.name}</button>)}
          </div>
        </fieldset>
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 sm:col-span-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold"><ShieldAlert className="size-4" /> Copyright & distribution permission</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
            <Field label="Rights basis *">
              <select className="field" value={f.rightsBasis} onChange={(e) => set('rightsBasis', e.target.value)}>
                <option value="METADATA_ONLY">Listing only (no distribution)</option>
                <option value="PUBLIC_DOMAIN">Public domain</option>
                <option value="LICENSED">Licensed</option>
                <option value="CREATOR_AUTHORIZED">Creator / rights-holder authorized</option>
                <option value="PLATFORM_ORIGINAL">Platform original</option>
              </select>
            </Field>
            <Field label="Evidence / licence reference"><input className="field" value={f.rightsNote} onChange={(e) => set('rightsNote', e.target.value)} placeholder="Licence ID, contract, registration search, jurisdiction…" /></Field>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#e50914]" checked={f.isPublished} onChange={(e) => set('isPublished', e.target.checked)} /> Published (visible to users)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#e50914]" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured in homepage hero</label>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className="btn-primary" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} {isNew ? 'Create title' : 'Save changes'}</button>
          {!isNew && <button type="button" className="btn-ghost text-accent" onClick={remove}><Trash2 className="size-4" /> Delete title</button>}
        </div>
      </form>

      {movie && (
        <>
          <Artwork movie={movie} onDone={() => { refetch(); qc.invalidateQueries({ queryKey: ['movie'] }) }} />
          <Files movie={movie} onDone={() => { refetch(); qc.invalidateQueries({ queryKey: ['movie'] }) }} />
          <SubtitlesAdmin movie={movie} onDone={() => refetch()} />
          {movie.type === 'SERIES' && <EpisodesAdmin movie={movie} onDone={() => refetch()} />}
        </>
      )}
    </div>
  )
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? 'block sm:col-span-2' : 'block'}><span className="label">{label}</span>{children}</label>
}

function Artwork({ movie, onDone }: { movie: AdminMovie; onDone: () => void }) {
  const { toast } = useUI()
  const [busy, setBusy] = useState<string | null>(null)
  const send = async (kind: 'poster' | 'backdrop' | 'trailer', file?: File) => {
    if (!file) return
    setBusy(kind)
    const fd = new FormData()
    fd.append(kind === 'trailer' ? 'file' : 'image', file)
    try {
      await upload(`/api/admin/movies/${movie.id}/${kind}`, fd, () => {})
      toast(`${kind[0].toUpperCase() + kind.slice(1)} updated`)
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="card p-5">
      <h3 className="font-semibold">Artwork & trailer</h3>
      <p className="mt-1 text-xs text-subtle">Images are validated and re-encoded to WebP in two responsive sizes. JPEG, PNG, WebP or AVIF.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr_auto]">
        <img src={movie.posterUrl ?? ''} alt="Current poster" className="aspect-[2/3] w-28 rounded-lg object-cover" />
        <img src={movie.backdropUrl ?? ''} alt="Current backdrop" className="aspect-video w-full max-w-md rounded-lg object-cover" />
        <div className="flex flex-col gap-2">
          {(['poster', 'backdrop'] as const).map((k) => (
            <label key={k} className="btn-dark cursor-pointer text-xs">
              {busy === k ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} Upload {k}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => send(k, e.target.files?.[0])} />
            </label>
          ))}
          <label className="btn-dark cursor-pointer text-xs">
            {busy === 'trailer' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload trailer (MP4/WebM)
            <input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => send('trailer', e.target.files?.[0])} />
          </label>
        </div>
      </div>
    </section>
  )
}

function Files({ movie, onDone }: { movie: AdminMovie; onDone: () => void }) {
  const { toast, confirm } = useUI()
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState({ quality: '1080p', language: movie.language, authorizationStatus: 'PENDING', authorizationNote: '', rightsConfirmed: false })
  const [progress, setProgress] = useState<number | null>(null)

  const patch = async (fid: string, body: Partial<AdminFile>) => {
    try {
      await api.admin.send(`/files/${fid}`, 'PATCH', body)
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    if (!meta.rightsConfirmed) return toast('Confirm you hold the rights to distribute this file', 'error')
    const fd = new FormData()
    fd.append('quality', meta.quality)
    fd.append('language', meta.language)
    fd.append('authorizationStatus', meta.authorizationStatus)
    fd.append('authorizationNote', meta.authorizationNote)
    fd.append('rightsConfirmed', 'true')
    fd.append('file', file) // file last so fields are parsed first
    setProgress(0)
    try {
      await upload(`/api/admin/movies/${movie.id}/files`, fd, setProgress)
      toast('File uploaded')
      setFile(null)
      onDone()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setProgress(null)
    }
  }

  return (
    <section className="card p-5">
      <h3 className="font-semibold">Authorized media files</h3>
      <p className="mt-1 text-xs text-subtle">Only files marked <strong className="text-success">AUTHORIZED</strong> are ever streamed or downloadable. Files are stored in object storage, not the database.</p>
      {movie.files.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-surface text-left text-xs text-subtle uppercase"><tr><th className="px-3 py-2">Quality</th><th className="px-3">Format</th><th className="px-3">Size</th><th className="px-3">Authorization</th><th className="px-3">Download</th><th className="px-3">Stream</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {movie.files.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2 font-semibold">{x.quality}</td>
                  <td className="px-3 text-muted">{x.format}</td>
                  <td className="px-3 text-muted">{formatBytes(x.fileSize)}</td>
                  <td className="px-3">
                    <select className="field h-9 min-h-9 w-auto text-xs" value={x.authorizationStatus} onChange={(e) => patch(x.id, { authorizationStatus: e.target.value as AdminFile['authorizationStatus'] })} aria-label="Authorization status" title={x.authorizationNote ?? ''}>
                      <option>PENDING</option><option>AUTHORIZED</option><option>REVOKED</option>
                    </select>
                  </td>
                  <td className="px-3"><input type="checkbox" className="size-4 accent-[#e50914]" checked={x.downloadable} disabled={x.format === 'hls'} onChange={(e) => patch(x.id, { downloadable: e.target.checked })} aria-label="Downloadable" /></td>
                  <td className="px-3"><input type="checkbox" className="size-4 accent-[#e50914]" checked={x.streamable} onChange={(e) => patch(x.id, { streamable: e.target.checked })} aria-label="Streamable" /></td>
                  <td className="px-3 text-right">
                    <button className="btn-icon size-9 text-subtle" aria-label="Delete file" onClick={async () => { if (await confirm({ title: `Delete ${x.quality} file?`, message: 'The file is removed from storage permanently.', destructive: true, confirmLabel: 'Delete' })) { await api.admin.send(`/files/${x.id}`, 'DELETE').catch((e) => toast(e.message, 'error')); onDone() } }}>
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-dashed border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="label">Video file (MP4 or WebM)</span>
          <input type="file" accept="video/mp4,video/webm" className="field py-2 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </label>
        <Field label="Quality"><select className="field" value={meta.quality} onChange={(e) => setMeta({ ...meta, quality: e.target.value })}><option>480p</option><option>720p</option><option>1080p</option><option>2160p</option></select></Field>
        <Field label="Audio language"><input className="field" value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value })} required /></Field>
        <Field label="Authorization"><select className="field" value={meta.authorizationStatus} onChange={(e) => setMeta({ ...meta, authorizationStatus: e.target.value })}><option value="PENDING">Pending review</option><option value="AUTHORIZED">Authorized</option></select></Field>
        <Field label="Permission details *"><input className="field" value={meta.authorizationNote} onChange={(e) => setMeta({ ...meta, authorizationNote: e.target.value })} required minLength={5} placeholder="Licence / source of rights" /></Field>
        <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2 lg:col-span-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#e50914]" checked={meta.rightsConfirmed} onChange={(e) => setMeta({ ...meta, rightsConfirmed: e.target.checked })} />
          I confirm the platform holds the rights to distribute this file (public domain, licence, or rights-holder permission) and the details above are accurate.
        </label>
        <button className="btn-primary" disabled={progress !== null || !file}>{progress !== null ? <><Loader2 className="size-4 animate-spin" /> {Math.round(progress * 100)}%</> : <><Upload className="size-4" /> Upload file</>}</button>
      </form>
    </section>
  )
}

function SubtitlesAdmin({ movie, onDone }: { movie: AdminMovie; onDone: () => void }) {
  const { toast } = useUI()
  const [lang, setLang] = useState('en')
  const [label, setLabel] = useState('English')
  const [file, setFile] = useState<File | null>(null)
  return (
    <section className="card p-5">
      <h3 className="font-semibold">Subtitles</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {movie.subtitles.map((s) => (
          <li key={s.id} className="chip">
            {s.label} ({s.language}, .{s.format})
            <button aria-label={`Delete ${s.label} subtitles`} onClick={async () => { await api.admin.send(`/subtitles/${s.id}`, 'DELETE').catch((e) => toast(e.message, 'error')); onDone() }}><Trash2 className="size-3.5" /></button>
          </li>
        ))}
        {!movie.subtitles.length && <li className="text-sm text-subtle">No subtitle tracks yet.</li>}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!file) return
          const fd = new FormData()
          fd.append('language', lang)
          fd.append('label', label)
          fd.append('file', file)
          try {
            await upload(`/api/admin/movies/${movie.id}/subtitles`, fd, () => {})
            toast('Subtitles added')
            setFile(null)
            onDone()
          } catch (err) {
            toast((err as Error).message, 'error')
          }
        }}
      >
        <Field label="Code"><input className="field w-24" value={lang} onChange={(e) => setLang(e.target.value)} required /></Field>
        <Field label="Label"><input className="field w-40" value={label} onChange={(e) => setLabel(e.target.value)} required /></Field>
        <Field label=".vtt or .srt"><input type="file" accept=".vtt,.srt,text/vtt" className="field py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></Field>
        <button className="btn-dark"><Plus className="size-4" /> Add</button>
      </form>
    </section>
  )
}

function EpisodesAdmin({ movie, onDone }: { movie: AdminMovie; onDone: () => void }) {
  const { toast } = useUI()
  const [ep, setEp] = useState({ season: 1, number: movie.episodes.length + 1, title: '', runtime: movie.runtime })
  return (
    <section className="card p-5">
      <h3 className="font-semibold">Episodes</h3>
      <ul className="mt-3 divide-y divide-line text-sm">
        {movie.episodes.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2">
            <span className="w-16 text-subtle">S{e.season} E{e.number}</span><span className="flex-1">{e.title}</span><span className="text-subtle">{e.runtime}m</span>
            <button className="btn-icon size-8 text-subtle" aria-label={`Delete ${e.title}`} onClick={async () => { await api.admin.send(`/episodes/${e.id}`, 'DELETE'); onDone() }}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); try { await api.admin.send(`/movies/${movie.id}/episodes`, 'POST', ep); setEp({ ...ep, number: ep.number + 1, title: '' }); onDone() } catch (err) { toast((err as Error).message, 'error') } }}>
        <Field label="Season"><input type="number" min={1} className="field w-20" value={ep.season} onChange={(e) => setEp({ ...ep, season: Number(e.target.value) })} /></Field>
        <Field label="No."><input type="number" min={1} className="field w-20" value={ep.number} onChange={(e) => setEp({ ...ep, number: Number(e.target.value) })} /></Field>
        <Field label="Title"><input className="field w-56" value={ep.title} onChange={(e) => setEp({ ...ep, title: e.target.value })} required /></Field>
        <Field label="Min"><input type="number" min={1} className="field w-20" value={ep.runtime} onChange={(e) => setEp({ ...ep, runtime: Number(e.target.value) })} /></Field>
        <button className="btn-dark"><Plus className="size-4" /> Add episode</button>
      </form>
    </section>
  )
}
