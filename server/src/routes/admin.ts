import { Router } from 'express'
import { mkdirSync, promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import multer from 'multer'
import sharp from 'sharp'
import { z } from 'zod'
import { requireAdmin } from '../lib/auth.js'
import { env } from '../lib/env.js'
import { HttpError, num, parse, str } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { buildSearchText, slugify } from '../lib/serialize.js'
import { getImportStatus, runImport } from '../importers/index.js'
import { storage } from '../storage/index.js'

export const admin = Router()
admin.use(requireAdmin)

const tmpDir = path.join(os.tmpdir(), 'moviesphere-uploads')
mkdirSync(tmpDir, { recursive: true })

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxImageBytes, files: 1 } })
// Large media is streamed to disk, never held in memory.
const videoUpload = multer({ dest: tmpDir, limits: { fileSize: env.maxVideoBytes, files: 1 } })
const textUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } })

// ── Analytics ────────────────────────────────────────────────────────────
admin.get('/stats', async (_req, res) => {
  const since = new Date(Date.now() - 14 * 86400_000)
  const [users, movies, series, files, authorizedFiles, downloads, recent, top, reports, newUsers] = await Promise.all([
    prisma.user.count(),
    prisma.movie.count({ where: { type: 'MOVIE' } }),
    prisma.movie.count({ where: { type: 'SERIES' } }),
    prisma.movieFile.count(),
    prisma.movieFile.count({ where: { authorizationStatus: 'AUTHORIZED' } }),
    prisma.downloadEvent.count(),
    prisma.downloadEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.movie.findMany({ orderBy: { downloadCount: 'desc' }, take: 5, select: { title: true, slug: true, downloadCount: true, popularity: true } }),
    prisma.contentReport.count({ where: { status: 'open' } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
  ])
  const byDay: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) byDay[new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)] = 0
  for (const r of recent) {
    const d = r.createdAt.toISOString().slice(0, 10)
    if (d in byDay) byDay[d]++
  }
  res.json({ users, newUsers, movies, series, files, authorizedFiles, downloads, openReports: reports, downloadsByDay: Object.entries(byDay).map(([date, count]) => ({ date, count })), top })
})

// ── Movies ───────────────────────────────────────────────────────────────
const movieSchema = z.object({
  type: z.enum(['MOVIE', 'SERIES']).default('MOVIE'),
  title: z.string().trim().min(1).max(200),
  originalTitle: z.string().trim().max(200).nullish(),
  slug: z.string().trim().max(120).regex(/^[a-z0-9-]*$/).nullish(),
  tagline: z.string().trim().max(200).nullish(),
  description: z.string().trim().min(1).max(5000),
  releaseYear: z.coerce.number().int().min(1870).max(2100),
  runtime: z.coerce.number().int().min(1).max(1000),
  rating: z.coerce.number().min(0).max(10),
  ageRating: z.string().trim().max(10).default('NR'),
  country: z.string().trim().min(1).max(80),
  language: z.string().trim().min(1).max(80),
  director: z.string().trim().min(1).max(200),
  cast: z.array(z.string().trim().min(1)).max(50).default([]),
  production: z.string().trim().max(200).nullish(),
  trailerUrl: z.string().trim().max(500).refine((v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v), 'must be https:// or a site path').nullish(),
  genres: z.array(z.string()).max(10).default([]),
  rightsBasis: z.enum(['PUBLIC_DOMAIN', 'LICENSED', 'CREATOR_AUTHORIZED', 'PLATFORM_ORIGINAL', 'OPEN_LICENSE', 'METADATA_ONLY']),
  rightsNote: z.string().trim().max(2000).nullish(),
  featured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  popularity: z.coerce.number().int().min(0).default(0),
})

async function upsertGenres(movieId: string, slugs: string[]) {
  const genres = await prisma.genre.findMany({ where: { slug: { in: slugs } } })
  await prisma.movieGenre.deleteMany({ where: { movieId } })
  if (genres.length) await prisma.movieGenre.createMany({ data: genres.map((g) => ({ movieId, genreId: g.id })) })
  return genres.map((g) => g.name)
}

const adminMovieInclude = {
  genres: { include: { genre: true } },
  files: { orderBy: { createdAt: 'asc' as const } },
  subtitles: true,
  episodes: { orderBy: [{ season: 'asc' as const }, { number: 'asc' as const }] },
}

function adminMovie(m: Awaited<ReturnType<typeof loadMovie>>) {
  return { ...m, genres: m.genres.map((g) => g.genre.slug), files: m.files.map((f) => ({ ...f, fileSize: num(f.fileSize) })) }
}
const loadMovie = (id: string) => prisma.movie.findUniqueOrThrow({ where: { id }, include: adminMovieInclude })

