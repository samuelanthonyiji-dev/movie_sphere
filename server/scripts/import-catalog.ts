/**
 * Imports licensed feature films from the Internet Archive (optionally enriched with TMDB).
 *   npx tsx scripts/import-catalog.ts [limit=50] [startPage=1]
 */
import { prisma } from '../src/lib/prisma.js'
import { getImportStatus, runImport } from '../src/importers/index.js'

const limit = Number(process.argv[2] ?? 50)
const startPage = Number(process.argv[3] ?? 1)
const timer = setInterval(() => {
  const s = getImportStatus()
  process.stdout.write(`\r${s.message} — new ${s.imported}, refreshed ${s.updated}, skipped ${s.skipped}   `)
}, 1000)
const r = await runImport({ limit, startPage })
clearInterval(timer)
console.log(`\n${r.message}`)
if (r.errors.length) console.log('Errors:\n' + r.errors.slice(0, 10).join('\n'))
await prisma.$disconnect()
