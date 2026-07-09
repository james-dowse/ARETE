import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'

// Vérifie propriété du workout + appartenance du bloc à ce workout
async function authorize(id: string, blockId: string) {
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const block = await prisma.workoutBlock.findUnique({ where: { id: blockId }, select: { workoutId: true } })
  if (!block || block.workoutId !== id) {
    return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params
  const denied = await authorize(id, blockId)
  if (denied) return denied
  const { instructions, superset } = await req.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (instructions !== undefined) data.instructions = instructions === '' ? null : instructions
  if (superset !== undefined) data.superset = !!superset

  const updated = await prisma.workoutBlock.update({
    where: { id: blockId },
    data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params
  const denied = await authorize(id, blockId)
  if (denied) return denied
  await prisma.workoutBlock.delete({ where: { id: blockId } })
  return NextResponse.json({ ok: true })
}