admin.get('/movies', async (req, res) => {
  const q = str(req.query.q)?.toLowerCase()
  const page = Math.max(1, Number(str(req.query.page)) || 1)
  const where = q ? { searchText: { contains: q } } : {}
  const [total, rows] = await Promise.all([
    prisma.movie.count({ where }),
    prisma.movie.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: { id: true, slug: true, title: true, type: true, releaseYear: true, posterUrl: true, featured: true, isPublished: true, rightsBasis: true, downloadCount: true, _count: { select: { files: true } } },
    }),
  ])
  res.json({ items: rows, total, page, totalPages: Math.max(1, Math.ceil(total / 25)) })
})

admin.get('/movies/:id', async (req, res) => {
  res.json(adminMovie(await loadMovie(String(req.params.id))))
})

admin.post('/movies', async (req, res) => {
  const body = parse(movieSchema, req.body)
  const slug = body.slug || slugify(`${body.title}-${body.releaseYear}`)
  const { genres, ...data } = body
  const movie = await prisma.movie.create({ data: { ...data, slug, trailerUrl: data.trailerUrl || null, searchText: '' } })
  const names = await upsertGenres(movie.id, genres)
  await prisma.movie.update({ where: { id: movie.id }, data: { searchText: buildSearchText({ ...movie, genres: names }) } })
  res.status(201).json(adminMovie(await loadMovie(movie.id)))
})

admin.patch('/movies/:id', async (req, res) => {
  const body = parse(movieSchema.partial(), req.body)
  const { genres, ...data } = body
  const movie = await prisma.movie.update({ where: { id: String(req.params.id) }, data: { ...data, slug: data.slug || undefined, trailerUrl: data.trailerUrl === '' ? null : data.trailerUrl } })
  const names = genres ? await upsertGenres(movie.id, genres) : (await prisma.movieGenre.findMany({ where: { movieId: movie.id }, include: { genre: true } })).map((g) => g.genre.name)
  await prisma.movie.update({ where: { id: movie.id }, data: { searchText: buildSearchText({ ...movie, genres: names }) } })
  res.json(adminMovie(await loadMovie(movie.id)))
})

admin.delete('/movies/:id', async (req, res) => {
  const m = await prisma.movie.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { files: true, subtitles: true } })
  await prisma.movie.delete({ where: { id: m.id } })
  // Remove owned objects from storage (artwork and media uploaded through the dashboard).
  const keys = [...m.files.filter((f) => f.storageKey).map((f) => (f.format === 'hls' ? path.posix.dirname(f.storageKey!) : f.storageKey!)), ...m.subtitles.flatMap((s) => (s.storageKey ? [s.storageKey] : []))]
  for (const u of [m.posterUrl, m.backdropUrl]) if (u?.startsWith('/media/images/uploads/')) keys.push(u.slice('/media/'.length), u.slice('/media/'.length).replace(/-(780|1920)\.webp$/, (_x, s) => (s === '780' ? '-342.webp' : '-1280.webp')))
  await Promise.all(keys.map((k) => storage.remove(k).catch(() => {})))
  res.json({ ok: true })
})

// ── Artwork (validated + re-encoded with sharp into responsive WebP sizes) ──
async function processImage(buf: Buffer, sizes: number[], base: string) {
  let meta
  try {
    meta = await sharp(buf).metadata()
  } catch {
    throw new HttpError(400, 'That file is not a supported image (JPEG, PNG, WebP or AVIF).')
  }
  if (!meta.format || !['jpeg', 'png', 'webp', 'avif'].includes(meta.format)) throw new HttpError(400, 'Only JPEG, PNG, WebP or AVIF images are accepted.')
  for (const w of sizes) await storage.put(`${base}-${w}.webp`, await sharp(buf).rotate().resize({ width: w, withoutEnlargement: false }).webp({ quality: 80 }).toBuffer(), 'image/webp')
  return `/media/${base}-${sizes.at(-1)}.webp`
}

admin.post('/movies/:id/poster', imageUpload.single('image'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose an image.')
  const url = await processImage(req.file.buffer, [342, 780], `images/uploads/${String(req.params.id)}-poster-${Date.now()}`)
  await prisma.movie.update({ where: { id: String(req.params.id) }, data: { posterUrl: url } })
  res.json({ posterUrl: url })
})

