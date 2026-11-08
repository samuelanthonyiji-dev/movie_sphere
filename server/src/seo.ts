import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Request, Response } from 'express'
import { env } from './lib/env.js'
import { prisma } from './lib/prisma.js'

const BRAND = process.env.BRAND_NAME ?? 'CineVault'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function sitemap(_req: Request, res: Response) {
  const o = env.publicOrigin
  const [movies, genres, cols] = await Promise.all([
    prisma.movie.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    prisma.genre.findMany({ select: { slug: true } }),
    prisma.collection.findMany({ select: { slug: true } }),
  ])
  const urls = [
    ...['/', '/movies', '/series', '/categories', '/latest', '/trending', '/collections', '/copyright', '/privacy', '/terms', '/contact'].map((p) => ({ loc: o + p })),
    ...genres.map((g) => ({ loc: `${o}/movies/${g.slug}` })),
    ...cols.map((c) => ({ loc: `${o}/collections/${c.slug}` })),
    ...movies.map((m) => ({ loc: `${o}/movie/${m.slug}`, lastmod: m.updatedAt.toISOString().slice(0, 10) })),
  ]
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${esc(u.loc)}</loc>${'lastmod' in u ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n')}\n</urlset>\n`,
  )
}

export function robots(_req: Request, res: Response) {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /media/download/\nDisallow: /profile\nDisallow: /downloads\n\nSitemap: ${env.publicOrigin}/sitemap.xml\n`)
}

let template: string | null = null
function getTemplate() {
  if (template && env.isProd) return template
  const file = path.join(env.webDist, 'index.html')
  template = existsSync(file) ? readFileSync(file, 'utf8') : null
  return template
}

/** Serves the SPA shell with route-specific <title>, description, Open Graph and JSON-LD injected. */
export async function renderShell(req: Request, res: Response) {
  const html = getTemplate()
  if (!html) {
    res.status(404).send('Frontend not built. Run `npm run build -w web`.')
    return
  }
  const o = env.publicOrigin
  let title = `${BRAND} — Discover & download authorized movies`
  let description = 'Discover, stream and download public-domain classics, licensed films and creator-authorized originals.'
  let image = `${o}/icons/og-image.png`
  let jsonLd = ''
  const m = /^\/movie\/([\w-]+)/.exec(req.path)
  if (m) {
    const movie = await prisma.movie.findFirst({ where: { slug: m[1], isPublished: true }, include: { genres: { include: { genre: true } } } })
    if (movie) {
      title = `${movie.title} (${movie.releaseYear}) — ${BRAND}`
      description = movie.description.slice(0, 160)
      if (movie.posterUrl) image = o + movie.posterUrl
      jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': movie.type === 'SERIES' ? 'TVSeries' : 'Movie',
        name: movie.title,
        alternateName: movie.originalTitle ?? undefined,
        description: movie.description,
        datePublished: String(movie.releaseYear),
        director: { '@type': 'Person', name: movie.director },
        actor: movie.cast.map((name) => ({ '@type': 'Person', name })),
        genre: movie.genres.map((g) => g.genre.name),
        image,
        url: `${o}/movie/${movie.slug}`,
        countryOfOrigin: movie.country,
        inLanguage: movie.language,
      }).replace(/</g, '\\u003c')
    }
  }
  const head = `<title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(o + req.path)}" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta property="og:type" content="${m ? 'video.movie' : 'website'}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(o + req.path)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}`
  res.setHeader('Cache-Control', 'no-cache')
  res.type('html').send(html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head))
}
