import { useQuery } from '@tanstack/react-query'
import { Bell, Camera, Download, Heart, History, KeyRound, ListVideo, Loader2, LogOut, MonitorDown, Settings, Trash2, User as UserIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MovieCarousel } from '@/components/MovieCarousel'
import { Avatar } from '@/components/Navbar'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import type { Preferences } from '@/lib/types'
import { useAuth } from '@/state/auth'
import { useDownloads } from '@/state/downloads'
import { useLibrary } from '@/state/library'
import { getNotifyPrefs, notificationsSupported, requestNotificationPermission, setNotifyPrefs, type NotifyKind } from '@/state/notifications'
import { getLocalPrefs, setLocalPrefs } from '@/state/prefs'
import { usePwa } from '@/state/pwa'
import { useUI } from '@/state/ui'

export default function Profile() {
  useDocumentTitle('Profile & settings')
  const { user } = useAuth()
  const [tab, setTab] = useState<'overview' | 'settings'>('overview')
  return (
    <div className="container-page pt-24 lg:pt-28">
      {user ? <AccountHeader /> : <GuestHeader />}
      <div role="tablist" className="mt-8 flex gap-2 border-b border-line">
        {(['overview', 'settings'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('relative -mb-px flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold capitalize', tab === t ? 'border-accent text-white' : 'border-transparent text-subtle hover:text-white')}>
            {t === 'overview' ? <UserIcon className="size-4" /> : <Settings className="size-4" />} {t}
          </button>
        ))}
      </div>
      <div className="mt-8">{tab === 'overview' ? <Overview /> : <SettingsPanel />}</div>
    </div>
  )
}

function GuestHeader() {
  return (
    <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
      <div className="grid size-16 place-items-center rounded-full bg-elevated"><UserIcon className="size-7 text-muted" /></div>
      <div className="flex-1">
        <h1 className="text-2xl font-bold">You’re browsing as a guest</h1>
        <p className="mt-1 text-sm text-muted">Your list, history and preferences are stored on this device. Create a free account to sync them, rate titles and keep a download history.</p>
      </div>
      <div className="flex gap-2">
        <Link to="/register" className="btn-primary">Create account</Link>
        <Link to="/login" className="btn-dark">Sign in</Link>
      </div>
    </div>
  )
}

function AccountHeader() {
  const { user, setUser, logout } = useAuth()
  const lib = useLibrary()
  const { toast } = useUI()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user!.displayName)
  const [busy, setBusy] = useState(false)
  const u = user!

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.me.updateProfile({ displayName: name })
      setUser(r.user)
      setEditing(false)
      toast('Display name updated')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const upload = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return toast('Please choose an image under 5 MB', 'error')
    setBusy(true)
    try {
      const r = await api.me.uploadAvatar(f)
      setUser(r.user)
      toast('Avatar updated')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
      <div className="relative w-fit">
        <Avatar name={u.displayName} url={u.avatarUrl} className="size-24 text-4xl" />
        <button className="absolute right-0 bottom-0 grid size-9 place-items-center rounded-full border-2 border-surface bg-accent text-white" onClick={() => fileRef.current?.click()} aria-label="Change avatar" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={saveName} className="flex max-w-sm gap-2">
            <label className="sr-only" htmlFor="dn">Display name</label>
            <input id="dn" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
            <button className="btn-primary" disabled={busy}>Save</button>
            <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setName(u.displayName) }}>Cancel</button>
          </form>
        ) : (
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold">
            {u.displayName}
            <button className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-white" onClick={() => setEditing(true)}>Edit name</button>
            {u.role === 'ADMIN' && <Link to="/admin" className="rounded bg-accent px-2 py-0.5 text-[10px] tracking-wider text-white uppercase">Admin</Link>}
          </h1>
        )}
        <p className="mt-1 text-sm text-muted">@{u.username} · {u.email}</p>
        <p className="mt-1 text-xs text-subtle">Member since {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span><strong>{lib.list.length}</strong> <span className="text-muted">in list</span></span>
          <span><strong>{lib.list.filter((x) => x.favorite).length}</strong> <span className="text-muted">favourites</span></span>
          <span><strong>{lib.progress.length}</strong> <span className="text-muted">watched</span></span>
        </div>
      </div>
      <button className="btn-dark self-start" onClick={async () => { await logout(); toast('Signed out', 'info'); nav('/') }}>
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  )
}

