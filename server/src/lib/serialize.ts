import type { Prisma } from '@prisma/client'
import { num } from './http.js'

export const QUALITY_ORDER = ['240p', '360p', '480p', '720p', '1080p', '2160p']

export const cardInclude = {
  genres: { include: { genre: true } },
  files: {
    where: { authorizationStatus: 'AUTHORIZED' as const },
    select: { quality: true, format: true, downloadable: true, streamable: true },
  },
} satisfies Prisma.MovieInclude

export type CardMovie = Prisma.MovieGetPayload<{ include: typeof cardInclude }>

const DAY = 86400_000

export function toCard(m: CardMovie) {
  const downloadQualities = [...new Set(m.files.filter((f) => f.downloadable && f.format !== 'hls').map((f) => f.quality))].sort(
    (a, b) => QUALITY_ORDER.indexOf(a) - QUALITY_ORDER.indexOf(b),
  )
  return {
    id: m.id,
    slug: m.slug,
    type: m.type,
    title: m.title,
    originalTitle: m.originalTitle,
    tagline: m.tagline,
    description: m.description,
    year: m.releaseYear,
    runtime: m.runtime,
    rating: m.rating,
    ageRating: m.ageRating,
    country: m.country,
    language: m.language,
    genres: m.genres.map((g) => ({ name: g.genre.name, slug: g.genre.slug })),
    posterUrl: m.posterUrl,
    backdropUrl: m.backdropUrl,
    trailerUrl: m.trailerUrl,
    downloadQualities,
    topQuality: downloadQualities.at(-1) ?? null,
    downloadable: downloadQualities.length > 0,
    streamable: m.files.some((f) => f.streamable),
    // NEW = a recent release (not merely recently imported); TRENDING = among the most-watched titles.
    isNew: m.releaseYear >= new Date().getFullYear() - 1 && Date.now() - m.createdAt.getTime() < 60 * DAY,
    isTrending: m.popularity >= 9000,
    popularity: m.popularity,
    downloadCount: m.downloadCount,
    rightsBasis: m.rightsBasis,
    ratingSource: m.ratingSource,
    addedAt: m.createdAt.toISOString(),
  }
}

export const detailInclude = {
  ...cardInclude,
  files: { where: { authorizationStatus: 'AUTHORIZED' as const } },
  subtitles: true,
  episodes: { orderBy: [{ season: 'asc' as const }, { number: 'asc' as const }] },
  ratings: { select: { rating: true } },
} satisfies Prisma.MovieInclude

export type DetailMovie = Prisma.MovieGetPayload<{ include: typeof detailInclude }>

export function toDetail(m: DetailMovie) {
  const card = toCard({ ...m, files: m.files })
  const subtitleLangs = m.subtitles.map((s) => s.label)
  const userRatings = m.ratings.map((r) => r.rating)
  return {
    ...card,
    director: m.director,
    cast: m.cast,
    production: m.production,
    rightsNote: m.rightsNote,
    source: m.source,
    sourceUrl: m.sourceUrl,
    license: m.license,
    ratingSource: m.ratingSource,
    updatedAt: m.updatedAt.toISOString(),
    userRating: userRatings.length
      ? { average: Math.round((userRatings.reduce((a, b) => a + b, 0) / userRatings.length) * 10) / 10, count: userRatings.length }
      : null,
    files: m.files
      .sort((a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality))
      .map((f) => ({
        id: f.id,
        quality: f.quality,
        format: f.format,
        mimeType: f.mimeType,
        fileSize: num(f.fileSize),
        language: f.language,
        downloadable: f.downloadable && f.format !== 'hls',
        streamable: f.streamable,
        hostedBy: f.externalUrl ? new URL(f.externalUrl).hostname.replace(/^www\./, '') : null,
        subtitles: subtitleLangs,
        downloadUrl: f.downloadable && f.format !== 'hls' ? `/media/download/${f.id}` : null,
        streamUrl: f.streamable ? (f.format === 'hls' ? `/media/hls/${f.id}/index.m3u8` : `/media/stream/${f.id}`) : null,
      })),
    subtitles: m.subtitles.map((s) => ({
      id: s.id,
      language: s.language,
      label: s.label,
      format: s.format,
      url: `/media/subtitles/${s.id}.vtt`,
      downloadUrl: `/media/subtitles/${s.id}.${s.format}?download=1`,
    })),
    episodes: m.episodes.map((e) => ({ id: e.id, season: e.season, number: e.number, title: e.title, runtime: e.runtime, synopsis: e.synopsis })),
  }
}

export function buildSearchText(m: {
  title: string
  originalTitle?: string | null
  director: string
  cast: string[]
  country: string
  language: string
  releaseYear: number
  genres?: string[]
}) {
  return [m.title, m.originalTitle, m.director, ...m.cast, m.country, m.language, m.releaseYear, ...(m.genres ?? [])]
    .filter(Boolean)
    .join(' | ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function normalizeQuery(q: string) {
  return q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
