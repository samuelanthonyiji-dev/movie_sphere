import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { parse } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'

export const misc = Router()
const limiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } })

misc.post('/reports', limiter, async (req, res) => {
  const body = parse(
    z.object({
      kind: z.enum(['copyright', 'inappropriate', 'broken', 'other', 'contact']),
      movieSlug: z.string().max(200).optional(),
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email(),
      message: z.string().trim().min(10, 'please give a little more detail').max(5000),
    }),
    req.body,
  )
  const r = await prisma.contentReport.create({ data: body })
  res.status(201).json({ id: r.id, ok: true })
})

misc.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ ok: true })
})
