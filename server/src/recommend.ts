/**
 * Simple, explainable recommendation engine (no ML). Each candidate is scored by:
 *   genre affinity (from favourites, watchlist, watch history, high ratings, saved genre prefs)
 *   + quality prior (editorial score) + popularity prior (log-scaled)
 * Titles the user has already saved or watched are excluded. Guests get general recommendations,
 * optionally personalised by genre hints computed from their on-device history.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import { cardInclude, toCard } from './lib/serialize.js'

export async function recommend(opts: { userId?: string; likeSlugs?: string[]; limit?: number }) {
  const limit = opts.limit ?? 20
  const affinity = new Map<string, number>()
  const exclude = new Set<string>()
  const bump = (genreIds: string[], w: number) => genreIds.forEach((g) => affinity.set(g, (affinity.get(g) ?? 0) + w))

  if (opts.userId) {
    const [user, list, history, ratings] = await Promise.all([
      prisma.user.findUnique({ where: { id: opts.userId }, select: { preferences: true } }),
      prisma.watchlist.findMany({ where: { userId: opts.userId }, include: { movie: { select: { genres: true } } } }),
      prisma.watchHistory.findMany({ where: { userId: opts.userId }, take: 50, orderBy: { updatedAt: 'desc' }, include: { movie: { select: { genres: true } } } }),
      prisma.rating.findMany({ where: { userId: opts.userId }, include: { movie: { select: { genres: true } } } }),
    ])
    for (const w of list) {
      bump(w.movie.genres.map((g) => g.genreId), w.favorite ? 3 : 2)
      exclude.add(w.movieId)
    }
    for (const h of history) {
      bump(h.movie.genres.map((g) => g.genreId), 1.5)
      exclude.add(h.movieId)
    }
    for (const r of ratings) bump(r.movie.genres.map((g) => g.genreId), (r.rating - 5) / 2)
    const prefs = (user?.preferences ?? {}) as { favoriteGenres?: string[] }
    if (prefs.favoriteGenres?.length) {
      const gs = await prisma.genre.findMany({ where: { slug: { in: prefs.favoriteGenres } } })
      bump(gs.map((g) => g.id), 2)
    }
  }
  if (opts.likeSlugs?.length) {
    const liked = await prisma.movie.findMany({ where: { slug: { in: opts.likeSlugs.slice(0, 30) } }, select: { id: true, genres: true } })
    for (const m of liked) {
      bump(m.genres.map((g) => g.genreId), 1.5)
      exclude.add(m.id)
    }
  }

  const where: Prisma.MovieWhereInput = { isPublished: true, id: { notIn: [...exclude] } }
  const candidates = await prisma.movie.findMany({ where, include: cardInclude, take: 300, orderBy: { popularity: 'desc' } })
  const personalised = affinity.size > 0
  const scored = candidates.map((m) => {
    const g = m.genres.reduce((s, x) => s + (affinity.get(x.genreId) ?? 0), 0)
    const score = g * 1.2 + m.rating * 0.6 + Math.log10(m.popularity + 10) * 0.8
    return { m, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return { personalised, items: scored.slice(0, limit).map((s) => toCard(s.m)) }
}
