/**
 * Catalog import job: Internet Archive (films + licences) → optional TMDB enrichment → database.
 * Idempotent: items are upserted by their Internet Archive identifier, so re-running refreshes
 * popularity/files and fills gaps instead of duplicating titles.
 */
import { prisma } from '../lib/prisma.js'
import { buildSearchText, slugify } from '../lib/serialize.js'
import * as ia from './internetArchive.js'
import { enrich, tmdbEnabled } from './tmdb.js'

export interface ImportStatus {
  running: boolean
  startedAt: string | null
  finishedAt: string | null
  target: number
  processed: number
  imported: number
  updated: number
  skipped: number
  errors: string[]
  message: string
  tmdb: boolean
}

const status: ImportStatus = { running: false, startedAt: null, finishedAt: null, target: 0, processed: 0, imported: 0, updated: 0, skipped: 0, errors: [], message: 'Idle', tmdb: false }
export const getImportStatus = () => ({ ...status, tmdb: tmdbEnabled() })

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '')
/** log-scaled Internet Archive download count → 0..9999 popularity score */
const popularityFrom = (downloads = 0) => Math.min(9999, Math.round(Math.log10(downloads + 1) * 1500))

async function genreIds(names: string[]) {
  if (!names.length) return []
  const rows = await prisma.genre.findMany({ where: { name: { in: names } } })
  return rows.map((g) => g.id)
}

async function importOne(doc: ia.IASearchDoc): Promise<'imported' | 'updated' | 'skipped'> {
  const existing = await prisma.movie.findUnique({ where: { externalId: doc.identifier }, select: { id: true, tmdbId: true, source: true } })
  // Re-apply the content filter to titles imported under an older filter.
  if (existing && existing.source === 'internet_archive' && ia.excludePattern().test(doc.title ?? '')) {
    await prisma.movie.delete({ where: { id: existing.id } })
    return 'skipped'
  }
  const popularity = popularityFrom(doc.downloads)
  if (existing && (existing.tmdbId || !tmdbEnabled())) {
    await prisma.movie.update({ where: { id: existing.id }, data: { popularity } })
    return 'updated'
  }

  const item = await ia.getItem(doc.identifier)
  if (!item?.metadata || item.is_dark) return 'skipped'
  const meta = ia.metadataSummary(item)
  if (meta.adult) return 'skipped'
  if (!meta.license || !ia.ALLOWED_LICENSES.includes(meta.license)) return 'skipped' // licence gate
  const files = ia.playableFiles(item, doc.identifier)
  if (!files.length) return 'skipped'
  const runtime = ia.runtimeMinutes(item)
  if (runtime && runtime < 40) return 'skipped' // shorts / trailers are not feature films

  let t: Awaited<ReturnType<typeof enrich>> = null
  try {
    t = await enrich(meta.title, meta.year)
  } catch (e) {
    status.errors.push(`TMDB ${doc.identifier}: ${(e as Error).message}`)
  }

  const title = t?.title ?? meta.title
  const year = meta.year ?? 0
  const genres = t?.genres.length ? t.genres : ia.genresFromSubjects(item)
  const pd = ia.isPublicDomain(meta.license)
  const data = {
    title,
    originalTitle: t?.originalTitle ?? null,
    tagline: t?.tagline ?? null,
    description: t?.overview || meta.description || `${title}${year ? ` (${year})` : ''}, from the Internet Archive.`,
    releaseYear: year || 1900,
    runtime: t?.runtime ?? (runtime || 90),
    rating: t?.rating ?? 0,
    ratingSource: t?.rating ? 'TMDB' : null,
    ageRating: t?.ageRating ?? 'NR',
    country: t?.country ?? meta.country ?? 'Unknown',
    language: t?.language ?? meta.language ?? 'Unknown',
    director: t?.director ?? meta.director ?? 'Unknown',
    cast: t?.cast.length ? t.cast : meta.cast,
    production: t?.production ?? null,
    posterUrl: t?.posterUrl ?? ia.thumbnailUrl(doc.identifier),
    backdropUrl: t?.backdropUrl ?? t?.posterUrl ?? ia.thumbnailUrl(doc.identifier),
    trailerUrl: t?.trailerUrl ?? null,
    rightsBasis: pd ? ('PUBLIC_DOMAIN' as const) : ('OPEN_LICENSE' as const),
    rightsNote: `Imported from the Internet Archive item “${doc.identifier}”. Licence declared at the source: ${ia.licenseLabel(meta.license)}. Public-domain status can differ by country — verify before redistributing.`,
    license: meta.license,
    source: 'internet_archive',
    sourceUrl: ia.detailsUrl(doc.identifier),
    externalId: doc.identifier,
    tmdbId: t?.tmdbId ?? null,
    popularity,
    isPublished: true,
  }
  const searchText = buildSearchText({ ...data, genres })

  // Attach to an existing metadata-only title (e.g. a seeded public-domain classic) when it matches.
  let movieId = existing?.id
  if (!movieId && year) {
    const candidates = await prisma.movie.findMany({ where: { externalId: null, releaseYear: { gte: year - 1, lte: year + 1 } }, select: { id: true, title: true, originalTitle: true } })
    movieId = candidates.find((c) => norm(c.title) === norm(title) || (c.originalTitle && norm(c.originalTitle) === norm(title)))?.id
  }

  let result: 'imported' | 'updated'
  if (movieId) {
    const cur = await prisma.movie.findUniqueOrThrow({ where: { id: movieId } })
    const keepLocal = cur.source === 'local'
    await prisma.movie.update({
      where: { id: movieId },
      data: keepLocal
        ? { externalId: data.externalId, sourceUrl: data.sourceUrl, license: data.license, rightsNote: data.rightsNote, tmdbId: data.tmdbId, popularity: Math.max(cur.popularity, popularity) }
        : { ...data, searchText },
    })
    result = 'updated'
  } else {
    let slug = slugify(`${title}${year ? `-${year}` : ''}`) || slugify(doc.identifier)
    if (await prisma.movie.findUnique({ where: { slug } })) slug = `${slug}-${slugify(doc.identifier).slice(0, 24)}`
    const m = await prisma.movie.create({ data: { ...data, slug, searchText } })
    movieId = m.id
    result = 'imported'
  }

  const ids = await genreIds(genres)
  if (result === 'imported' || (await prisma.movieGenre.count({ where: { movieId } })) === 0) {
    await prisma.movieGenre.deleteMany({ where: { movieId } })
    if (ids.length) await prisma.movieGenre.createMany({ data: ids.map((genreId) => ({ movieId: movieId!, genreId })), skipDuplicates: true })
  }

  await prisma.movieFile.deleteMany({ where: { movieId, externalUrl: { not: null } } })
  await prisma.movieFile.createMany({
    data: files.map((f) => ({
      movieId: movieId!,
      quality: f.quality,
      format: f.format,
      mimeType: f.mimeType,
      fileSize: BigInt(f.size),
      externalUrl: f.url,
      language: data.language,
      authorizationStatus: 'AUTHORIZED' as const,
      authorizationNote: `Internet Archive item ${doc.identifier} — ${ia.licenseLabel(meta.license)} (${meta.license})`,
      downloadable: true,
      streamable: true,
    })),
  })
  await prisma.subtitle.deleteMany({ where: { movieId, externalUrl: { not: null } } })
  const subs = ia.subtitleFiles(item, doc.identifier)
  if (subs.length) await prisma.subtitle.createMany({ data: subs.map((s) => ({ movieId: movieId!, language: s.language, label: s.label, format: s.format, externalUrl: s.url })) })
  return result
}

