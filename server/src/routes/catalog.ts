import type { Prisma } from '@prisma/client'
import { Router } from 'express'
import { HttpError, str } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cardInclude, detailInclude, normalizeQuery, toCard, toDetail } from '../lib/serialize.js'
import { recommend } from '../recommend.js'

export const catalog = Router()

const SORTS: Record<string, Prisma.MovieOrderByWithRelationInput[]> = {
  latest: [{ releaseYear: 'desc' }, { popularity: 'desc' }],
  oldest: [{ releaseYear: 'asc' }, { title: 'asc' }],
  popular: [{ popularity: 'desc' }],
  rating: [{ rating: 'desc' }, { popularity: 'desc' }],
  az: [{ title: 'asc' }],
  downloads: [{ downloadCount: 'desc' }, { popularity: 'desc' }],
  added: [{ createdAt: 'desc' }],
}

export function buildWhere(query: Record<string, unknown>): Prisma.MovieWhereInput {
  const and: Prisma.MovieWhereInput[] = [{ isPublished: true }]
  const q = str(query.q)
  if (q) {
    const terms = normalizeQuery(q).split(/\s+/).filter(Boolean).slice(0, 6)
    for (const t of terms) and.push({ searchText: { contains: t } })
  }
  const genres = str(query.genre)?.split(',').filter(Boolean)
  if (genres?.length) for (const g of genres) and.push({ genres: { some: { genre: { slug: g } } } })
  const year = Number(str(query.year))
  if (year) and.push({ releaseYear: year })
  const decade = Number(str(query.decade))
  if (decade) and.push({ releaseYear: { gte: decade, lte: decade + 9 } })
  const yearFrom = Number(str(query.yearFrom)), yearTo = Number(str(query.yearTo))
  if (yearFrom) and.push({ releaseYear: { gte: yearFrom } })
  if (yearTo) and.push({ releaseYear: { lte: yearTo } })
  const country = str(query.country)
  if (country) and.push({ country })
  const language = str(query.language)
  if (language) and.push({ language: { startsWith: language } })
  const minRating = Number(str(query.minRating))
  if (minRating) and.push({ rating: { gte: minRating } })
  const quality = str(query.quality)
  if (quality) and.push({ files: { some: { quality, authorizationStatus: 'AUTHORIZED', downloadable: true } } })
  if (str(query.downloadable) === '1') and.push({ files: { some: { authorizationStatus: 'AUTHORIZED', downloadable: true } } })
  const type = str(query.type)?.toUpperCase()
  if (type === 'MOVIE' || type === 'SERIES') and.push({ type })
  if (str(query.recent) === '1') and.push({ createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } })
  return { AND: and }
}

catalog.get('/movies', async (req, res) => {
  const page = Math.max(1, Number(str(req.query.page)) || 1)
  const pageSize = Math.min(48, Math.max(1, Number(str(req.query.limit)) || 24))
  const where = buildWhere(req.query)
  const orderBy = SORTS[str(req.query.sort) ?? 'popular'] ?? SORTS.popular
  const [total, rows] = await Promise.all([
    prisma.movie.count({ where }),
    prisma.movie.findMany({ where, orderBy, include: cardInclude, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ items: rows.map(toCard), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
})

catalog.get('/search/suggest', async (req, res) => {
  const q = str(req.query.q)
  if (!q || q.length < 2) {
    res.json({ items: [], total: 0 })
    return
  }
  const where = buildWhere({ q })
  const [total, rows] = await Promise.all([
    prisma.movie.count({ where }),
    prisma.movie.findMany({ where, include: cardInclude, orderBy: [{ popularity: 'desc' }], take: 8 }),
  ])
  res.json({ items: rows.map(toCard), total })
})

catalog.get('/movies/:slug', async (req, res) => {
  const m = await prisma.movie.findFirst({ where: { slug: req.params.slug, isPublished: true }, include: detailInclude })
  if (!m) throw new HttpError(404, 'Movie not found')
  const related = await prisma.movie.findMany({
    where: { isPublished: true, id: { not: m.id }, genres: { some: { genreId: { in: m.genres.map((g) => g.genreId) } } } },
    include: cardInclude,
    orderBy: [{ popularity: 'desc' }],
    take: 30,
  })
  const shared = (x: (typeof related)[number]) => x.genres.filter((g) => m.genres.some((mg) => mg.genreId === g.genreId)).length
  related.sort((a, b) => shared(b) - shared(a) || b.rating - a.rating)
  let myRating: number | null = null
  if (req.user) {
    const r = await prisma.rating.findUnique({ where: { userId_movieId: { userId: req.user.id, movieId: m.id } } })
    myRating = r?.rating ?? null
  }
  res.json({ movie: { ...toDetail(m), myRating }, related: related.slice(0, 12).map(toCard) })
})

catalog.get('/genres', async (_req, res) => {
  const genres = await prisma.genre.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { movies: true } } } })
  res.set('Cache-Control', 'public, max-age=300')
  res.json(genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug, count: g._count.movies })))
})

