import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, type ListRow } from '@/lib/api'
import { idb } from '@/lib/idb'
import type { MovieCard } from '@/lib/types'
import { useAuth } from './auth'
import { useUI } from './ui'

export interface ProgressRow {
  movie: MovieCard
  position: number
  duration: number
  updatedAt: string
}
export interface RecentRow {
  movie: MovieCard
  viewedAt: string
}

interface LibraryCtx {
  list: ListRow[]
  listReady: boolean
  inList: (id: string) => boolean
  isFavorite: (id: string) => boolean
  toggleList: (m: MovieCard) => Promise<void>
  toggleFavorite: (m: MovieCard) => Promise<void>
  removeFromList: (id: string) => Promise<void>
  progress: ProgressRow[]
  getProgress: (id: string) => ProgressRow | undefined
  saveProgress: (m: MovieCard, position: number, duration: number) => void
  clearProgress: () => Promise<void>
  recent: RecentRow[]
  markViewed: (m: MovieCard) => void
  clearRecent: () => Promise<void>
}

const Ctx = createContext<LibraryCtx | null>(null)
export const useLibrary = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLibrary outside provider')
  return c
}

const slim = (m: MovieCard): MovieCard => ({ ...m, description: m.description.slice(0, 300) })

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { toast } = useUI()
  const [list, setList] = useState<ListRow[]>([])
  const [listReady, setListReady] = useState(false)
  const [progress, setProgress] = useState<ProgressRow[]>([])
  const [recent, setRecent] = useState<RecentRow[]>([])
  const prevUser = useRef<string | null | undefined>(undefined)

  const mirror = useCallback(async (rows: ListRow[]) => {
    await idb.clear('list')
    await Promise.all(rows.map((r) => idb.set('list', r.movie.id, r)))
  }, [])

  // Load local stores once.
  useEffect(() => {
    idb.all<ProgressRow>('progress').then((r) => setProgress(r.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))).catch(() => {})
    idb.all<RecentRow>('recent').then((r) => setRecent(r.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt)))).catch(() => {})
  }, [])

  // Load / sync list whenever auth state settles or changes.
  useEffect(() => {
    if (loading) return
    const uid = user?.id ?? null
    const was = prevUser.current
    prevUser.current = uid
    ;(async () => {
      const local = (await idb.all<ListRow>('list').catch(() => [])).sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      if (!uid) {
        if (was) {
          // signed out → remove the account's mirrored private data from this device
          await idb.clear('list').catch(() => {})
          setList([])
        } else setList(local)
        setListReady(true)
        return
      }
      try {
        // signing in from guest → merge the guest's on-device list into the account
        const rows = was === null && local.length
          ? await api.me.syncList(local.map((r) => ({ movieId: r.movie.id, favorite: r.favorite, addedAt: r.addedAt })))
          : await api.me.list()
        if (was === null && local.length) toast(`Synced ${local.length} saved title${local.length > 1 ? 's' : ''} to your account`, 'info')
        setList(rows)
        mirror(rows).catch(() => {})
        // pull server-side playback progress into local store
        const hist = await api.me.history().catch(() => [])
        if (hist.length) {
          for (const h of hist) await idb.set('progress', h.movie.id, { movie: h.movie, position: h.position, duration: h.duration, updatedAt: h.updatedAt })
          setProgress((await idb.all<ProgressRow>('progress')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
        }
      } catch {
        setList(local) // offline: fall back to mirrored copy
      } finally {
        setListReady(true)
      }
    })()
  }, [user?.id, loading, mirror, toast])

  const ids = useMemo(() => new Map(list.map((r) => [r.movie.id, r])), [list])

  const upsertLocal = useCallback((row: ListRow) => {
    setList((l) => [row, ...l.filter((x) => x.movie.id !== row.movie.id)])
    idb.set('list', row.movie.id, row).catch(() => {})
  }, [])

  const removeFromList = useCallback(async (id: string) => {
    const before = list
    setList((l) => l.filter((x) => x.movie.id !== id))
    idb.del('list', id).catch(() => {})
    if (user) {
      try {
        await api.me.removeList(id)
      } catch (e) {
        setList(before)
        toast((e as Error).message, 'error')
        throw e
      }
    }
  }, [list, user, toast])

  const toggleList = useCallback(async (m: MovieCard) => {
    if (ids.has(m.id)) {
      await removeFromList(m.id)
      toast(`Removed “${m.title}” from My List`, 'info', { label: 'Undo', onClick: () => toggleList(m) })
      return
    }
    const row = { movie: slim(m), favorite: false, addedAt: new Date().toISOString() }
    upsertLocal(row)
    if (user) {
      try {
        await api.me.putList(m.id)
      } catch (e) {
        setList((l) => l.filter((x) => x.movie.id !== m.id))
        toast((e as Error).message, 'error')
        return
      }
    }
    toast(`Added “${m.title}” to My List`)
  }, [ids, removeFromList, upsertLocal, user, toast])

  const toggleFavorite = useCallback(async (m: MovieCard) => {
    const cur = ids.get(m.id)
    const next = !cur?.favorite
    const row = { movie: slim(m), favorite: next, addedAt: cur?.addedAt ?? new Date().toISOString() }
    upsertLocal(row)
    if (user) {
      try {
        await api.me.putList(m.id, next)
      } catch (e) {
        if (cur) upsertLocal(cur)
        toast((e as Error).message, 'error')
        return
      }
    }
    toast(next ? `“${m.title}” marked as favourite` : `Removed “${m.title}” from favourites`, next ? 'success' : 'info')
  }, [ids, upsertLocal, user, toast])

  const lastSync = useRef<Record<string, number>>({})
  const saveProgress = useCallback((m: MovieCard, position: number, duration: number) => {
    const row: ProgressRow = { movie: slim(m), position, duration, updatedAt: new Date().toISOString() }
    idb.set('progress', m.id, row).catch(() => {})
    setProgress((p) => [row, ...p.filter((x) => x.movie.id !== m.id)])
    // Throttle server writes to once every 10 s per title.
    if (user && Date.now() - (lastSync.current[m.id] ?? 0) > 10_000) {
      lastSync.current[m.id] = Date.now()
      api.me.saveProgress(m.id, position, duration).catch(() => {})
    }
  }, [user])

  const clearProgress = useCallback(async () => {
    await idb.clear('progress')
    setProgress([])
    if (user) await api.me.clearHistory()
  }, [user])

  const markViewed = useCallback((m: MovieCard) => {
    const row = { movie: slim(m), viewedAt: new Date().toISOString() }
    setRecent((r) => {
      const next = [row, ...r.filter((x) => x.movie.id !== m.id)].slice(0, 20)
      for (const old of r.slice(19)) idb.del('recent', old.movie.id).catch(() => {})
      return next
    })
    idb.set('recent', m.id, row).catch(() => {})
  }, [])

  const clearRecent = useCallback(async () => {
    await idb.clear('recent')
    setRecent([])
  }, [])

  const value: LibraryCtx = {
    list,
    listReady,
    inList: (id) => ids.has(id),
    isFavorite: (id) => !!ids.get(id)?.favorite,
    toggleList,
    toggleFavorite,
    removeFromList,
    progress,
    getProgress: (id) => progress.find((p) => p.movie.id === id),
    saveProgress,
    clearProgress,
    recent,
    markViewed,
    clearRecent,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