function Overview() {
  const lib = useLibrary()
  const { user } = useAuth()
  const dl = useDownloads()
  const rec = useQuery({ queryKey: ['me', 'recs'], queryFn: api.me.recommendations, enabled: !!user })
  const continueItems = lib.progress.filter((p) => p.duration && p.position > 5 && p.position / p.duration < 0.95).map((p) => ({ ...p.movie, progress: p.position / p.duration }))
  const history = lib.progress.map((p) => p.movie)
  return (
    <div className="-mx-4 space-y-10 sm:-mx-6 lg:-mx-10 3xl:-mx-16">
      <MovieCarousel title="Continue Watching" icon={<History className="size-5 text-accent" />} items={continueItems} />
      <MovieCarousel title="My List" icon={<ListVideo className="size-5 text-accent" />} items={lib.list.map((r) => r.movie)} href="/my-list" />
      <MovieCarousel title="Favourites" icon={<Heart className="size-5 text-accent" />} items={lib.list.filter((r) => r.favorite).map((r) => r.movie)} href="/my-list" />
      <MovieCarousel title="Watch history" items={history} />
      {user && rec.data && <MovieCarousel title={rec.data.personalised ? 'Recommended for you' : 'Popular picks'} items={rec.data.items} />}
      <div className="container-page">
        <Link to="/downloads" className="card flex items-center gap-4 p-5 hover:border-white/20">
          <Download className="size-6 text-accent" />
          <div className="flex-1">
            <p className="font-semibold">Download history</p>
            <p className="text-sm text-muted">{dl.records.length} on this device{user ? ' · plus your account history' : ''}</p>
          </div>
          <span aria-hidden>›</span>
        </Link>
      </div>
      {!lib.list.length && !lib.progress.length && (
        <p className="container-page text-sm text-muted">Nothing here yet — start by adding titles to <Link to="/" className="text-white underline">My List</Link>.</p>
      )}
    </div>
  )
}

