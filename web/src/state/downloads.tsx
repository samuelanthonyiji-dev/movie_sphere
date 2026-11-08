/**
 * Client-side download manager.
 *
 * Two clearly distinct modes:
 *  1. "device"  – hands the authorized file URL to the browser's own download manager
 *                 (Content-Disposition: attachment). The page cannot observe completion, so the
 *                 status is "sent to browser", never "completed".
 *  2. "offline" – streams the file into the app's Cache Storage chunk by chunk (never held fully
 *                 in JS memory) with live progress. Marked "available offline" only after the
 *                 cache entry is read back and its size verified. The service worker then serves
 *                 it with Range support for offline playback.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { idb } from '@/lib/idb'
import type { MovieCard, MovieFile } from '@/lib/types'
import { notify } from './notifications'

export const OFFLINE_CACHE = 'cv-offline-media-v1'
export const offlineKey = (fileId: string) => `/media/stream/${fileId}`

export type DownloadStatus = 'checking' | 'sent' | 'downloading' | 'stored' | 'failed' | 'cancelled'
export interface DownloadRecord {
  id: string // `${mode}:${fileId}`
  mode: 'device' | 'offline'
  fileId: string
  movie: Pick<MovieCard, 'id' | 'slug' | 'title' | 'posterUrl' | 'year' | 'type'>
  quality: string
  format: string
  size: number
  status: DownloadStatus
  received: number
  error?: string
  createdAt: string
  updatedAt: string
}

interface DownloadsCtx {
  records: DownloadRecord[]
  startDevice: (m: MovieCard, f: MovieFile) => Promise<void>
  startOffline: (m: MovieCard, f: MovieFile) => Promise<void>
  cancel: (id: string) => void
  retry: (id: string) => Promise<void>
  removeOffline: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  isStoredOffline: (fileId: string) => boolean
  storage: { usage: number; quota: number; persisted: boolean } | null
  refreshStorage: () => void
}

const Ctx = createContext<DownloadsCtx | null>(null)
export const useDownloads = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDownloads outside provider')
  return c
}

const now = () => new Date().toISOString()

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DownloadRecord[]>([])
  const [storage, setStorage] = useState<DownloadsCtx['storage']>(null)
  const controllers = useRef(new Map<string, AbortController>())
  const fileCache = useRef(new Map<string, { m: MovieCard; f: MovieFile }>())

  const put = useCallback((r: DownloadRecord) => {
    setRecords((rs) => [r, ...rs.filter((x) => x.id !== r.id)])
    idb.set('downloads', r.id, r).catch(() => {})
  }, [])

  const refreshStorage = useCallback(async () => {
    if (!navigator.storage?.estimate) return
    const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(false)])
    setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted })
  }, [])

  // Load history and reconcile with what is actually in Cache Storage.
  useEffect(() => {
    ;(async () => {
      const rows = (await idb.all<DownloadRecord>('downloads').catch(() => [])).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const cache = 'caches' in window ? await caches.open(OFFLINE_CACHE) : null
      for (const r of rows) {
        if (r.mode !== 'offline') continue
        if (r.status === 'downloading' || r.status === 'checking') {
          r.status = 'failed'
          r.error = 'Interrupted (the app was closed). Retry to resume from the start.'
        }
        if (r.status === 'stored' && !(await cache?.match(offlineKey(r.fileId)))) {
          r.status = 'failed'
          r.error = 'The browser removed this stored file to free up space.'
        }
        idb.set('downloads', r.id, r).catch(() => {})
      }
      setRecords(rows)
      refreshStorage()
    })()
  }, [refreshStorage])

  const base = (m: MovieCard, f: MovieFile, mode: DownloadRecord['mode']): DownloadRecord => ({
    id: `${mode}:${f.id}`,
    mode,
    fileId: f.id,
    movie: { id: m.id, slug: m.slug, title: m.title, posterUrl: m.posterUrl, year: m.year, type: m.type },
    quality: f.quality,
    format: f.format,
    size: f.fileSize,
    status: 'checking',
    received: 0,
    createdAt: now(),
    updatedAt: now(),
  })

  const startDevice = useCallback(async (m: MovieCard, f: MovieFile) => {
    if (!f.downloadUrl) throw new Error('Download currently unavailable.')
    fileCache.current.set(f.id, { m, f })
    const rec = base(m, f, 'device')
    put(rec)
    try {
      // Verify the file is actually available before handing it to the browser.
      const head = await fetch(f.downloadUrl, { method: 'HEAD', credentials: 'same-origin' })
      if (!head.ok) throw new Error(head.status === 404 ? 'Download currently unavailable.' : `Server returned ${head.status}`)
    } catch (e) {
      const msg = e instanceof TypeError ? 'Network error — check your connection.' : (e as Error).message
      put({ ...rec, status: 'failed', error: msg, updatedAt: now() })
      throw new Error(msg)
    }
    const a = document.createElement('a')
    a.href = f.downloadUrl
    a.download = ''
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    put({ ...rec, status: 'sent', updatedAt: now() })
  }, [put])

  const startOffline = useCallback(async (m: MovieCard, f: MovieFile) => {
    if (!f.downloadUrl || !('caches' in window)) throw new Error('Offline storage is not supported in this browser.')
    fileCache.current.set(f.id, { m, f })
    const rec = base(m, f, 'offline')
    put(rec)
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      if (est.quota && est.usage !== undefined && est.quota - est.usage < f.fileSize * 1.1) {
        const err = 'Not enough storage space on this device for this file.'
        put({ ...rec, status: 'failed', error: err, updatedAt: now() })
        throw new Error(err)
      }
      navigator.storage.persist?.().catch(() => {})
    }
    const ctrl = new AbortController()
    controllers.current.set(rec.id, ctrl)
    let received = 0
    let lastPaint = 0
    try {
      const res = await fetch(f.downloadUrl, { signal: ctrl.signal, credentials: 'same-origin' })
      if (!res.ok || !res.body) throw new Error(res.status === 404 ? 'Download currently unavailable.' : `Server returned ${res.status}`)
      const total = Number(res.headers.get('content-length')) || f.fileSize
      put({ ...rec, status: 'downloading', size: total, updatedAt: now() })
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, c) {
          received += chunk.byteLength
          if (performance.now() - lastPaint > 250) {
            lastPaint = performance.now()
            setRecords((rs) => rs.map((r) => (r.id === rec.id ? { ...r, received, status: 'downloading' } : r)))
          }
          c.enqueue(chunk)
        },
      })
      const cache = await caches.open(OFFLINE_CACHE)
      // cache.put consumes the stream incrementally and writes it to disk.
      await cache.put(
        offlineKey(f.id),
        new Response(res.body.pipeThrough(counter), {
          headers: { 'Content-Type': f.mimeType, 'Content-Length': String(total), 'X-CineVault-Stored': now() },
        }),
      )
      // Confirm storage actually succeeded before claiming it.
      const stored = await cache.match(offlineKey(f.id))
      const blob = await stored?.blob()
      if (!blob || blob.size !== total) {
        await cache.delete(offlineKey(f.id))
        throw new Error('Storage verification failed — the saved file was incomplete.')
      }
      put({ ...rec, status: 'stored', size: total, received: total, updatedAt: now() })
      notify('download', 'Available offline', `${m.title} (${f.quality}) is ready to watch offline.`)
    } catch (e) {
      const aborted = (e as DOMException).name === 'AbortError'
      const msg = aborted ? 'Cancelled' : e instanceof TypeError ? 'Network error — the connection dropped.' : (e as DOMException).name === 'QuotaExceededError' ? 'Device storage is full.' : (e as Error).message
      put({ ...rec, status: aborted ? 'cancelled' : 'failed', received, error: msg, updatedAt: now() })
      if (!aborted) throw new Error(msg)
    } finally {
      controllers.current.delete(rec.id)
      refreshStorage()
    }
  }, [put, refreshStorage])

  const cancel = useCallback((id: string) => controllers.current.get(id)?.abort(), [])

  const retry = useCallback(async (id: string) => {
    const r = records.find((x) => x.id === id)
    if (!r) return
    let entry = fileCache.current.get(r.fileId)
    if (!entry) {
      // Rebuild minimal objects from the record after an app restart.
      const res = await fetch(`/api/movies/${r.movie.slug}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Could not load this title. Check your connection.')
      const { movie } = await res.json()
      const f = movie.files.find((x: MovieFile) => x.id === r.fileId)
      if (!f) throw new Error('This file is no longer available for download.')
      entry = { m: movie, f }
    }
    if (r.mode === 'device') await startDevice(entry.m, entry.f)
    else await startOffline(entry.m, entry.f)
  }, [records, startDevice, startOffline])

  const removeOffline = useCallback(async (id: string) => {
    const r = records.find((x) => x.id === id)
    if (r && 'caches' in window) await (await caches.open(OFFLINE_CACHE)).delete(offlineKey(r.fileId))
    setRecords((rs) => rs.filter((x) => x.id !== id))
    await idb.del('downloads', id)
    refreshStorage()
  }, [records, refreshStorage])

  const clearHistory = useCallback(async () => {
    // Keep files that are stored offline; clear everything else.
    const keep = records.filter((r) => r.mode === 'offline' && r.status === 'stored')
    for (const r of records) if (!keep.includes(r)) await idb.del('downloads', r.id)
    setRecords(keep)
  }, [records])

  const isStoredOffline = useCallback((fileId: string) => records.some((r) => r.fileId === fileId && r.mode === 'offline' && r.status === 'stored'), [records])

  return (
    <Ctx.Provider value={{ records, startDevice, startOffline, cancel, retry, removeOffline, clearHistory, isStoredOffline, storage, refreshStorage }}>
      {children}
    </Ctx.Provider>
  )
}
