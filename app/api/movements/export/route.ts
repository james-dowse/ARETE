import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import * as XLSX from 'xlsx'

export async function GET() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const movements = await prisma.movement.findMany({ orderBy: [{ bioType: 'asc' }, { name: 'asc' }] })

  const rows = movements.map(m => ({
    ID: m.id,
    MOVE: m.name,
    'TYPE BIOMECANIQUE': m.bioType,
    COMPLEXITY: m.complexity,
    EQUIPMENT: m.equipment ?? '',
    DESCRIPTION: m.description ?? '',
    VIDEO: m.videoUrl ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 10 },  // ID
    { wch: 40 },  // MOVE
    { wch: 20 },  // TYPE BIOMECANIQUE
    { wch: 14 },  // COMPLEXITY
    { wch: 16 },  // EQUIPMENT
    { wch: 50 },  // DESCRIPTION
    { wch: 60 },  // VIDEO
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Mouvements')

  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(raw, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="mouvements_${date}.xlsx"`,
    },
  })
}
