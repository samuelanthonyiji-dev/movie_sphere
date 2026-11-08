import type { Collection, Facets, Genre, HomeSection, MovieCard, MovieDetail, Paged, User } from './types'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
  get offline() {
    return this.status === 0
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-CineVault', '1') // CSRF guard header (see server/src/lib/auth.ts)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let res: Response
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init, headers })
  } catch {
    throw new ApiError(0, navigator.onLine ? 'Could not reach the server. Please try again.' : 'You’re offline. Check your connection and try again.')
  }
  const text = await res.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null
  if (!res.ok) throw new ApiError(res.status, (data && typeof data === 'object' && 'error' in data ? String(data.error) : null) ?? `Request failed (${res.status})`)
  return data as T
}

const json = (body: unknown) => JSON.stringify(body)
const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const str = s.toString()
  return str ? `?${str}` : ''
}

export type MovieQuery = Record<string, string | number | undefined>

export const api = {
  home: (likes?: string[]) => request<{ hero: MovieCard[]; sections: HomeSection[] }>(`/api/home${qs({ likes: likes?.join(',') })}`),
  movies: (q: MovieQuery) => request<Paged<MovieCard>>(`/api/movies${qs(q)}`),
  movie: (slug: string) => request<{ movie: MovieDetail; related: MovieCard[] }>(`/api/movies/${encodeURIComponent(slug)}`),
  suggest: (q: string, signal?: AbortSignal) => request<{ items: MovieCard[]; total: number }>(`/api/search/suggest${qs({ q })}`, { signal }),
  genres: () => request<Genre[]>('/api/genres'),
  facets: () => request<Facets>('/api/facets'),
  collections: () => request<Collection[]>('/api/collections'),
  collection: (slug: string) => request<Collection>(`/api/collections/${encodeURIComponent(slug)}`),
  report: (body: { kind: string; movieSlug?: string; name: string; email: string; message: string }) => request<{ ok: true }>('/api/reports', { method: 'POST', body: json(body) }),

  auth: {
    me: () => request<{ user: User | null }>('/api/auth/me'),
    login: (identifier: string, password: string) => request<{ user: User }>('/api/auth/login', { method: 'POST', body: json({ identifier, password }) }),
    register: (b: { username: string; email: string; password: string }) => request<{ user: User }>('/api/auth/register', { method: 'POST', body: json(b) }),
    logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    forgot: (email: string) => request<{ ok: true; message: string; devResetUrl?: string }>('/api/auth/forgot-password', { method: 'POST', body: json({ email }) }),
    reset: (token: string, password: string) => request<{ ok: true }>('/api/auth/reset-password', { method: 'POST', body: json({ token, password }) }),
    changePassword: (current: string, next: string) => request<{ ok: true }>('/api/auth/change-password', { method: 'POST', body: json({ current, next }) }),
  },

  me: {
    updateProfile: (b: { displayName?: string; preferences?: Record<string, unknown> }) => request<{ user: User }>('/api/me/profile', { method: 'PATCH', body: json(b) }),
    uploadAvatar: (file: File) => {
      const fd = new FormData()
      fd.append('avatar', file)
      return request<{ user: User }>('/api/me/avatar', { method: 'POST', body: fd })
    },
    deleteAccount: () => request<{ ok: true }>('/api/me/account', { method: 'DELETE' }),
    list: () => request<ListRow[]>('/api/me/list'),
    putList: (movieId: string, favorite?: boolean) => request<{ movieId: string; favorite: boolean }>(`/api/me/list/${movieId}`, { method: 'PUT', body: json({ favorite }) }),
    removeList: (movieId: string) => request<{ ok: true }>(`/api/me/list/${movieId}`, { method: 'DELETE' }),
    syncList: (items: Array<{ movieId: string; favorite: boolean; addedAt?: string }>) => request<ListRow[]>('/api/me/list/sync', { method: 'POST', body: json({ items }) }),
    history: () => request<Array<{ movie: MovieCard; position: number; duration: number; updatedAt: string }>>('/api/me/history'),
    saveProgress: (movieId: string, position: number, duration: number) => request<{ ok: true }>(`/api/me/history/${movieId}`, { method: 'PUT', body: json({ position, duration }) }),
    clearHistory: () => request<{ ok: true }>('/api/me/history', { method: 'DELETE' }),
    downloads: () => request<Array<{ id: string; movie: MovieCard; quality: string; format: string; fileSize: number; fileId: string; createdAt: string }>>('/api/me/downloads'),
    clearDownloads: () => request<{ ok: true }>('/api/me/downloads', { method: 'DELETE' }),
    rate: (movieId: string, rating: number) => request<{ myRating: number; userRating: { average: number; count: number } }>(`/api/me/ratings/${movieId}`, { method: 'PUT', body: json({ rating }) }),
    recommendations: () => request<{ personalised: boolean; items: MovieCard[] }>('/api/me/recommendations'),
  },

  admin: {
    get: <T,>(path: string) => request<T>(`/api/admin${path}`),
    send: <T,>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) =>
      request<T>(`/api/admin${path}`, { method, body: body instanceof FormData ? body : body === undefined ? undefined : json(body) }),
  },
}

export interface ListRow {
  movie: MovieCard
  favorite: boolean
  addedAt: string
}
