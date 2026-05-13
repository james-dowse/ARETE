import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// PATCH /api/movements/bulk — update bioType or complexity on multiple ids
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { ids, bioType, complexity } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids requis' }, { status: 400 })

  const data: Record<string, string> = {}
  if (bioType) data.bioType = bioType.trim()
  if (complexity) data.complexity = complexity.trim()
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

  await prisma.movement.updateMany({ where: { id: { in: ids } }, data })

  const updated = await prisma.movement.findMany({ where: { id: { in: ids } } })
  return NextResponse.json({ updated })
}

// DELETE /api/movements/bulk — delete multiple ids (skip those used in workouts)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids requis' }, { status: 400 })

  // Find which ones are used in workouts
  const usages = await prisma.workoutMovement.groupBy({
    by: ['movementId'],
    where: { movementId: { in: ids } },
    _count: true,
  })
  const usedIds = new Set(usages.map((u: { movementId: string }) => u.movementId))
  const deletableIds = ids.filter((id: string) => !usedIds.has(id))

  if (deletableIds.length > 0) {
    await prisma.movement.deleteMany({ where: { id: { in: deletableIds } } })
  }

  return NextResponse.json({
    deleted: deletableIds.length,
    skipped: usedIds.size,
    skippedIds: [...usedIds],
  })
}
