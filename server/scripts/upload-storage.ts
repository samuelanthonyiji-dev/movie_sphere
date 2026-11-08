/**
 * Uploads the local storage directory (artwork, trailers, sample media, subtitles) to Supabase
 * Storage, mirroring the bucket layout used by SupabaseStorage:
 *   images/**, trailers/**  → SUPABASE_PUBLIC_BUCKET (default "public-assets")
 *   everything else          → SUPABASE_MEDIA_BUCKET  (default "media", private)
 *
 *   SUPABASE_URL=... SUPABASE_UPLOAD_KEY=<secret or temporary key> npx tsx scripts/upload-storage.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const STORAGE = path.resolve(process.env.STORAGE_DIR ?? './storage')
const URL_ = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_UPLOAD_KEY ?? process.env.SUPABASE_SECRET_KEY ?? ''
const PUBLIC = process.env.SUPABASE_PUBLIC_BUCKET ?? 'public-assets'
const MEDIA = process.env.SUPABASE_MEDIA_BUCKET ?? 'media'
if (!URL_ || !KEY) throw new Error('Set SUPABASE_URL and SUPABASE_UPLOAD_KEY (or SUPABASE_SECRET_KEY)')

const TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.vtt': 'text/vtt', '.srt': 'application/x-subrip',
}

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

let ok = 0, skipped = 0
for (const top of ['images', 'trailers', 'media', 'subtitles']) {
  let files: string[] = []
  try { files = [...walk(path.join(STORAGE, top))] } catch { continue }
  for (const file of files) {
    const key = path.relative(STORAGE, file).split(path.sep).join('/')
    const type = TYPES[path.extname(file)]
    if (!type) { skipped++; continue } // e.g. manifest.json
    const bucket = /^(images|trailers)\//.test(key) ? PUBLIC : MEDIA
    const res = await fetch(`${URL_}/storage/v1/object/${bucket}/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, 'Content-Type': type, 'Cache-Control': 'max-age=2592000' },
      body: new Uint8Array(readFileSync(file)),
    })
    if (res.ok) ok++
    else if (res.status === 409 || (await res.clone().text()).includes('Duplicate')) skipped++
    else throw new Error(`${key}: ${res.status} ${await res.text()}`)
    process.stdout.write(`\r${ok} uploaded, ${skipped} skipped — ${key.padEnd(60).slice(0, 60)} ${(statSync(file).size / 1024).toFixed(0)} KB`)
  }
}
console.log(`\n✔ Done: ${ok} uploaded, ${skipped} skipped`)
