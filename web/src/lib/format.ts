export function formatBytes(n: number) {
  if (!n) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i >= 2 ? 1 : 0)} ${u[i]}`
}

export function formatRuntime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)} min ago`
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

export const QUALITY_LABEL: Record<string, string> = {
  '240p': '240p (low data)',
  '360p': '360p',
  '480p': '480p SD',
  '720p': '720p HD',
  '1080p': '1080p Full HD',
  '2160p': '4K UHD',
}

export const qualityBadge = (q: string | null) => (q === '2160p' ? '4K' : q ?? '')

export const RIGHTS_LABEL: Record<string, string> = {
  PUBLIC_DOMAIN: 'Public domain (US)',
  LICENSED: 'Licensed',
  CREATOR_AUTHORIZED: 'Creator authorized',
  PLATFORM_ORIGINAL: 'CineVault Original',
  OPEN_LICENSE: 'Open licence (Creative Commons)',
  METADATA_ONLY: 'Listing only',
}

export function licenseLabel(url: string | null) {
  if (!url) return null
  if (/publicdomain\/zero/.test(url)) return 'CC0 public-domain dedication'
  if (/publicdomain/.test(url)) return 'Public domain'
  const m = /licenses\/(by(?:-sa)?)\/([\d.]+)/.exec(url)
  return m ? `CC ${m[1].toUpperCase()} ${m[2]}` : 'See source'
}

export const ratingSourceLabel = (s: string | null | undefined) => (s === 'TMDB' ? 'TMDB user rating' : 'CineVault score')

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ')
}

/** Derive a smaller responsive variant for artwork uploaded through the admin (sharp sizes). */
export function srcSetFor(url: string | null, kind: 'poster' | 'backdrop') {
  if (!url) return undefined
  if (kind === 'poster' && url.endsWith('-780.webp')) return `${url.replace(/-780\.webp$/, '-342.webp')} 342w, ${url} 780w`
  if (kind === 'backdrop' && url.endsWith('-1920.webp')) return `${url.replace(/-1920\.webp$/, '-1280.webp')} 1280w, ${url} 1920w`
  return undefined
}
