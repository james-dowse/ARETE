import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

type Ctx = { params: Promise<{ id: string }> }

// POST → importer/sauvegarder un workout depuis la communauté
export async function POST(req: NextRequest, { params }: Ctx) {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id: workoutId } = await params
  const workout = await prisma.workout.findUnique({ where: { id: workoutId } })
  if (!workout) return NextResponse.json({ error: 'Workout introuvable' }, { status: 404 })
  if (!workout.userId) {
    return NextResponse.json({ error: 'Ce workout ne peut pas être sauvegardé' }, { status: 400 })
  }
  if (workout.userId === currentUserId) {
    return NextResponse.json({ error: 'Tu ne peux pas sauvegarder ton propre workout' }, { status: 400 })
  }

  const saved = await prisma.savedWorkout.upsert({
    where: { workoutId_userId: { workoutId, userId: currentUserId } },
    create: { workoutId, userId: currentUserId, source: 'manual' },
    update: {}, // déjà sauvegardé → no-op
  })

  return NextResponse.json({ ok: true, savedId: saved.id })
}

// DELETE → retirer un workout importé
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id: workoutId } = await params

  await prisma.savedWorkout.deleteMany({
    where: { workoutId, userId: currentUserId },
  })

  return NextResponse.json({ ok: true })
}
