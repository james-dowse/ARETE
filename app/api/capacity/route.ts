import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Capacité du catalogue : nombre de mouvements par (type biomécanique × complexité).
// Le générateur s'en sert pour ne jamais demander à un bloc plus de mouvements que
// la bibliothèque n'en contient, et pour écarter les catégories trop peu fournies
// sur les séances courtes.
export async function GET() {
  const rows = await prisma.movement.groupBy({
    by: ['bioType', 'complexity'],
    _count: true,
  })

  const capacity: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    if (!capacity[r.bioType]) capacity[r.bioType] = {}
    capacity[r.bioType][r.complexity] = r._count
  }

  return NextResponse.json({ capacity })
}
