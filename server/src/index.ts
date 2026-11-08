import compression from 'compression'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { csrfGuard, optionalAuth } from './lib/auth.js'
import { env } from './lib/env.js'
import { errorHandler, HttpError } from './lib/http.js'
import { admin } from './routes/admin.js'
import { auth } from './routes/auth.js'
import { catalog } from './routes/catalog.js'
import { me } from './routes/me.js'
import { media } from './routes/media.js'
import { misc } from './routes/misc.js'
import { renderShell, robots, sitemap } from './seo.js'

const app = express()
// Number of proxies in front of the app (Render = 1; Vercel rewrite + Render = 2).
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1))
app.disable('x-powered-by')
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'"],
        upgradeInsecureRequests: env.publicOrigin.startsWith('https:') ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)
// Media is already compressed; don't waste CPU re-compressing (and break Range semantics).
app.use(compression({ filter: (req, res) => !req.path.startsWith('/media/') && compression.filter(req, res) }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use(optionalAuth)

app.use('/api', csrfGuard)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})
app.use('/api/auth', auth)
app.use('/api/me', me)
app.use('/api/admin', admin)
app.use('/api', catalog)
app.use('/api', misc)
app.use('/api', () => {
  throw new HttpError(404, 'Not found')
})
app.use('/media', media)
app.get('/sitemap.xml', sitemap)
app.get('/robots.txt', robots)

// Production: serve the built PWA. Hashed assets are immutable; the shell / SW are not.
app.use(
  express.static(env.webDist, {
    index: false,
    setHeaders(res, file) {
      if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      else res.setHeader('Cache-Control', 'no-cache')
      if (file.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json')
    },
  }),
)
app.get(/^(?!\/(api|media)\/).*/, renderShell)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`CineVault API listening on http://localhost:${env.port}`)
  console.log(`  storage: ${env.storageDir}`)
  console.log(`  web:     ${path.resolve(env.webDist)}`)
})