admin.post('/movies/:id/backdrop', imageUpload.single('image'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose an image.')
  const url = await processImage(req.file.buffer, [1280, 1920], `images/uploads/${String(req.params.id)}-backdrop-${Date.now()}`)
  await prisma.movie.update({ where: { id: String(req.params.id) }, data: { backdropUrl: url } })
  res.json({ backdropUrl: url })
})

// ── Authorized media files ───────────────────────────────────────────────
async function sniffVideo(file: string): Promise<{ format: string; mime: string } | null> {
  const fh = await fsp.open(file, 'r')
  const buf = Buffer.alloc(16)
  await fh.read(buf, 0, 16, 0)
  await fh.close()
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return { format: 'mp4', mime: 'video/mp4' }
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return { format: 'webm', mime: 'video/webm' }
  return null
}

admin.post('/movies/:id/files', videoUpload.single('file'), async (req, res) => {
  const cleanup = () => req.file && fsp.rm(req.file.path, { force: true })
  try {
    if (!req.file) throw new HttpError(400, 'Choose a video file.')
    const body = parse(
      z.object({
        quality: z.enum(['480p', '720p', '1080p', '2160p']),
        language: z.string().trim().min(1).max(40),
        authorizationStatus: z.enum(['PENDING', 'AUTHORIZED', 'REVOKED']).default('PENDING'),
        authorizationNote: z.string().trim().min(5, 'describe the licence / permission').max(2000),
        rightsConfirmed: z.literal('true', { message: 'you must confirm you hold distribution rights' }),
        downloadable: z.enum(['true', 'false']).default('true'),
        streamable: z.enum(['true', 'false']).default('true'),
      }),
      req.body,
    )
    const sniff = await sniffVideo(req.file.path)
    if (!sniff) throw new HttpError(400, 'Only MP4 or WebM video files are accepted.')
    const movie = await prisma.movie.findUniqueOrThrow({ where: { id: String(req.params.id) } })
    const key = `media/${movie.slug}/${movie.slug}-${body.quality}-${Date.now()}.${sniff.format}`
    await storage.move(req.file.path, key, sniff.mime)
    const f = await prisma.movieFile.create({
      data: {
        movieId: movie.id,
        quality: body.quality,
        format: sniff.format,
        mimeType: sniff.mime,
        fileSize: BigInt(req.file.size),
        storageKey: key,
        language: body.language,
        authorizationStatus: body.authorizationStatus,
        authorizationNote: body.authorizationNote,
        downloadable: body.downloadable === 'true',
        streamable: body.streamable === 'true',
      },
    })
    res.status(201).json({ ...f, fileSize: num(f.fileSize) })
  } catch (e) {
    await cleanup()
    throw e
  }
})

admin.patch('/files/:id', async (req, res) => {
  const body = parse(
    z.object({
      authorizationStatus: z.enum(['PENDING', 'AUTHORIZED', 'REVOKED']).optional(),
      authorizationNote: z.string().max(2000).optional(),
      downloadable: z.boolean().optional(),
      streamable: z.boolean().optional(),
      quality: z.enum(['480p', '720p', '1080p', '2160p']).optional(),
      language: z.string().max(40).optional(),
    }),
    req.body,
  )
  const f = await prisma.movieFile.update({ where: { id: String(req.params.id) }, data: body })
  res.json({ ...f, fileSize: num(f.fileSize) })
})

admin.delete('/files/:id', async (req, res) => {
  const f = await prisma.movieFile.delete({ where: { id: String(req.params.id) } })
  if (f.storageKey) await storage.remove(f.format === 'hls' ? path.posix.dirname(f.storageKey) : f.storageKey).catch(() => {})
  res.json({ ok: true })
})

admin.post('/movies/:id/trailer', videoUpload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a video file.')
  const sniff = await sniffVideo(req.file.path)
  if (!sniff) {
    await fsp.rm(req.file.path, { force: true })
    throw new HttpError(400, 'Only MP4 or WebM video files are accepted.')
  }
  const key = `trailers/${String(req.params.id)}-${Date.now()}.${sniff.format}`
  await storage.move(req.file.path, key, sniff.mime)
  const m = await prisma.movie.update({ where: { id: String(req.params.id) }, data: { trailerUrl: `/media/${key}` } })
  res.json({ trailerUrl: m.trailerUrl })
})

