import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import * as XLSX from 'xlsx'
import * as path from 'path'

const adapter = new PrismaLibSql({ url: 'file:/Users/jamesdowse/arete-100/prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

const EXCEL_PATH = path.join(
  process.env.HOME || '/Users/jamesdowse',
  'Library/CloudStorage/GoogleDrive-jimmy.dowse@gmail.com/Mon Drive/000. ARETE 100 PROTOCOL/ARETE 100 - DATABASE - 2026 05 08.xlsx'
)

async function main() {
  console.log('Reading Excel file...')
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets['DATABASE']
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string>[]

  console.log(`Found ${rows.length} raw rows`)

  await prisma.movement.deleteMany()

  const seen = new Set<string>()
  const movements = rows
    .filter(row => row['ID'] && row['MOVE'])
    .map((row, idx) => {
      let id = String(row['ID']).trim()
      if (seen.has(id)) id = `${id}_${idx}`
      seen.add(id)
      return {
        id,
        name: String(row['MOVE']).trim(),
        bioType: String(row['TYPE BIOMECANIQUE'] || '').trim(),
        complexity: String(row['COMPLEXITY'] || '').trim(),
        description: row['DESCRIPTION'] ? String(row['DESCRIPTION']).trim() : null,
        imageUrl: row['IMAGE'] ? String(row['IMAGE']).trim() : null,
        videoUrl: row['VIDEO'] ? String(row['VIDEO']).trim() : null,
      }
    })

  await prisma.movement.createMany({ data: movements })
  console.log(`Seeded ${movements.length} movements`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
