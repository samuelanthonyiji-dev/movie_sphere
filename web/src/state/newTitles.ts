import { useEffect } from 'react'
import { api } from '@/lib/api'
import { notify } from './notifications'
import { useUI } from './ui'

const KEY = 'cv:last-seen-added'

/** On launch, tell the user (opt-in) about titles added since their last visit. */
export function useNewTitleNotifier() {
  const { toast } = useUI()
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { items } = await api.movies({ sort: 'added', limit: 5 })
        if (!items.length) return
        const newest = items[0].addedAt
        const last = localStorage.getItem(KEY)
        localStorage.setItem(KEY, newest)
        if (!last) return
        const fresh = items.filter((m) => m.addedAt > last)
        if (!fresh.length) return
        const msg = fresh.length === 1 ? `New on CineVault: ${fresh[0].title}` : `${fresh.length} new titles added since your last visit`
        toast(msg, 'info')
        notify('newMovies', 'New on CineVault', msg, fresh.length === 1 ? `/movie/${fresh[0].slug}` : '/movies?sort=added')
        if (fresh.some((m) => m.type === 'SERIES')) notify('newEpisodes', 'New series to watch', fresh.filter((m) => m.type === 'SERIES').map((m) => m.title).join(', '), '/series')
      } catch { /* offline or storage unavailable */ }
    }, 4000)
    return () => clearTimeout(t)
  }, [toast])
}