catalog.get('/facets', async (_req, res) => {
  const [years, countries, languages] = await Promise.all([
    prisma.movie.groupBy({ by: ['releaseYear'], where: { isPublished: true }, orderBy: { releaseYear: 'desc' } }),
    prisma.movie.groupBy({ by: ['country'], where: { isPublished: true }, orderBy: { country: 'asc' } }),
    prisma.movie.groupBy({ by: ['language'], where: { isPublished: true }, orderBy: { language: 'asc' } }),
  ])
  const langs = [...new Set(languages.map((l) => l.language.replace(/\s*\(.*\)$/, '')))].sort()
  res.set('Cache-Control', 'public, max-age=300')
  res.json({
    years: years.map((y) => y.releaseYear),
    countries: countries.map((c) => c.country),
    languages: langs,
    qualities: ['480p', '720p', '1080p', '2160p'],
  })
})

catalog.get('/collections', async (_req, res) => {
  const cols = await prisma.collection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { movies: { orderBy: { position: 'asc' }, take: 12, include: { movie: { include: cardInclude } } } },
  })
  res.json(cols.map((c) => ({ slug: c.slug, title: c.title, description: c.description, items: c.movies.map((x) => toCard(x.movie)) })))
})

catalog.get('/collections/:slug', async (req, res) => {
  const c = await prisma.collection.findUnique({
    where: { slug: req.params.slug },
    include: { movies: { orderBy: { position: 'asc' }, include: { movie: { include: cardInclude } } } },
  })
  if (!c) throw new HttpError(404, 'Collection not found')
  res.json({ slug: c.slug, title: c.title, description: c.description, items: c.movies.map((x) => toCard(x.movie)) })
})

/** Homepage payload: hero rotation + every enabled section. */
catalog.get('/home', async (req, res) => {
  const likes = str(req.query.likes)?.split(',').filter(Boolean)
  const sections = await prisma.homeSection.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } })
  const base = { isPublished: true } satisfies Prisma.MovieWhereInput
  const take = 18
  const q = (where: Prisma.MovieWhereInput, orderBy: Prisma.MovieOrderByWithRelationInput[]) =>
    prisma.movie.findMany({ where: { ...base, ...where }, orderBy, include: cardInclude, take })

  const hero = await prisma.movie.findMany({ where: { ...base, featured: true }, orderBy: { popularity: 'desc' }, include: cardInclude, take: 6 })

  const out = await Promise.all(
    sections.map(async (s) => {
      let items: ReturnType<typeof toCard>[] = []
      let href: string | null = null
      if (s.key === 'continue') {
        if (req.user) {
          const h = await prisma.watchHistory.findMany({
            where: { userId: req.user.id, playbackPosition: { gt: 5 } },
            orderBy: { updatedAt: 'desc' },
            take,
            include: { movie: { include: cardInclude } },
          })
          items = h.filter((x) => !x.duration || x.playbackPosition / x.duration < 0.95).map((x) => ({ ...toCard(x.movie), progress: x.duration ? x.playbackPosition / x.duration : 0 }))
        }
        // guests: filled client-side from on-device playback progress
      } else if (s.key === 'recommended') {
        items = (await recommend({ userId: req.user?.id, likeSlugs: likes, limit: take })).items
      } else if (s.key === 'trending') {
        items = (await q({ createdAt: { gte: new Date(Date.now() - 120 * 86400_000) } }, [{ popularity: 'desc' }])).map(toCard)
        href = '/movies?sort=popular&recent=0'
      } else if (s.key === 'popular') {
        items = (await q({ type: 'MOVIE' }, [{ popularity: 'desc' }])).map(toCard)
        href = '/movies?sort=popular'
      } else if (s.key === 'latest') {
        items = (await q({ type: 'MOVIE' }, [{ releaseYear: 'desc' }, { popularity: 'desc' }])).map(toCard)
        href = '/latest'
      } else if (s.key === 'recent') {
        items = (await q({}, [{ createdAt: 'desc' }])).map(toCard)
        href = '/movies?sort=added'
      } else if (s.key === 'top-rated') {
        items = (await q({}, [{ rating: 'desc' }])).map(toCard)
        href = '/movies?sort=rating'
      } else if (s.key === 'most-downloaded') {
        items = (await q({ downloadCount: { gt: 0 } }, [{ downloadCount: 'desc' }])).map(toCard)
        href = '/movies?sort=downloads'
      } else if (s.key === 'featured') {
        items = (await q({ featured: true }, [{ popularity: 'desc' }])).map(toCard)
      } else if (s.key === 'series') {
        items = (await q({ type: 'SERIES' }, [{ popularity: 'desc' }])).map(toCard)
        href = '/series'
      } else if (s.key.startsWith('genre:')) {
        const slug = s.key.slice(6)
        items = (await q({ genres: { some: { genre: { slug } } } }, [{ popularity: 'desc' }])).map(toCard)
        href = `/movies/${slug}`
      }
      return { key: s.key, title: s.title, href, items }
    }),
  )
  res.json({ hero: hero.map(toCard), sections: out })
})
