import { createReadStream, promises as fsp } from 'node:fs'
import { Readable } from 'node:stream'
import type { StorageDriver } from './index.js'

/**
 * Supabase Storage driver.
 *  - Keys under `images/` and `trailers/` live in a PUBLIC bucket (artwork, avatars, trailers) and
 *    are served by redirecting to Supabase's CDN URL.
 *  - Everything else (movie files, HLS, subtitles) lives in a PRIVATE bucket. Files are only ever
 *    reached through short-lived signed URLs issued after the server's authorization checks.
 * Requires a service-role / secret key (server-side only, never shipped to the browser).
 */
export class SupabaseStorage implements StorageDriver {
  constructor(
    private url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, ''),
    private key = process.env.SUPABASE_SECRET_KEY ?? '',
    private publicBucket = process.env.SUPABASE_PUBLIC_BUCKET ?? 'public-assets',
    private privateBucket = process.env.SUPABASE_MEDIA_BUCKET ?? 'media',
  ) {
    if (!this.url) throw new Error('SUPABASE_URL is required when STORAGE_DRIVER=supabase')
    if (!this.key) console.warn('[storage] SUPABASE_SECRET_KEY is not set — uploads and private media will fail until it is configured.')
  }

  private bucketFor(key: string) {
    return /^(images|trailers)\//.test(key) ? this.publicBucket : this.privateBucket
  }
  private objectUrl(key: string) {
    return `${this.url}/storage/v1/object/${this.bucketFor(key)}/${key.split('/').map(encodeURIComponent).join('/')}`
  }
  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.key}`, apikey: this.key, ...extra }
  }

  async put(key: string, source: Readable | Buffer, contentType = 'application/octet-stream') {
    const body = (Buffer.isBuffer(source) ? new Uint8Array(source) : Readable.toWeb(source)) as BodyInit
    const init = {
      method: 'POST',
      headers: this.headers({ 'x-upsert': 'true', 'Content-Type': contentType, 'Cache-Control': 'max-age=2592000' }),
      body,
      duplex: 'half', // required by Node's fetch for streamed request bodies
    } as RequestInit
    const res = await fetch(this.objectUrl(key), init)
    if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${await res.text()}`)
  }

  async move(from: string, key: string, contentType?: string) {
    await this.put(key, createReadStream(from), contentType)
    await fsp.unlink(from).catch(() => {})
  }

  async stat(key: string) {
    const res = await fetch(this.objectUrl(key), { method: 'HEAD', headers: this.headers() })
    if (!res.ok) return null
    return { size: Number(res.headers.get('content-length') ?? 0) }
  }

  read(key: string, range?: { start: number; end: number }): Readable {
    const headers = this.headers(range ? { Range: `bytes=${range.start}-${range.end}` } : {})
    const stream = new Readable({ read() {} })
    fetch(this.objectUrl(key), { headers })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`Storage read failed (${res.status})`)
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) stream.push(Buffer.from(chunk))
        stream.push(null)
      })
      .catch((e) => stream.destroy(e))
    return stream
  }

  async remove(key: string) {
    const bucket = this.bucketFor(key)
    // Expand "directories" (e.g. an HLS folder) into their objects.
    const list = await fetch(`${this.url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: key, limit: 1000 }),
    })
    const items = list.ok ? ((await list.json()) as Array<{ name: string; id: string | null }>) : []
    const prefixes = [key, ...items.filter((i) => i.id).map((i) => `${key}/${i.name}`)]
    await fetch(`${this.url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes }),
    })
  }

  publicUrl(key: string) {
    if (this.bucketFor(key) !== this.publicBucket) return null
    return `${this.url}/storage/v1/object/public/${this.publicBucket}/${key.split('/').map(encodeURIComponent).join('/')}`
  }

  async signedUrl(key: string, opts: { expiresIn?: number; download?: string } = {}) {
    const res = await fetch(`${this.url}/storage/v1/object/sign/${this.bucketFor(key)}/${key.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: opts.expiresIn ?? 3600 }),
    })
    if (!res.ok) throw new Error(`Could not sign storage URL (${res.status})`)
    const { signedURL } = (await res.json()) as { signedURL: string }
    const u = new URL(`${this.url}/storage/v1${signedURL.startsWith('/') ? '' : '/'}${signedURL}`)
    if (opts.download) u.searchParams.set('download', opts.download)
    return u.toString()
  }
}
