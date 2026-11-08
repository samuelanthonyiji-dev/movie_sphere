import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { clearSession, hashPassword, issueSession, randomToken, requireAuth, sha256, verifyPassword } from '../lib/auth.js'
import { env } from '../lib/env.js'
import { HttpError, parse } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'

export const auth = Router()

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } })

const password = z.string().min(8, 'must be at least 8 characters').max(200)

export function toUser(u: { id: string; username: string; email: string; displayName: string | null; avatarUrl: string | null; role: string; preferences: unknown; createdAt: Date }) {
  return { id: u.id, username: u.username, email: u.email, displayName: u.displayName ?? u.username, avatarUrl: u.avatarUrl, role: u.role, preferences: u.preferences ?? {}, createdAt: u.createdAt.toISOString() }
}

auth.post('/register', limiter, async (req, res) => {
  const body = parse(
    z.object({
      username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'letters, numbers, dot, dash and underscore only'),
      email: z.string().trim().toLowerCase().email(),
      password,
    }),
    req.body,
  )
  const exists = await prisma.user.findFirst({ where: { OR: [{ email: body.email }, { username: body.username }] } })
  if (exists) throw new HttpError(409, exists.email === body.email ? 'An account with that email already exists.' : 'That username is taken.')
  const user = await prisma.user.create({ data: { username: body.username, email: body.email, passwordHash: await hashPassword(body.password) } })
  issueSession(res, user)
  res.status(201).json({ user: toUser(user) })
})

auth.post('/login', limiter, async (req, res) => {
  const body = parse(z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) }), req.body)
  const id = body.identifier.toLowerCase()
  const user = await prisma.user.findFirst({ where: { OR: [{ email: id }, { username: body.identifier }] } })
  // Always run bcrypt to keep timing similar for unknown users.
  const ok = await verifyPassword(body.password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv')
  if (!user || !ok) throw new HttpError(401, 'Incorrect email/username or password.')
  issueSession(res, user)
  res.json({ user: toUser(user) })
})

auth.post('/logout', (_req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

auth.get('/me', async (req, res) => {
  if (!req.user) {
    res.json({ user: null })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  res.json({ user: user ? toUser(user) : null })
})

auth.post('/forgot-password', limiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body)
  const user = await prisma.user.findUnique({ where: { email } })
  let devResetUrl: string | undefined
  if (user) {
    const token = randomToken()
    await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: sha256(token), resetExpires: new Date(Date.now() + 3600_000) } })
    const url = `${env.publicOrigin}/reset-password?token=${token}`
    // No mail provider is configured in this project. Plug one in here (e.g. SES, Postmark).
    console.info(`[auth] Password reset link for ${email}: ${url}`)
    if (!env.isProd) devResetUrl = url
  }
  // Same response whether or not the account exists (prevents account enumeration).
  res.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.', devResetUrl })
})

auth.post('/reset-password', limiter, async (req, res) => {
  const body = parse(z.object({ token: z.string().min(10), password }), req.body)
  const user = await prisma.user.findFirst({ where: { resetTokenHash: sha256(body.token), resetExpires: { gt: new Date() } } })
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired.')
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.password), resetTokenHash: null, resetExpires: null } })
  issueSession(res, user)
  res.json({ ok: true })
})

auth.post('/change-password', requireAuth, async (req, res) => {
  const body = parse(z.object({ current: z.string().min(1), next: password }), req.body)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
  if (!(await verifyPassword(body.current, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect.')
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.next) } })
  res.json({ ok: true })
})
