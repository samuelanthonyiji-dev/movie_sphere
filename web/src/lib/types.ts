export interface GenreRef {
  name: string
  slug: string
}

export interface MovieCard {
  id: string
  slug: string
  type: 'MOVIE' | 'SERIES'
  title: string
  originalTitle: string | null
  tagline: string | null
  description: string
  year: number
  runtime: number
  rating: number
  ageRating: string
  country: string
  language: string
  genres: GenreRef[]
  posterUrl: string | null
  backdropUrl: string | null
  trailerUrl: string | null
  downloadQualities: string[]
  topQuality: string | null
  downloadable: boolean
  streamable: boolean
  isNew: boolean
  isTrending: boolean
  popularity: number
  downloadCount: number
  rightsBasis: RightsBasis
  /** null = editorial sample score; 'TMDB' = TMDB community rating */
  ratingSource: string | null
  addedAt: string
  progress?: number
}

export type RightsBasis = 'PUBLIC_DOMAIN' | 'LICENSED' | 'CREATOR_AUTHORIZED' | 'PLATFORM_ORIGINAL' | 'OPEN_LICENSE' | 'METADATA_ONLY'

export interface MovieFile {
  id: string
  quality: string
  format: string
  mimeType: string
  fileSize: number
  language: string
  downloadable: boolean
  streamable: boolean
  /** Host serving an externally hosted authorized file (e.g. archive.org) */
  hostedBy: string | null
  subtitles: string[]
  downloadUrl: string | null
  streamUrl: string | null
}

export interface SubtitleTrack {
  id: string
  language: string
  label: string
  format: string
  url: string
  downloadUrl: string
}

export interface Episode {
  id: string
  season: number
  number: number
  title: string
  runtime: number
  synopsis: string | null
}

export interface MovieDetail extends MovieCard {
  director: string
  cast: string[]
  production: string | null
  rightsNote: string | null
  source: string
  sourceUrl: string | null
  license: string | null
  updatedAt: string
  userRating: { average: number; count: number } | null
  myRating: number | null
  files: MovieFile[]
  subtitles: SubtitleTrack[]
  episodes: Episode[]
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface HomeSection {
  key: string
  title: string
  href: string | null
  items: MovieCard[]
}

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: 'USER' | 'ADMIN'
  preferences: Preferences
  createdAt: string
}

export interface Preferences {
  favoriteGenres?: string[]
  preferredQuality?: string
  subtitleLanguage?: string
  autoplayTrailers?: boolean
  notifications?: Record<string, boolean>
}

export interface Genre {
  id: string
  name: string
  slug: string
  count: number
}

export interface Facets {
  years: number[]
  countries: string[]
  languages: string[]
  qualities: string[]
}

export interface Collection {
  slug: string
  title: string
  description: string | null
  items: MovieCard[]
}
