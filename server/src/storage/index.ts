import { createReadStream, createWriteStream, existsSync, mkdirSync, promises as fsp } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { env } from '../lib/env.js'

/**
 * Object-storage abstraction. Media is addressed by opaque keys, never by public URLs, so a
 * production deployment can swap LocalStorage for S3 / R2 / GCS by implementing this interface
 * (e.g. returning a short-lived signed URL from `signedUrl` and redirecting to it).
 */
export interface StorageDriver {
  put(key: string, source: Readable | Buffer): Promise<void>
  move(fromAbsolutePath: string, key: string): Promise<void>
  stat(key: string): Promise<{ size: number } | null>
  read(key: string, range?: { start: number; end: number }): Readable
  remove(key: string): Promise<void>
  /** Local absolute path when available (dev only). */
  localPath?(key: string): string
}

function safeJoin(root: string, key: string) {
  const p = path.resolve(root, key)
  if (!p.startsWith(root + path.sep)) throw new Error('Invalid storage key')
  return p
}

export class LocalStorage implements StorageDriver {
  constructor(private root = env.storageDir) {
    mkdirSync(root, { recursive: true })
  }
  localPath(key: string) {
    return safeJoin(this.root, key)
  }
  async put(key: string, source: Readable | Buffer) {
    const p = this.localPath(key)
    mkdirSync(path.dirname(p), { recursive: true })
    if (Buffer.isBuffer(source)) await fsp.writeFile(p, source)
    else await pipeline(source, createWriteStream(p))
  }
  async move(from: string, key: string) {
    const p = this.localPath(key)
    mkdirSync(path.dirname(p), { recursive: true })
    try {
      await fsp.rename(from, p)
    } catch {
      await fsp.copyFile(from, p)
      await fsp.unlink(from)
    }
  }
  async stat(key: string) {
    const p = this.localPath(key)
    if (!existsSync(p)) return null
    const s = await fsp.stat(p)
    return { size: s.size }
  }
  read(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.localPath(key), range)
  }
  async remove(key: string) {
    await fsp.rm(this.localPath(key), { force: true, recursive: true })
  }
}

export const storage: StorageDriver = new LocalStorage()
