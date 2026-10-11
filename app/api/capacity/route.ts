import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Capacité du catalogue : nombre de mouvements par (type biomécanique × complexité).
// Le générateur s'en sert pour ne jamais demander à un bloc plus de mouvements que
// la bibliothèque n'en contient, et pour écarter les catégories trop peu fournies
// sur les séances courtes.
export async function GET() {
  // Dessine la forme du référentiel ; servi sans cookie jusqu'ici, alors que
  // proxy.ts ne contrôle rien sous /api. Seul appelant : /generator, derrière
  // la garde de session des pages.
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

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
