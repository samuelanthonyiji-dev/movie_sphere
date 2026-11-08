/**
 * Opt-in notifications. Nothing is shown unless the user enabled the category in Settings AND
 * granted browser permission. Categories: newMovies, newEpisodes, download, updates.
 */
export type NotifyKind = 'newMovies' | 'newEpisodes' | 'download' | 'updates'
const KEY = 'cv:notify'

export function getNotifyPrefs(): Record<NotifyKind, boolean> {
  try {
    return { newMovies: false, newEpisodes: false, download: false, updates: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { newMovies: false, newEpisodes: false, download: false, updates: false }
  }
}

export function setNotifyPrefs(p: Record<NotifyKind, boolean>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch { /* ignore */ }
}

export const notificationsSupported = () => 'Notification' in window

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported' as const
  if (Notification.permission === 'granted') return 'granted' as const
  return Notification.requestPermission()
}

export async function notify(kind: NotifyKind, title: string, body: string, url = '/') {
  if (!notificationsSupported() || Notification.permission !== 'granted' || !getNotifyPrefs()[kind]) return
  const reg = await navigator.serviceWorker?.getRegistration()
  const opts: NotificationOptions = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url }, tag: `cv-${kind}` }
  if (reg) reg.showNotification(title, opts)
  else new Notification(title, opts)
}
