import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/authz'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireUser()
  if (!authz.ok) return authz.response

  const original = await prisma.workout.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: 'asc' } },
      movements: { orderBy: { order: 'asc' } },
    },
  })
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Create the workout shell
  const copy = await prisma.workout.create({
    data: {
      name: `${original.name} (copie)`,
      duration: original.duration,
      notes: original.notes,
      templateId: original.templateId,
      userId: authz.userId,
    },
  })

  // Duplicate blocks and build old blockId → new blockId map
  const blockIdMap: Record<string, string> = {}
  for (const b of original.blocks) {
    const newBlock = await prisma.workoutBlock.create({
      data: {
        workoutId: copy.id,
        order: b.order,
        bioType: b.bioType,
        instructions: b.instructions,
      },
    })
    blockIdMap[b.id] = newBlock.id
  }

  // Duplicate movements, remapping blockId
  await prisma.workoutMovement.createMany({
    data: original.movements.map(m => ({
      workoutId: copy.id,
      movementId: m.movementId,
      order: m.order,
      sets: m.sets,
      reps: m.reps,
      duration: m.duration,
      blockId: m.blockId ? (blockIdMap[m.blockId] ?? null) : null,
    })),
  })

  return NextResponse.json(copy)
}
