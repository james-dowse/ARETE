/**
 * Seed cross-platform — Mac / Windows / Linux
 * Lit prisma/movements-seed.json (exporté depuis le Mac)
 * Usage : npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import * as path from 'path'
import { readFileSync } from 'fs'

function buildLocalUrl(): string {
  const raw = (process.env.DATABASE_URL ?? 'file:./prisma/dev.db').replace(/^file:\/\//, 'file:')
  if (raw.startsWith('file:/')) return raw
  const rel = raw.replace(/^file:/, '')
  return `file:${path.resolve(process.cwd(), rel)}`
}

const adapter = new PrismaLibSql({ url: buildLocalUrl() })
const prisma = new PrismaClient({ adapter })

interface Movement {
  id: string
  name: string
  bioType: string
  complexity: string
  description?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
}

async function main() {
  const seedFile = path.join(__dirname, 'movements-seed.json')
  const movements: Movement[] = JSON.parse(readFileSync(seedFile, 'utf-8'))

  console.log(`Seeding ${movements.length} mouvements...`)

  let created = 0
  let skipped = 0

  for (const m of movements) {
    const exists = await prisma.movement.findUnique({ where: { id: m.id } })
    if (exists) { skipped++; continue }
    await prisma.movement.create({
      data: {
        id: m.id,
        name: m.name,
        bioType: m.bioType,
        complexity: m.complexity,
        description: m.description ?? null,
        imageUrl: m.imageUrl ?? null,
        videoUrl: m.videoUrl ?? null,
      },
    })
    created++
  }

  console.log(`✅ ${created} créés, ${skipped} déjà existants`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
