/// <reference lib="webworker" />
/**
 * MovieSphere service worker (built by vite-plugin-pwa, injectManifest strategy).
 *
 * Caching strategy by resource type:
 *  - App shell (JS/CSS/fonts/icons/index.html) ...... precached, versioned by build hash
 *  - Navigations ..................................... network-first (3 s) → cached shell → offline.html
 *  - Public catalog API (home, movies, genres...) ... network-first, short-lived cache for offline browsing
 *  - Artwork (/media/images) ......................... cache-first with expiry (posters/backdrops)
 *  - Private API (/api/me, /api/auth, /api/admin) ... network-only, never cached
 *  - Movie files ..................................... NEVER cached automatically. Only files the user
 *    explicitly saved for offline (cv-offline-media-v1, written by the page) are served from cache,
 *    with HTTP Range support so the <video> element can seek.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { createPartialResponse } from 'workbox-range-requests'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

const OFFLINE_MEDIA = 'cv-offline-media-v1'

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Private / sensitive endpoints — never cached.
registerRoute(({ url }) => /^\/api\/(me|auth|admin)(\/|$)/.test(url.pathname), new NetworkOnly())
registerRoute(({ url }) => url.pathname.startsWith('/media/download/'), new NetworkOnly())

// Public catalog metadata — available offline once visited.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'cv-api-v1',
    networkTimeoutSeconds: 4,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * 86400 })],
  }),
)

// Artwork & avatars.
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/images/'),
  new CacheFirst({
    cacheName: 'cv-images-v1',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 86400, purgeOnQuotaError: true })],
  }),
)

// External artwork (Internet Archive thumbnails, TMDB posters/backdrops) — opaque responses are fine for <img>.
registerRoute(
  ({ url, request }) => request.destination === 'image' && (url.hostname === 'image.tmdb.org' || (url.hostname === 'archive.org' && url.pathname.startsWith('/services/img/'))),
  new CacheFirst({
    cacheName: 'cv-ext-images-v1',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 86400, purgeOnQuotaError: true })],
  }),
)

// User-saved offline media: serve from cache with Range support, otherwise go to network.
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/stream/'),
  async ({ request, url }) => {
    const cache = await caches.open(OFFLINE_MEDIA)
    const cached = await cache.match(url.pathname)
    if (cached) return request.headers.has('range') ? createPartialResponse(request, cached) : cached
    return fetch(request)
  },
)

// SPA navigations: network-first, fall back to the precached shell, then to the offline page.
const shell = createHandlerBoundToURL('/index.html')
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/media/'),
  async (opts) => {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 3000)
      const res = await fetch(opts.request, { signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) return res
      return shell(opts)
    } catch {
      try {
        return await shell(opts)
      } catch {
        return (await caches.match('/offline.html', { ignoreSearch: true })) ?? Response.error()
      }
    }
  },
)

setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') return (await caches.match('/offline.html', { ignoreSearch: true })) ?? Response.error()
  return Response.error()
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const w = wins.find((c) => 'focus' in c) as WindowClient | undefined
      if (w) return w.navigate(url).then((c) => c?.focus())
      return self.clients.openWindow(url)
    }),
  )
})
