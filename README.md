# CineVault — authorized movie discovery & download PWA

A full-stack, installable movie platform for **legally distributable** content: public-domain films,
licensed titles, creator-authorized uploads and platform originals.

- **web/** — React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query + Lucide, PWA via `vite-plugin-pwa` (custom Workbox service worker)
- **server/** — Node.js + Express 5 + Prisma + PostgreSQL, bcrypt + JWT (httpOnly cookie) auth, sharp image pipeline, Range-request media streaming

## Quick start

```bash
# 1. PostgreSQL 14+ running locally, then:
cp server/.env.example server/.env        # set JWT_SECRET, DATABASE_URL, ADMIN_PASSWORD
npm install
npm run db:migrate -w server             # applies prisma/migrations (incl. pg_trgm search index)
npm run media:generate                   # optional: needs ffmpeg — creates sample clips for the Originals
npm run db:seed -w server                # catalog, placeholder artwork, collections, admin user

# Development (API on :4000, Vite on :5173 with proxy)
npm run dev

# Production (one process serves API + built PWA, with SEO meta injection)
npm run build && NODE_ENV=production npm start   # → http://localhost:4000
```

Default admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (seed only). Change it immediately.
The service worker is only registered in production builds; PWA install requires HTTPS (or localhost).

## What is real and what is sample data

| Area | Status |
|---|---|
| Catalog (48 titles) | **Sample.** 16 fictional "CineVault Originals" + 32 real films believed to be US public domain (metadata only). |
| Download files | **Real pipeline, sample files.** Originals have short clips *generated locally by ffmpeg* (480p/720p/1080p MP4, an HLS stream, VTT subtitles), served with Range support. Public-domain classics have **no files**, so they correctly show *"Download currently unavailable."* No URLs are invented and nothing is scraped. |
| Artwork | **Generated placeholder SVGs** (marked as such). Replace via Admin → Titles → Artwork. |
| Ratings | "CineVault score" is editorial sample data and labelled as such. Member ratings are real (stored per user). |
| Download counts / popularity | Seeded sample values; real downloads increment them. |
| Auth | Real: bcrypt (cost 12), JWT in httpOnly SameSite cookie, CSRF header check, rate limiting. |
| Password reset email | **No mail provider configured.** The reset link is logged on the server and, in development only, shown on screen. Plug a provider into `server/src/routes/auth.ts`. |
| Object storage | `LocalStorage` driver behind a `StorageDriver` interface (`server/src/storage`). An S3/R2/GCS driver is not included — implement the interface for production. |
| Notifications | Local, opt-in (permission requested only when a toggle is turned on). No Web Push server is included. |

## Features

- **Home**: rotating cinematic hero, "Trends Now" (tabs + genre chips, as in the reference design), 16 admin-configurable carousels (Continue Watching, Trending, Popular, Recommended, Latest, Recently Added, Top Rated, Most Downloaded, genre rows, Featured, TV Series), trailer spotlight player, collections, recently viewed.
- **Browse / Categories / Search**: `/movies`, `/movies/action`, `/movies/1927`, `/series`, `/latest`, `/trending`, `/categories`, `/search?q=`. Combinable filters (genre, year, decade, country, language, min rating, quality, type, recently added, downloadable) with URL state, 7 sort orders, infinite scroll + "Load more", skeletons, empty/error states. Search covers title, original title, director, cast, country, language, genre and year (accent-insensitive, trigram-indexed), with a debounced live-suggestion overlay (press `/`), keyboard navigation and on-device search history.
- **Details** (`/movie/:slug`): backdrop, poster, full metadata, rights basis, episodes, member rating, related titles, share/copy link, report link, download table listing **only files that exist**.
- **Downloads**: "Download" verifies availability, then hands the authorized URL to the browser (status: *sent to browser* — the app never claims completion). "Save offline" streams into Cache Storage chunk by chunk with live progress/cancel/retry, checks quota, then **reads back and verifies size** before marking *available offline*. The service worker serves stored files with Range support for offline playback.
- **Player**: MP4 + HLS (hls.js lazy-loaded; native on Safari), quality switch preserving position, speed, subtitles, PiP, fullscreen (incl. iOS), resume, buffering/error/retry states, double-tap seek on touch, keyboard shortcuts (`space/k`, `j/l`, arrows, `m`, `f`, `c`, `p`, `<`/`>`, `0–9`). Never autoplays with sound.
- **My List / favourites**: IndexedDB for guests; synced to the account (guest list is merged on sign-in); mirrored locally for offline use.
- **Accounts & profile**: sign up, login, logout, forgot/reset password, change password, avatar upload, display name, preferences (genres, quality, subtitles), watch/download history, delete account.
- **Recommendations**: explainable genre-affinity × quality × popularity scoring (`server/src/recommend.ts`); guests get hints from on-device history.
- **Admin** (`/admin`, server-side role checks): analytics, title CRUD, artwork upload (sharp → responsive WebP), trailer upload, media upload streamed to disk with magic-byte validation and size limits, **mandatory rights confirmation + authorization status** (PENDING files are never served), subtitles (.vtt/.srt), episodes, genres, homepage sections, user roles, content reports.
- **PWA**: manifest, 192/512/maskable/Apple icons, custom install banner (Android/desktop prompt; Safari "Add to Home Screen" guide on iOS; hidden when installed), update prompt, offline indicator, offline fallback page, per-resource caching strategies (private API never cached).
- **SEO**: server-injected `<title>`, description, canonical, Open Graph and JSON-LD per title; `/sitemap.xml`, `/robots.txt`.
- **Legal**: copyright/takedown, privacy and terms templates (have them reviewed by counsel), contact and content-report forms.
- **Accessibility**: skip link, landmarks, labelled controls, focus-trapped modals, visible focus, reduced-motion support, captions, table view for charts.

## Deployment (Render + Supabase + Vercel)

| Piece | Where | Notes |
|---|---|---|
| PostgreSQL | Supabase project `movie-sphere` (eu-central-1) | App connects as role `cinevault_app` via the Supavisor pooler (6543 transaction for runtime, 5432 session for migrations). RLS is enabled on every table so Supabase's public REST API exposes nothing. |
| Object storage | Supabase Storage | `public-assets` (public: artwork, trailers, avatars) and `media` (private: films, HLS, subtitles; served only through short-lived signed URLs after authorization). |
| API (+ PWA) | Render web service `movie-sphere-api` (Frankfurt) | `render.yaml`. Runs `prisma migrate deploy` on start. Also serves the built PWA with per-page SEO tags. |
| Frontend | Vercel (root directory `web/`) | `web/vercel.json` rewrites `/api`, `/media`, `/sitemap.xml`, `/robots.txt` to Render, so cookies stay first-party. |

Render environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`, **`SUPABASE_SECRET_KEY`** (Supabase → Project Settings → API Keys → secret/service_role key; required for private media and admin uploads), `STORAGE_DRIVER=supabase`, `PUBLIC_ORIGIN`, `TRUST_PROXY` (1 direct, 2 behind Vercel), `NODE_ENV=production`, `NODE_VERSION=22`.

Uploading local sample media to Supabase: `SUPABASE_URL=… SUPABASE_SECRET_KEY=… npx tsx scripts/upload-storage.ts` (from `server/`).

Free-tier caveats: Render free instances sleep after ~15 min idle (first request takes up to a minute); Supabase free projects pause after a week of inactivity. Large admin video uploads through Vercel's rewrite are subject to Vercel's request-size limits — upload large files against the Render URL instead.

## Rebranding

Edit `web/src/config/brand.ts`, `web/public/manifest.webmanifest`, `web/index.html` and the icons in `web/public/icons/` (and `BRAND_NAME` env on the server).

## Legal note

Public-domain status is jurisdiction-specific; titles labelled "Public domain (US)" should be verified before you distribute files. Only upload files you have the right to distribute.