function SettingsPanel() {
  const { user, setUser } = useAuth()
  const lib = useLibrary()
  const pwa = usePwa()
  const { toast, confirm } = useUI()
  const nav = useNavigate()
  const { data: genres } = useQuery({ queryKey: ['genres'], queryFn: api.genres, staleTime: 600_000 })
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...getLocalPrefs(), ...(user?.preferences ?? {}) }))
  const [notify, setNotify] = useState(getNotifyPrefs)
  const [saving, setSaving] = useState(false)

  const savePrefs = async () => {
    setSaving(true)
    setLocalPrefs(prefs)
    try {
      if (user) {
        const r = await api.me.updateProfile({ preferences: { favoriteGenres: prefs.favoriteGenres ?? [], preferredQuality: prefs.preferredQuality, subtitleLanguage: prefs.subtitleLanguage } })
        setUser(r.user)
      }
      toast('Preferences saved')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleNotify = async (k: NotifyKind) => {
    const next = { ...notify, [k]: !notify[k] }
    if (next[k]) {
      const perm = await requestNotificationPermission()
      if (perm !== 'granted') {
        toast(perm === 'unsupported' ? 'Notifications aren’t supported in this browser' : 'Notifications are blocked in your browser settings', 'error')
        return
      }
    }
    setNotify(next)
    setNotifyPrefs(next)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5" aria-labelledby="pref-title">
        <h2 id="pref-title" className="text-lg font-bold">Viewing preferences</h2>
        <p className="mt-1 text-xs text-subtle">{user ? 'Saved to your account.' : 'Saved on this device.'} Favourite genres improve “Recommended For You”.</p>
        <fieldset className="mt-5">
          <legend className="label">Favourite genres</legend>
          <div className="flex flex-wrap gap-2">
            {genres?.map((g) => {
              const on = prefs.favoriteGenres?.includes(g.slug) ?? false
              return (
                <button key={g.slug} type="button" className="chip" aria-pressed={on} onClick={() => setPrefs((p) => ({ ...p, favoriteGenres: on ? (p.favoriteGenres ?? []).filter((x) => x !== g.slug) : [...(p.favoriteGenres ?? []), g.slug] }))}>{g.name}</button>
              )
            })}
          </div>
        </fieldset>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Preferred playback quality</span>
            <select className="field" value={prefs.preferredQuality ?? ''} onChange={(e) => setPrefs((p) => ({ ...p, preferredQuality: e.target.value || undefined }))}>
              <option value="">Automatic</option>
              <option value="480p">480p (saves data)</option>
              <option value="720p">720p HD</option>
              <option value="1080p">1080p Full HD</option>
              <option value="2160p">4K UHD</option>
            </select>
          </label>
          <label>
            <span className="label">Default subtitles</span>
            <select className="field" value={prefs.subtitleLanguage ?? ''} onChange={(e) => setPrefs((p) => ({ ...p, subtitleLanguage: e.target.value || undefined }))}>
              <option value="">Off</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="ja">日本語</option>
              <option value="no">Norsk</option>
            </select>
          </label>
        </div>
        <button className="btn-primary mt-6" onClick={savePrefs} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} Save preferences</button>
      </section>

      <section className="card p-5" aria-labelledby="notif-title">
        <h2 id="notif-title" className="flex items-center gap-2 text-lg font-bold"><Bell className="size-5" /> Notifications</h2>
        <p className="mt-1 text-xs text-subtle">Off by default. Turning one on asks your browser for permission. Stored on this device.</p>
        {!notificationsSupported() ? (
          <p className="mt-4 text-sm text-muted">This browser doesn’t support notifications. On iPhone/iPad, install CineVault to your Home Screen first.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {([['newMovies', 'Newly added movies'], ['newEpisodes', 'New series & episodes'], ['download', 'Offline download complete'], ['updates', 'Platform updates']] as Array<[NotifyKind, string]>).map(([k, label]) => (
              <li key={k} className="flex min-h-12 items-center justify-between gap-4">
                <span className="text-sm">{label}</span>
                <Switch checked={notify[k]} onChange={() => toggleNotify(k)} label={label} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="app-title">
        <h2 id="app-title" className="flex items-center gap-2 text-lg font-bold"><MonitorDown className="size-5" /> App</h2>
        <p className="mt-2 text-sm text-muted">
          {pwa.installed ? 'CineVault is installed on this device.' : pwa.canPrompt ? 'Install CineVault for a full-screen app experience and faster launch.' : pwa.isIOS ? 'On iPhone and iPad, add CineVault to your Home Screen from Safari.' : 'Installation becomes available in supported browsers (Chrome, Edge, Samsung Internet, Safari on iOS/macOS).'}
        </p>
        {!pwa.installed && (pwa.canPrompt || pwa.isIOS) && <button className="btn-primary mt-4" onClick={() => pwa.install()}><MonitorDown className="size-4" /> Install app</button>}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
          <button className="btn-dark text-xs" onClick={async () => { if (await confirm({ title: 'Clear watch history?', message: 'Removes playback progress and “Continue Watching”.', confirmLabel: 'Clear', destructive: true })) { await lib.clearProgress(); toast('Watch history cleared', 'info') } }}>
            <History className="size-4" /> Clear watch history
          </button>
          <button className="btn-dark text-xs" onClick={async () => { if (await confirm({ title: 'Clear recently viewed?', confirmLabel: 'Clear', destructive: true })) { await lib.clearRecent(); toast('Recently viewed cleared', 'info') } }}>
            Clear recently viewed
          </button>
        </div>
      </section>

      {user && <AccountSecurity onDeleted={() => nav('/')} />}
    </div>
  )
}

function AccountSecurity({ onDeleted }: { onDeleted: () => void }) {
  const { setUser } = useAuth()
  const { toast, confirm } = useUI()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="card p-5" aria-labelledby="sec-title">
      <h2 id="sec-title" className="flex items-center gap-2 text-lg font-bold"><KeyRound className="size-5" /> Account security</h2>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await api.auth.changePassword(cur, next)
            setCur('')
            setNext('')
            toast('Password changed')
          } catch (err) {
            toast((err as Error).message, 'error')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label><span className="label">Current password</span><input type="password" className="field" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
        <label><span className="label">New password</span><input type="password" className="field" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></label>
        <button className="btn-primary w-fit" disabled={busy}>Change password</button>
      </form>
      <div className="mt-6 border-t border-line pt-4">
        <button
          className="btn-ghost px-0 text-xs text-accent hover:bg-transparent"
          onClick={async () => {
            if (!(await confirm({ title: 'Delete your account?', message: 'This permanently deletes your account, list, ratings and history. This cannot be undone.', confirmLabel: 'Delete account', destructive: true }))) return
            try {
              await api.me.deleteAccount()
              setUser(null)
              toast('Your account has been deleted', 'info')
              onDeleted()
            } catch (e) {
              toast((e as Error).message, 'error')
            }
          }}
        >
          <Trash2 className="size-4" /> Delete account
        </button>
      </div>
    </section>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-white/15')}>
      <span className={cx('absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  )
}
