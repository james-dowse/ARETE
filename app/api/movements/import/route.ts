import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    const id = String(row['ID'] ?? '').trim()
    const name = String(row['MOVE'] ?? '').trim()
    const bioType = String(row['TYPE BIOMECANIQUE'] ?? '').trim()
    const complexity = String(row['COMPLEXITY'] ?? '').trim()
    const description = row['DESCRIPTION'] ? String(row['DESCRIPTION']).trim() : null
    const videoUrl = row['VIDEO'] ? String(row['VIDEO']).trim() : null

    if (!id || !name || !bioType || !complexity) {
      skipped++
      continue
    }

    try {
      await prisma.movement.upsert({
        where: { id },
        update: { name, bioType, complexity, description, videoUrl },
        create: { id, name, bioType, complexity, description, videoUrl },
      })
      imported++
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
