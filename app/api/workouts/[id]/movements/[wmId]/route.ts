import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'

// Vérifie propriété du workout + appartenance du mouvement à ce workout
async function authorize(id: string, wmId: string) {
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const wm = await prisma.workoutMovement.findUnique({ where: { id: wmId }, select: { workoutId: true } })
  if (!wm || wm.workoutId !== id) {
    return NextResponse.json({ error: 'Mouvement introuvable' }, { status: 404 })
  }
  return null
}

// PATCH: update movement id and/or sets/reps/duration
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wmId: string }> }
) {
  const { id, wmId } = await params
  const denied = await authorize(id, wmId)
  if (denied) return denied
  const body = await req.json()
  const { newMovementId, sets, reps, duration, order } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (newMovementId !== undefined) data.movementId = newMovementId
  if (sets !== undefined) data.sets = sets === '' || sets === null ? null : Number(sets)
  if (reps !== undefined) data.reps = reps === '' || reps === null ? null : String(reps)
  if (duration !== undefined) data.duration = duration === '' || duration === null ? null : Number(duration)
  if (order !== undefined) data.order = Number(order)

  const updated = await prisma.workoutMovement.update({
    where: { id: wmId },
    data,
    include: { movement: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; wmId: string }> }
) {
  const { id, wmId } = await params
  const denied = await authorize(id, wmId)
  if (denied) return denied
  await prisma.workoutMovement.delete({ where: { id: wmId } })
  return NextResponse.json({ ok: true })
}
