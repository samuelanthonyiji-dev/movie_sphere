import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { z } from 'zod'
import { requireAuth } from '../lib/auth.js'
import { env } from '../lib/env.js'
import { HttpError, parse } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { cardInclude, toCard } from '../lib/serialize.js'
import { recommend } from '../recommend.js'
import { storage } from '../storage/index.js'
import { toUser } from './auth.js'

export const me = Router()
me.use(requireAuth)

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.min(env.maxImageBytes, 5 * 1024 * 1024), files: 1 } })

me.patch('/profile', async (req, res) => {
  const body = parse(
    z.object({
      displayName: z.string().trim().min(1).max(60).optional(),
      preferences: z
        .object({
          favoriteGenres: z.array(z.string()).max(17).optional(),
          autoplayTrailers: z.boolean().optional(),
          preferredQuality: z.enum(['480p', '720p', '1080p', '2160p']).optional(),
          subtitleLanguage: z.string().max(10).optional(),
          notifications: z.record(z.string(), z.boolean()).optional(),
        })
        .optional(),
    }),
    req.body,
  )
  const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      displayName: body.displayName,
      preferences: body.preferences ? { ...(current.preferences as object), ...body.preferences } : undefined,
    },
  })
  res.json({ user: toUser(user) })
})

me.post('/avatar', imageUpload.single('avatar'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose an image to upload.')
  let img: Buffer
  try {
    img = await sharp(req.file.buffer).rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 82 }).toBuffer()
  } catch {
    throw new HttpError(400, 'That file is not a supported image (JPEG, PNG, WebP, GIF or AVIF).')
  }
  const key = `images/avatars/${req.user!.id}-${Date.now()}.webp`
  await storage.put(key, img)
  const prev = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: `/media/${key}` } })
  if (prev.avatarUrl?.startsWith('/media/images/avatars/')) await storage.remove(prev.avatarUrl.slice('/media/'.length)).catch(() => {})
  res.json({ user: toUser(user) })
})

me.delete('/account', async (req, res) => {
  await prisma.user.delete({ where: { id: req.user!.id } })
  res.clearCookie('cv_session', { path: '/' })
  res.json({ ok: true })
})

// ── Watchlist / favourites ──────────────────────────────────────────────
me.get('/list', async (req, res) => {
  const rows = await prisma.watchlist.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { movie: { include: cardInclude } } })
  res.json(rows.map((r) => ({ movie: toCard(r.movie), favorite: r.favorite, addedAt: r.createdAt.toISOString() })))
})

me.put('/list/:movieId', async (req, res) => {
  const { favorite } = parse(z.object({ favorite: z.boolean().optional() }), req.body ?? {})
  const movieId = req.params.movieId
  const row = await prisma.watchlist.upsert({
    where: { userId_movieId: { userId: req.user!.id, movieId } },
    create: { userId: req.user!.id, movieId, favorite: favorite ?? false },
    update: favorite === undefined ? {} : { favorite },
  })
  res.json({ movieId: row.movieId, favorite: row.favorite })
})

me.delete('/list/:movieId', async (req, res) => {
  await prisma.watchlist.deleteMany({ where: { userId: req.user!.id, movieId: req.params.movieId } })
  res.json({ ok: true })
})

/** Merge a guest's on-device list into their account after sign-in. */
me.post('/list/sync', async (req, res) => {
  const { items } = parse(
    z.object({ items: z.array(z.object({ movieId: z.string(), favorite: z.boolean().default(false), addedAt: z.string().optional() })).max(500) }),
    req.body,
  )
  const valid = await prisma.movie.findMany({ where: { id: { in: items.map((i) => i.movieId) } }, select: { id: true } })
  const ok = new Set(valid.map((v) => v.id))
  for (const i of items.filter((x) => ok.has(x.movieId))) {
    await prisma.watchlist.upsert({
      where: { userId_movieId: { userId: req.user!.id, movieId: i.movieId } },
      create: { userId: req.user!.id, movieId: i.movieId, favorite: i.favorite, createdAt: i.addedAt ? new Date(i.addedAt) : undefined },
      update: i.favorite ? { favorite: true } : {},
    })
  }
  const rows = await prisma.watchlist.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { movie: { include: cardInclude } } })
  res.json(rows.map((r) => ({ movie: toCard(r.movie), favorite: r.favorite, addedAt: r.createdAt.toISOString() })))
})

// ── Playback progress / continue watching ────────────────────────────────
me.get('/history', async (req, res) => {
  const rows = await prisma.watchHistory.findMany({ where: { userId: req.user!.id }, orderBy: { updatedAt: 'desc' }, take: 100, include: { movie: { include: cardInclude } } })
  res.json(rows.map((r) => ({ movie: toCard(r.movie), position: r.playbackPosition, duration: r.duration, updatedAt: r.updatedAt.toISOString() })))
})

me.put('/history/:movieId', async (req, res) => {
  const body = parse(z.object({ position: z.number().min(0), duration: z.number().min(0) }), req.body)
  await prisma.watchHistory.upsert({
    where: { userId_movieId: { userId: req.user!.id, movieId: req.params.movieId } },
    create: { userId: req.user!.id, movieId: req.params.movieId, playbackPosition: body.position, duration: body.duration },
    update: { playbackPosition: body.position, duration: body.duration },
  })
  res.json({ ok: true })
})

me.delete('/history', async (req, res) => {
  await prisma.watchHistory.deleteMany({ where: { userId: req.user!.id } })
  res.json({ ok: true })
})

// ── Download history ─────────────────────────────────────────────────────
me.get('/downloads', async (req, res) => {
  const rows = await prisma.downloadEvent.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { movie: { include: cardInclude }, file: { select: { quality: true, format: true, fileSize: true } } },
  })
  res.json(rows.map((r) => ({ id: r.id, movie: toCard(r.movie), quality: r.file.quality, format: r.file.format, fileSize: Number(r.file.fileSize), fileId: r.fileId, createdAt: r.createdAt.toISOString() })))
})

me.delete('/downloads', async (req, res) => {
  await prisma.downloadEvent.updateMany({ where: { userId: req.user!.id }, data: { userId: null } })
  res.json({ ok: true })
})

// ── Ratings ─────────────────────────────────────────────────────────────
me.put('/ratings/:movieId', async (req, res) => {
  const { rating } = parse(z.object({ rating: z.number().int().min(1).max(10) }), req.body)
  await prisma.rating.upsert({
    where: { userId_movieId: { userId: req.user!.id, movieId: req.params.movieId } },
    create: { userId: req.user!.id, movieId: req.params.movieId, rating },
    update: { rating },
  })
  const agg = await prisma.rating.aggregate({ where: { movieId: req.params.movieId }, _avg: { rating: true }, _count: true })
  res.json({ myRating: rating, userRating: { average: Math.round((agg._avg.rating ?? 0) * 10) / 10, count: agg._count } })
})

me.get('/recommendations', async (req, res) => {
  res.json(await recommend({ userId: req.user!.id, limit: 24 }))
})
