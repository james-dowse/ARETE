import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH: update movement id and/or sets/reps
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wmId: string }> }
) {
  const { wmId } = await params
  const body = await req.json()
  const { newMovementId, sets, reps } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (newMovementId !== undefined) data.movementId = newMovementId
  if (sets !== undefined) data.sets = sets === '' || sets === null ? null : Number(sets)
  if (reps !== undefined) data.reps = reps === '' || reps === null ? null : String(reps)

  const updated = await prisma.workoutMovement.update({
    where: { id: wmId },
    data,
    include: { movement: true },
  })

  return NextResponse.json(updated)
}
