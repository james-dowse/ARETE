import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH: update movement id and/or sets/reps
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wmId: string }> }
) {
  const { wmId } = await params
  const body = await req.json()
  const { newMovementId, sets, reps, duration } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (newMovementId !== undefined) data.movementId = newMovementId
  if (sets !== undefined) data.sets = sets === '' || sets === null ? null : Number(sets)
  if (reps !== undefined) data.reps = reps === '' || reps === null ? null : String(reps)
  if (duration !== undefined) data.duration = duration === '' || duration === null ? null : Number(duration)

  const updated = await prisma.workoutMovement.update({
    where: { id: wmId },
    data,
    include: { movement: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ wmId: string }> }
) {
  const { wmId } = await params
  await prisma.workoutMovement.delete({ where: { id: wmId } })
  return NextResponse.json({ ok: true })
}
