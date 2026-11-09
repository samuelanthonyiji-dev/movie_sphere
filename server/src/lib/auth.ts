import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from './env.js'
import { HttpError } from './http.js'
import { prisma } from './prisma.js'

export const SESSION_COOKIE = 'cv_session'
const SESSION_DAYS = 30

export interface SessionUser {
  id: string
  role: 'USER' | 'ADMIN'
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')

export function issueSession(res: Response, user: SessionUser) {
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: `${SESSION_DAYS}d` })
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: SESSION_DAYS * 86400_000,
    path: '/',
  })
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

/** Attaches req.user when a valid session cookie is present. Role is re-read from the DB. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret) as { sub: string }
      const u = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } })
      if (u) req.user = u
    } catch {
      /* invalid/expired token → treat as guest */
    }
  }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, 'Please sign in to continue.')
  next()
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, 'Please sign in to continue.')
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Administrator access required.')
  next()
}

/**
 * Simple CSRF defence: state-changing API requests must carry a custom header, which browsers
 * will not send cross-site without a CORS preflight (and we don't allow cross-origin credentials).
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  // `x-cinevault` is the pre-rename header name, still accepted for already-open clients.
  if (req.get('x-moviesphere') !== '1' && req.get('x-cinevault') !== '1') throw new HttpError(403, 'Missing CSRF header')
  next()
}
