import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data)
  if (!r.success) {
    const first = r.error.issues[0]
    throw new HttpError(400, first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', r.error.issues)
  }
  return r.data
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details })
    return
  }
  const e = err as { code?: string; status?: number; message?: string }
  if (e?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File is too large' })
    return
  }
  if (e?.code === 'P2002') {
    res.status(409).json({ error: 'A record with that value already exists' })
    return
  }
  if (e?.code === 'P2025') {
    res.status(404).json({ error: 'Not found' })
    return
  }
  console.error(err)
  res.status(e?.status ?? 500).json({ error: 'Something went wrong on our side. Please try again.' })
}

/** JSON-safe conversion for BigInt values returned by Prisma. */
export const num = (v: bigint | number) => (typeof v === 'bigint' ? Number(v) : v)

export function str(v: unknown): string | undefined {
  if (Array.isArray(v)) v = v[0]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}
