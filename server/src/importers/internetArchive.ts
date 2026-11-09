/**
 * Internet Archive client (https://archive.org) — no API key required.
 *
 * Search:   https://archive.org/advancedsearch.php  (Lucene query over item metadata)
 * Metadata: https://archive.org/metadata/{identifier} (files, sizes, resolutions, licence)
 * Files:    https://archive.org/download/{identifier}/{file} (redirects to a storage node, supports Range)
 *
 * Only items whose `licenseurl` is in ALLOWED_LICENSES are ever imported, so every playable /
 * downloadable file carries an explicit public-domain or open licence declared at the source.
 */

const UA = process.env.IMPORT_USER_AGENT ?? 'MovieSphereImporter/1.0 (+https://github.com/samuelanthonyiji-dev/movie_sphere)'
const BASE = 'https://archive.org'

/** Licences that permit redistribution (including commercial use). NC/ND licences are excluded. */
export const ALLOWED_LICENSES = [
  'http://creativecommons.org/licenses/publicdomain/',
  'http://creativecommons.org/publicdomain/mark/1.0/',
  'https://creativecommons.org/publicdomain/mark/1.0/',
  'http://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  ...['2.0', '2.5', '3.0', '4.0'].flatMap((v) =>
    ['by', 'by-sa'].flatMap((l) => [`http://creativecommons.org/licenses/${l}/${v}/`, `https://creativecommons.org/licenses/${l}/${v}/`]),
  ),
]

export function licenseLabel(url: string | null | undefined) {
  if (!url) return 'Unknown'
  if (/publicdomain\/zero/.test(url)) return 'CC0 (public domain dedication)'
  if (/publicdomain/.test(url)) return 'Public domain'
  const m = /licenses\/(by(?:-sa)?)\/([\d.]+)/.exec(url)
  return m ? `CC ${m[1].toUpperCase()} ${m[2]}` : url
}

export function isPublicDomain(url: string | null | undefined) {
  return !!url && /publicdomain/.test(url)
}

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    return getJson(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`Internet Archive ${res.status} for ${url}`)
  return (await res.json()) as T
}

export interface IASearchDoc {
  identifier: string
  title?: string
  year?: string | number
  downloads?: number
  licenseurl?: string
}

export async function searchFeatureFilms(opts: { rows: number; page: number; collection?: string; extraQuery?: string }) {
  const lic = ALLOWED_LICENSES.map((l) => `"${l}"`).join(' OR ')
  const q = [`collection:(${opts.collection ?? 'feature_films'})`, 'mediatype:(movies)', `licenseurl:(${lic})`, opts.extraQuery].filter(Boolean).join(' AND ')
  const params = new URLSearchParams({ q, rows: String(opts.rows), page: String(opts.page), output: 'json' })
  for (const f of ['identifier', 'title', 'year', 'downloads', 'licenseurl']) params.append('fl[]', f)
  params.append('sort[]', 'downloads desc')
  const data = await getJson<{ response: { numFound: number; docs: IASearchDoc[] } }>(`${BASE}/advancedsearch.php?${params}`)
  return data.response
}

export interface IAFile {
  name: string
  format?: string
  size?: string
  height?: string
  width?: string
  length?: string
  source?: string
}

export interface IAItem {
  metadata: Record<string, string | string[] | undefined>
  files: IAFile[]
  is_dark?: boolean
}

export const getItem = (identifier: string) => getJson<IAItem>(`${BASE}/metadata/${encodeURIComponent(identifier)}`)

export const downloadUrl = (identifier: string, file: string) =>
  `${BASE}/download/${encodeURIComponent(identifier)}/${file.split('/').map(encodeURIComponent).join('/')}`

export const thumbnailUrl = (identifier: string) => `${BASE}/services/img/${encodeURIComponent(identifier)}`
export const detailsUrl = (identifier: string) => `${BASE}/details/${encodeURIComponent(identifier)}`

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : [])

function qualityFor(height: number) {
  if (height >= 1000) return '1080p'
  if (height >= 700) return '720p'
  if (height >= 460) return '480p'
  if (height >= 330) return '360p'
  return '240p'
}

/** Browser-playable MP4/WebM files, one per quality (largest wins). */
export function playableFiles(item: IAItem, identifier: string) {
  const byQuality = new Map<string, { quality: string; format: string; mimeType: string; size: number; url: string; name: string }>()
  for (const f of item.files) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'mp4' && ext !== 'webm') continue
    if (/\.thumbs\//.test(f.name)) continue
    const size = Number(f.size ?? 0)
    if (!size) continue
    const h = Number(f.height ?? 0) || (/512kb/i.test(f.name) || /512Kb/.test(f.format ?? '') ? 240 : 480)
    const quality = qualityFor(h)
    const cur = byQuality.get(quality)
    if (!cur || size > cur.size)
      byQuality.set(quality, { quality, format: ext, mimeType: ext === 'mp4' ? 'video/mp4' : 'video/webm', size, url: downloadUrl(identifier, f.name), name: f.name })
  }
  return [...byQuality.values()]
}

