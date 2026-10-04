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

// PATCH: met à jour le mouvement référencé, ses séries/répétitions/durée/repos,
// son ordre, et son rattachement à un bloc (blockId)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wmId: string }> }
) {
  const { id, wmId } = await params
  const denied = await authorize(id, wmId)
  if (denied) return denied
  const body = await req.json()
  const { newMovementId, sets, reps, duration, rest, order, blockId } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (newMovementId !== undefined) data.movementId = newMovementId
  if (sets !== undefined) data.sets = sets === '' || sets === null ? null : Number(sets)
  if (reps !== undefined) data.reps = reps === '' || reps === null ? null : String(reps)
  if (duration !== undefined) data.duration = duration === '' || duration === null ? null : Number(duration)
  if (rest !== undefined) data.rest = rest === '' || rest === null ? null : Number(rest)
  if (order !== undefined) data.order = Number(order)

  // Rattachement à un bloc. Comme pour les autres champs, « blockId » absent du
  // corps ne touche à rien ; présent à null (ou chaîne vide) détache le
  // mouvement de son bloc. Validation reprise de
  // POST /api/workouts/[id]/movements : un bloc d'un AUTRE workout est refusé,
  // sinon un rattachement croisé corromprait deux séances d'un coup.
  if (blockId !== undefined) {
    const nouveauBlockId = blockId === '' || blockId === null ? null : String(blockId)
    if (nouveauBlockId !== null) {
      const block = await prisma.workoutBlock.findUnique({ where: { id: nouveauBlockId }, select: { workoutId: true } })
      if (!block || block.workoutId !== id) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
    }
    data.blockId = nouveauBlockId
  }

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
