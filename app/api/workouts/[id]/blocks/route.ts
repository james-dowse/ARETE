import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'
import { isBlockRole } from '@/lib/block-role'

// POST: ajoute un bloc vide en fin de séance. Les mouvements y sont ajoutés
// ensuite via POST /api/workouts/[id]/movements avec ce blockId.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const { bioType, instructions, superset, restAfter, role } = await req.json().catch(() => ({}))

  const last = await prisma.workoutBlock.findFirst({
    where: { workoutId: id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const created = await prisma.workoutBlock.create({
    data: {
      workoutId: id,
      order: (last?.order ?? -1) + 1,
      bioType: bioType || null,
      instructions: instructions || null,
      superset: !!superset,
      restAfter: restAfter ?? null,
      role: isBlockRole(role) ? role : null,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
