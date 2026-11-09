/**
 * Seeds only structural data: genres, homepage sections and the first admin account.
 * Movies are NOT seeded — they come from external sources (see src/importers):
 *   npm run import:catalog -w server -- 100      (or Admin → Import, or IMPORT_ON_START=true)
 * Safe to re-run.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { loadEnv } from '../src/lib/env.js'
import { slugify } from '../src/lib/serialize.js'

loadEnv()
const prisma = new PrismaClient()

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
]

export const HOME_SECTIONS: Array<{ key: string; title: string }> = [
  { key: 'continue', title: 'Continue Watching' },
  { key: 'trending', title: 'Trending Now' },
  { key: 'popular', title: 'Popular Movies' },
  { key: 'recommended', title: 'Recommended For You' },
  { key: 'recent', title: 'Recently Added' },
  { key: 'latest', title: 'Latest Movies' },
  { key: 'top-rated', title: 'Top Rated Movies' },
  { key: 'most-downloaded', title: 'Most Downloaded' },
  { key: 'genre:comedy', title: 'Comedy Movies' },
  { key: 'genre:horror', title: 'Horror Movies' },
  { key: 'genre:sci-fi', title: 'Sci-Fi Movies' },
  { key: 'genre:crime', title: 'Crime & Noir' },
  { key: 'genre:action', title: 'Action Movies' },
  { key: 'genre:romance', title: 'Romance Movies' },
  { key: 'genre:adventure', title: 'Adventure Movies' },
  { key: 'genre:western', title: 'Westerns' },
  { key: 'featured', title: 'Featured Movies' },
  { key: 'series', title: 'TV Series' },
]

async function main() {
  for (const name of GENRES) await prisma.genre.upsert({ where: { slug: slugify(name) }, create: { name, slug: slugify(name) }, update: { name } })
  for (const [i, s] of HOME_SECTIONS.entries())
    await prisma.homeSection.upsert({ where: { key: s.key }, create: { key: s.key, title: s.title, sortOrder: i }, update: {} })

  const email = (process.env.ADMIN_EMAIL ?? 'admin@moviesphere.local').toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const existingAdmin = await prisma.user.findFirst({ where: { OR: [{ email }, { username: 'admin' }] } })
  if (existingAdmin) console.log(`✔ Admin account already exists (${existingAdmin.email})`)
  else if (password) {
    await prisma.user.upsert({
      where: { email },
      create: { email, username: 'admin', displayName: 'MovieSphere Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) },
      update: { role: 'ADMIN' },
    })
    console.log(`✔ Admin account: ${email} (password from ADMIN_PASSWORD — change it after first login)`)
  }
  console.log(`✔ Seeded ${GENRES.length} genres and ${HOME_SECTIONS.length} homepage sections. Import movies with: npm run import:catalog -w server`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
