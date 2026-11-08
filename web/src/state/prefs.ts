import type { Preferences } from '@/lib/types'

const KEY = 'cv:prefs'
/** Device-local preferences (guests) — merged with account preferences when signed in. */
export function getLocalPrefs(): Preferences {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
export function setLocalPrefs(p: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getLocalPrefs(), ...p }))
  } catch { /* ignore */ }
}
