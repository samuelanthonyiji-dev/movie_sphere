/**
 * Optional enrichment from The Movie Database (https://www.themoviedb.org) — free API key.
 * Supplies posters, backdrops, cast, genres, certification, trailers and community ratings.
 * Set TMDB_API_KEY to either a v3 API key or a v4 "API Read Access Token".
 *
 * Attribution required by TMDB: "This product uses the TMDB API but is not endorsed or certified by TMDB."
 */
const KEY = () => process.env.TMDB_API_KEY ?? ''
export const tmdbEnabled = () => KEY().length > 0
const IMG = 'https://image.tmdb.org/t/p'

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = KEY()
  const bearer = key.startsWith('eyJ')
  const qs = new URLSearchParams({ ...params, ...(bearer ? {} : { api_key: key }) })
  const res = await fetch(`https://api.themoviedb.org/3${path}?${qs}`, {
    headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000))
    return tmdb(path, params)
  }
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`)
  return (await res.json()) as T
}

const GENRE_MAP: Record<string, string> = {
  Action: 'Action', Adventure: 'Adventure', Animation: 'Animation', Comedy: 'Comedy', Crime: 'Crime',
  Documentary: 'Documentary', Drama: 'Drama', Family: 'Family', Fantasy: 'Fantasy', Horror: 'Horror',
  Mystery: 'Mystery', Romance: 'Romance', 'Science Fiction': 'Sci-Fi', Thriller: 'Thriller', War: 'War', Western: 'Western', History: 'Biography',
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export interface TmdbEnrichment {
  tmdbId: number
  title: string
  originalTitle: string | null
  tagline: string | null
  overview: string | null
  runtime: number | null
  rating: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  director: string | null
  cast: string[]
  country: string | null
  language: string | null
  production: string | null
  ageRating: string | null
  trailerUrl: string | null
}

interface SearchResult { id: number; title: string; original_title: string; release_date?: string; popularity: number }

/** Finds the best TMDB match for a title/year; returns null if nothing is confidently matched. */
export async function enrich(title: string, year: number | null): Promise<TmdbEnrichment | null> {
  if (!tmdbEnabled()) return null
  const clean = title.replace(/\(\d{4}\)|\[.*?\]|\b(full movie|hd|restored|colorized)\b/gi, '').trim()
  const search = await tmdb<{ results: SearchResult[] }>('/search/movie', { query: clean, include_adult: 'false', ...(year ? { year: String(year) } : {}) })
  let results = search.results
  if (!results.length && year) results = (await tmdb<{ results: SearchResult[] }>('/search/movie', { query: clean, include_adult: 'false' })).results
  const want = norm(clean)
  const match = results.find((r) => {
    const y = Number(r.release_date?.slice(0, 4))
    const titleOk = norm(r.title) === want || norm(r.original_title) === want
    return titleOk && (!year || !y || Math.abs(y - year) <= 1)
  })
  if (!match) return null

  const d = await tmdb<{
    id: number; title: string; original_title: string; tagline: string; overview: string; runtime: number
    vote_average: number; vote_count: number; poster_path: string | null; backdrop_path: string | null
    genres: Array<{ name: string }>; production_countries: Array<{ name: string }>; spoken_languages: Array<{ english_name: string }>
    production_companies: Array<{ name: string }>
    credits: { cast: Array<{ name: string }>; crew: Array<{ job: string; name: string }> }
    videos: { results: Array<{ site: string; type: string; key: string; official: boolean }> }
    release_dates: { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }
  }>(`/movie/${match.id}`, { append_to_response: 'credits,videos,release_dates' })

  const trailer = d.videos.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
  const cert = d.release_dates.results.find((r) => r.iso_3166_1 === 'US')?.release_dates.find((x) => x.certification)?.certification
  return {
    tmdbId: d.id,
    title: d.title,
    originalTitle: d.original_title !== d.title ? d.original_title : null,
    tagline: d.tagline || null,
    overview: d.overview || null,
    runtime: d.runtime || null,
    rating: d.vote_count >= 10 ? Math.round(d.vote_average * 10) / 10 : null,
    posterUrl: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
    backdropUrl: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
    genres: [...new Set(d.genres.map((g) => GENRE_MAP[g.name]).filter(Boolean))],
    director: d.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name).join(', ') || null,
    cast: d.credits.cast.slice(0, 8).map((c) => c.name),
    country: d.production_countries[0]?.name ?? null,
    language: d.spoken_languages[0]?.english_name ?? null,
    production: d.production_companies.slice(0, 2).map((c) => c.name).join(', ') || null,
    ageRating: cert || null,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
  }
}
