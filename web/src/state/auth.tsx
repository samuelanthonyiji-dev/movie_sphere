import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<User>
  register: (b: { username: string; email: string; password: string }) => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User | null) => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)
export const useAuth = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside provider')
  return c
}

const CACHE_KEY = 'cv:user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  // Cache only non-sensitive profile fields so the UI renders offline; the session itself is an httpOnly cookie.
  const [user, setUserState] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((u: User | null) => {
    setUserState(u)
    try {
      if (u) localStorage.setItem(CACHE_KEY, JSON.stringify(u))
      else localStorage.removeItem(CACHE_KEY)
    } catch { /* storage unavailable */ }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.auth.me()
      setUser(user)
    } catch (e) {
      if ((e as { status?: number }).status !== 0) setUser(null) // keep cached identity while offline
    } finally {
      setLoading(false)
    }
  }, [setUser])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (identifier: string, password: string) => {
    const { user } = await api.auth.login(identifier, password)
    setUser(user)
    qc.invalidateQueries()
    return user
  }, [qc, setUser])

  const register = useCallback(async (b: { username: string; email: string; password: string }) => {
    const { user } = await api.auth.register(b)
    setUser(user)
    qc.invalidateQueries()
    return user
  }, [qc, setUser])

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    setUser(null)
    qc.clear()
  }, [qc, setUser])

  return <Ctx.Provider value={{ user, loading, login, register, logout, setUser, refresh }}>{children}</Ctx.Provider>
}
