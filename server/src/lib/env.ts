import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Minimal .env loader (no dependency). Real environment variables take precedence. */
export function loadEnv(file = path.resolve(process.cwd(), '.env')) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnv()

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable ${name}`)
  return v
}

export const env = {
  get port() { return Number(process.env.PORT ?? 4000) },
  get jwtSecret() { return required('JWT_SECRET') },
  get publicOrigin() { return (process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '') },
  get storageDir() { return path.resolve(process.env.STORAGE_DIR ?? './storage') },
  get maxImageBytes() { return Number(process.env.MAX_IMAGE_MB ?? 10) * 1024 * 1024 },
  get maxVideoBytes() { return Number(process.env.MAX_VIDEO_MB ?? 4096) * 1024 * 1024 },
  get webDist() { return path.resolve(process.env.WEB_DIST ?? '../web/dist') },
  get isProd() { return process.env.NODE_ENV === 'production' },
}
