import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'

// POST: ajoute un mouvement à un workout (optionnellement dans un bloc), en fin de liste
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const body = await req.json()
  const { movementId, blockId } = body
  if (!movementId) return NextResponse.json({ error: 'movementId requis' }, { status: 400 })

  if (blockId) {
    const block = await prisma.workoutBlock.findUnique({ where: { id: blockId }, select: { workoutId: true } })
    if (!block || block.workoutId !== id) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
  }

  const last = await prisma.workoutMovement.findFirst({
    where: { workoutId: id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const created = await prisma.workoutMovement.create({
    data: {
      workoutId: id,
      movementId,
      blockId: blockId ?? null,
      order: (last?.order ?? -1) + 1,
      sets: 2,
      reps: '10',
    },
    include: { movement: true },
  })

  return NextResponse.json(created, { status: 201 })
}