export function subtitleFiles(item: IAItem, identifier: string) {
  return item.files
    .filter((f) => /\.(srt|vtt)$/i.test(f.name))
    .map((f) => {
      const format = f.name.split('.').pop()!.toLowerCase()
      const auto = /\.asr\./i.test(f.name)
      const lang = /\.([a-z]{2})\.(srt|vtt)$/i.exec(f.name)?.[1]?.toLowerCase() ?? 'en'
      return { language: lang, label: auto ? 'English (auto-generated)' : lang === 'en' ? 'English' : lang.toUpperCase(), format, url: downloadUrl(identifier, f.name), auto }
    })
    // One track per language: prefer human-made over auto-generated captions, VTT over SRT.
    .sort((a, b) => Number(a.auto) - Number(b.auto) || (a.format === 'vtt' ? -1 : 1))
    .filter((s, i, arr) => arr.findIndex((x) => x.language === s.language) === i)
    .map(({ auto: _auto, ...s }) => s)
    .slice(0, 6)
}

/** Duration in minutes from "1:31:44", "91 min", "01:31" or file length in seconds. */
export function runtimeMinutes(item: IAItem) {
  const r = first(item.metadata.runtime)
  if (r) {
    const parts = r.split(':').map(Number)
    if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
      const [a, b, c] = parts
      return Math.max(1, Math.round(parts.length === 3 ? a * 60 + b + c / 60 : a + b / 60))
    }
    const m = /(\d+)\s*min/i.exec(r)
    if (m) return Number(m[1])
  }
  const len = Math.max(0, ...item.files.map((f) => Number(f.length ?? 0)).filter((n) => Number.isFinite(n)))
  return len ? Math.max(1, Math.round(len / 60)) : 0
}

const GENRE_WORDS: Array<[RegExp, string]> = [
  [/\bcomed(y|ies)|\bslapstick|\bfarce/i, 'Comedy'],
  [/\bdrama/i, 'Drama'],
  [/\bhorror|\bzombie|\bvampire|\bmonster/i, 'Horror'],
  [/\bsci[- ]?fi|science fiction|\bspace\b|\balien/i, 'Sci-Fi'],
  [/\bwestern|\bcowboy/i, 'Western'],
  [/\bwar\b|\bworld war|\bwwii|\bmilitary/i, 'War'],
  [/\bcrime|\bnoir|\bgangster|\bdetective/i, 'Crime'],
  [/\bmystery|\bwhodunit/i, 'Mystery'],
  [/\bthriller|\bsuspense/i, 'Thriller'],
  [/\bromance|\bromantic|\blove story/i, 'Romance'],
  [/\badventure|\bjungle|\bpirate/i, 'Adventure'],
  [/\baction\b|\bmartial arts|\bkung fu/i, 'Action'],
  [/\banimat|\bcartoon/i, 'Animation'],
  [/\bdocumentary|\bnewsreel/i, 'Documentary'],
  [/\bfamily|\bchildren|\bkids\b/i, 'Family'],
  [/\bfantasy|\bfairy tale/i, 'Fantasy'],
  [/\bbiograph|\bbiopic/i, 'Biography'],
]

export function genresFromSubjects(item: IAItem) {
  const text = [...all(item.metadata.subject).flatMap((s) => s.split(/[;,]/)), first(item.metadata.genre) ?? ''].join(' | ')
  return [...new Set(GENRE_WORDS.filter(([re]) => re.test(text)).map(([, g]) => g))].slice(0, 4)
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }
export function cleanText(html: string | undefined, max = 2000) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#39|[a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : m))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/** Content filter for imports (override with IMPORT_EXCLUDE_PATTERN). */
export const excludePattern = () =>
  new RegExp(process.env.IMPORT_EXCLUDE_PATTERN ?? '\\b(xxx|porn\\w*|erotic\\w*|nude|nudes|nudity|nudist\\w*|nudie\\w*|sexploitation|stripper\\w*|burlesque)\\b', 'i')

export function metadataSummary(item: IAItem) {
  const m = item.metadata
  const yearRaw = first(m.year) ?? first(m.date)?.slice(0, 4)
  const year = Number(yearRaw)
  const lang = first(m.language)
  const LANGS: Record<string, string> = { eng: 'English', english: 'English', fre: 'French', fra: 'French', ger: 'German', deu: 'German', spa: 'Spanish', ita: 'Italian', rus: 'Russian', jpn: 'Japanese' }
  return {
    title: cleanText(first(m.title), 200) || 'Untitled',
    year: year > 1870 && year < 2100 ? year : null,
    description: cleanText(first(m.description)),
    director: cleanText(first(m.director) ?? first(m.creator), 200) || null,
    cast: all(m.contributor).concat(all(m.actor)).map((s) => cleanText(s, 80)).filter(Boolean).slice(0, 10),
    language: lang ? LANGS[lang.toLowerCase()] ?? lang : null,
    country: cleanText(first(m.country), 80) || null,
    license: first(m.licenseurl) ?? null,
    color: first(m.color),
    adult: excludePattern().test(
      [first(m.title), first(m.description)?.slice(0, 400), ...all(m.subject)].join(' '),
    ),
  }
}