/** Runs one import pass. Resolves when finished; safe to fire-and-forget. */
export async function runImport(opts: { limit?: number; startPage?: number; collection?: string } = {}) {
  if (status.running) return getImportStatus()
  const target = Math.min(Math.max(opts.limit ?? 100, 1), 1000)
  Object.assign(status, { running: true, startedAt: new Date().toISOString(), finishedAt: null, target, processed: 0, imported: 0, updated: 0, skipped: 0, errors: [], message: 'Searching the Internet Archive…' })
  try {
    let page = opts.startPage ?? 1
    const rows = 50
    // `target` counts NEW titles; already-imported ones are refreshed on the way. Cap work per run.
    const maxProcessed = target * 6 + 50
    while (status.imported < target && status.processed < maxProcessed) {
      const res = await ia.searchFeatureFilms({ rows, page, collection: opts.collection })
      if (!res.docs.length) break
      status.message = `Processing page ${page} of results (${res.numFound.toLocaleString()} licensed films available)`
      // Small concurrency to stay polite to both APIs.
      for (let i = 0; i < res.docs.length && status.imported < target; i += 4) {
        const batch = res.docs.slice(i, i + 4)
        const results = await Promise.allSettled(batch.map(importOne))
        results.forEach((r, j) => {
          status.processed++
          if (r.status === 'fulfilled') status[r.value]++
          else {
            status.skipped++
            if (status.errors.length < 50) status.errors.push(`${batch[j].identifier}: ${(r.reason as Error).message}`)
          }
        })
      }
      page++
    }
    status.message = `Finished: ${status.imported} new, ${status.updated} refreshed, ${status.skipped} skipped`
  } catch (e) {
    status.message = `Import failed: ${(e as Error).message}`
    status.errors.push((e as Error).message)
  } finally {
    status.running = false
    status.finishedAt = new Date().toISOString()
    console.log(`[import] ${status.message}`)
  }
  return getImportStatus()
}

/**
 * Background scheduling, controlled by env:
 *   IMPORT_ON_START=true        run once at boot if fewer than IMPORT_LIMIT archive titles exist
 *   IMPORT_LIMIT=150            titles per run
 *   IMPORT_INTERVAL_HOURS=24    refresh periodically (0 = off)
 */
export function scheduleImports() {
  const limit = Number(process.env.IMPORT_LIMIT ?? 150)
  if (process.env.IMPORT_ON_START === 'true') {
    setTimeout(async () => {
      const have = await prisma.movie.count({ where: { source: 'internet_archive' } }).catch(() => 0)
      if (have < limit) {
        console.log(`[import] ${have} archive titles present — importing up to ${limit - have} more`)
        runImport({ limit: limit - have }).catch(() => {})
      }
    }, 10_000)
  }
  const hours = Number(process.env.IMPORT_INTERVAL_HOURS ?? 0)
  if (hours > 0) setInterval(() => runImport({ limit }).catch(() => {}), hours * 3600_000).unref()
}