// ── Subtitles ────────────────────────────────────────────────────────────
admin.post('/movies/:id/subtitles', textUpload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a subtitle file.')
  const body = parse(z.object({ language: z.string().trim().min(2).max(10), label: z.string().trim().min(1).max(40) }), req.body)
  const ext = path.extname(req.file.originalname).toLowerCase().slice(1)
  const text = req.file.buffer.toString('utf8')
  if (ext === 'vtt' && !text.trimStart().startsWith('WEBVTT')) throw new HttpError(400, 'VTT files must start with WEBVTT.')
  if (ext === 'srt' && !/\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(text)) throw new HttpError(400, 'That does not look like a valid SRT file.')
  if (ext !== 'vtt' && ext !== 'srt') throw new HttpError(400, 'Only .vtt or .srt subtitle files are accepted.')
  const movie = await prisma.movie.findUniqueOrThrow({ where: { id: String(req.params.id) } })
  const key = `subtitles/${movie.slug}/${body.language}-${Date.now()}.${ext}`
  await storage.put(key, req.file.buffer, ext === 'vtt' ? 'text/vtt' : 'application/x-subrip')
  const s = await prisma.subtitle.create({ data: { movieId: movie.id, language: body.language, label: body.label, format: ext, storageKey: key } })
  res.status(201).json(s)
})

admin.delete('/subtitles/:id', async (req, res) => {
  const s = await prisma.subtitle.delete({ where: { id: String(req.params.id) } })
  if (s.storageKey) await storage.remove(s.storageKey).catch(() => {})
  res.json({ ok: true })
})

// ── Episodes ─────────────────────────────────────────────────────────────
admin.post('/movies/:id/episodes', async (req, res) => {
  const body = parse(z.object({ season: z.number().int().min(1), number: z.number().int().min(1), title: z.string().min(1).max(200), runtime: z.number().int().min(1), synopsis: z.string().max(2000).optional() }), req.body)
  res.status(201).json(await prisma.episode.create({ data: { ...body, movieId: String(req.params.id) } }))
})
admin.delete('/episodes/:id', async (req, res) => {
  await prisma.episode.delete({ where: { id: String(req.params.id) } })
  res.json({ ok: true })
})

// ── Genres ───────────────────────────────────────────────────────────────
admin.post('/genres', async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(2).max(40) }), req.body)
  res.status(201).json(await prisma.genre.create({ data: { name, slug: slugify(name) } }))
})
admin.patch('/genres/:id', async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(2).max(40) }), req.body)
  res.json(await prisma.genre.update({ where: { id: String(req.params.id) }, data: { name, slug: slugify(name) } }))
})
admin.delete('/genres/:id', async (req, res) => {
  await prisma.genre.delete({ where: { id: String(req.params.id) } })
  res.json({ ok: true })
})

// ── Homepage sections ────────────────────────────────────────────────────
admin.get('/sections', async (_req, res) => {
  res.json(await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }))
})
admin.put('/sections', async (req, res) => {
  const items = parse(z.array(z.object({ id: z.string(), title: z.string().trim().min(1).max(60), enabled: z.boolean(), sortOrder: z.number().int() })), req.body)
  await prisma.$transaction(items.map((s) => prisma.homeSection.update({ where: { id: s.id }, data: { title: s.title, enabled: s.enabled, sortOrder: s.sortOrder } })))
  res.json(await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }))
})

// ── Users ────────────────────────────────────────────────────────────────
admin.get('/users', async (req, res) => {
  const q = str(req.query.q)
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, username: true, email: true, displayName: true, role: true, createdAt: true, _count: { select: { watchlist: true, downloads: true } } },
  })
  res.json(users)
})
admin.patch('/users/:id', async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(['USER', 'ADMIN']) }), req.body)
  if (String(req.params.id) === req.user!.id && role !== 'ADMIN') throw new HttpError(400, 'You cannot remove your own admin role.')
  const u = await prisma.user.update({ where: { id: String(req.params.id) }, data: { role }, select: { id: true, role: true } })
  res.json(u)
})

// ── Content reports ──────────────────────────────────────────────────────
admin.get('/reports', async (_req, res) => {
  res.json(await prisma.contentReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }))
})
admin.patch('/reports/:id', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['open', 'reviewing', 'resolved', 'rejected']) }), req.body)
  res.json(await prisma.contentReport.update({ where: { id: String(req.params.id) }, data: { status } }))
})

// ── External catalog import (Internet Archive + optional TMDB) ───────────
admin.get('/import', (_req, res) => {
  res.json(getImportStatus())
})
admin.post('/import', async (req, res) => {
  const body = parse(z.object({ limit: z.number().int().min(1).max(1000).default(50), startPage: z.number().int().min(1).optional() }), req.body ?? {})
  if (getImportStatus().running) throw new HttpError(409, 'An import is already running.')
  runImport(body).catch(() => {}) // runs in the background; poll GET /import
  res.status(202).json(getImportStatus())
})
