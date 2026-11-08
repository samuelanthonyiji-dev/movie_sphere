import express, { Router, type Request, type Response } from 'express'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { env } from '../lib/env.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { storage } from '../storage/index.js'

export const media = Router()

/**
 * Streams a stored object honouring HTTP Range requests (RFC 9110 §14). The file is piped from
 * storage chunk by chunk — it is never buffered fully in memory on the server or the client.
 */
async function sendObject(req: Request, res: Response, key: string, mime: string, disposition: string) {
  const st = await storage.stat(key)
  if (!st) throw new HttpError(404, 'File is missing from storage.')
  const size = st.size
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Disposition', disposition)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  const range = req.headers.range
  let start = 0
  let end = size - 1
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.split(',')[0].trim())
    if (!m || (m[1] === '' && m[2] === '')) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end()
      return
    }
    if (m[1] === '') {
      start = Math.max(0, size - Number(m[2]))
    } else {
      start = Number(m[1])
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
    }
    if (start > end || start >= size) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end()
      return
    }
    res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  }
  res.setHeader('Content-Length', String(end - start + 1))
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  try {
    await pipeline(storage.read(key, { start, end }), res)
  } catch (e) {
    // Client aborted (seek, cancel) — not an error worth logging.
    if ((e as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') console.warn('[media] stream error', (e as Error).message)
  }
}

async function authorizedFile(id: string) {
  const f = await prisma.movieFile.findUnique({ where: { id }, include: { movie: { select: { id: true, title: true, releaseYear: true, isPublished: true } } } })
  // Only files with an explicit AUTHORIZED distribution status are ever served.
  if (!f || f.authorizationStatus !== 'AUTHORIZED' || !f.movie.isPublished) throw new HttpError(404, 'Download currently unavailable.')
  return f
}

const safeName = (s: string) => s.replace(/[^\w\s().,&-]+/g, '').replace(/\s+/g, ' ').trim()

media.get('/download/:fileId', async (req, res) => {
  const f = await authorizedFile(req.params.fileId)
  if (!f.downloadable || f.format === 'hls') throw new HttpError(404, 'Download currently unavailable.')
  const filename = `${safeName(f.movie.title)} (${f.movie.releaseYear}) [${f.quality}].${f.format}`
  // Count a download once per transfer (initial request), not for every resumed range.
  const r = req.headers.range
  if (req.method === 'GET' && (!r || /^bytes=0-/.test(r))) {
    await prisma.$transaction([
      prisma.downloadEvent.create({ data: { movieId: f.movieId, fileId: f.id, userId: req.user?.id } }),
      prisma.movie.update({ where: { id: f.movieId }, data: { downloadCount: { increment: 1 } } }),
    ])
  }
  // Object storage with signed URLs: hand the transfer off to the CDN after the checks above.
  if (storage.signedUrl) {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, await storage.signedUrl(f.storageKey, { expiresIn: 6 * 3600, download: filename }))
    return
  }
  await sendObject(req, res, f.storageKey, f.mimeType, `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
})

media.get('/stream/:fileId', async (req, res) => {
  const f = await authorizedFile(req.params.fileId)
  if (!f.streamable || f.format === 'hls') throw new HttpError(404, 'Streaming unavailable.')
  if (storage.signedUrl) {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, await storage.signedUrl(f.storageKey, { expiresIn: 6 * 3600 }))
    return
  }
  await sendObject(req, res, f.storageKey, f.mimeType, 'inline')
})

/** HLS playlist + segments live next to each other under the playlist's directory. */
media.get('/hls/:fileId/:asset', async (req, res) => {
  const f = await authorizedFile(req.params.fileId)
  if (f.format !== 'hls' || !f.streamable) throw new HttpError(404, 'Streaming unavailable.')
  const asset = req.params.asset
  if (!/^[\w.-]+\.(m3u8|ts|m4s|mp4)$/.test(asset)) throw new HttpError(400, 'Invalid segment')
  const key = path.posix.join(path.posix.dirname(f.storageKey), asset)
  const mime = asset.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : asset.endsWith('.ts') ? 'video/mp2t' : 'video/mp4'
  await sendObject(req, res, key, mime, 'inline')
})

function srtToVtt(srt: string) {
  return 'WEBVTT\n\n' + srt.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2').trim() + '\n'
}

media.get('/subtitles/:file', async (req, res) => {
  const m = /^([\w-]+)\.(vtt|srt)$/.exec(req.params.file)
  if (!m) throw new HttpError(404, 'Subtitle not found')
  const sub = await prisma.subtitle.findUnique({ where: { id: m[1] }, include: { movie: { select: { slug: true, isPublished: true } } } })
  if (!sub || !sub.movie.isPublished) throw new HttpError(404, 'Subtitle not found')
  const chunks: Buffer[] = []
  for await (const c of storage.read(sub.storageKey)) chunks.push(c as Buffer)
  let text = Buffer.concat(chunks).toString('utf8')
  const want = m[2]
  if (want === 'vtt' && sub.format === 'srt') text = srtToVtt(text)
  res.setHeader('Content-Type', want === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="${sub.movie.slug}.${sub.language}.${want}"`)
  res.send(text)
})

// Public, non-sensitive assets: artwork, avatars and trailers.
for (const dir of ['images', 'trailers'] as const) {
  if (storage.publicUrl) {
    // Object storage: redirect to the public CDN URL.
    media.get(new RegExp(`^/${dir}/(.+)$`), (req, res) => {
      const key = `${dir}/${decodeURIComponent((req.params as Record<string, string>)[0])}`
      if (key.includes('..')) throw new HttpError(400, 'Invalid path')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.redirect(302, storage.publicUrl!(key)!)
    })
  } else {
    media.use(`/${dir}`, express.static(path.join(env.storageDir, dir), { maxAge: dir === 'images' ? '30d' : '7d', fallthrough: false }))
  }
}
