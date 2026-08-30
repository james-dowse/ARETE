import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// Annule un import en supprimant les mouvements qu'il a créés — identifiés par
// `createdIds` renvoyé par POST /api/movements/import. Un mouvement déjà utilisé
// dans une séance (créée entre-temps) est protégé, comme pour une suppression
// individuelle : on ne supprime que ce qui peut l'être, et on dit lesquels non.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ids } = await req.json() as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids requis' }, { status: 400 })
  }

  const usages = await prisma.workoutMovement.groupBy({
    by: ['movementId'],
    where: { movementId: { in: ids } },
    _count: true,
  }) as { movementId: string }[]
  const usedIds = new Set(usages.map(u => u.movementId))

  const deletable = ids.filter(id => !usedIds.has(id))
  const blocked = ids.filter(id => usedIds.has(id))

  if (deletable.length > 0) {
    await prisma.movement.deleteMany({ where: { id: { in: deletable } } })
  }

  return NextResponse.json({ deleted: deletable, blocked })
}
