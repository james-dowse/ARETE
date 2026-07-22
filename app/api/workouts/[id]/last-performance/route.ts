import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

type Ctx = { params: Promise<{ id: string }> }

// Renvoie, par movementId de ce workout : la perf de la dernière séance (série la
// plus lourde) + le record de charge tous workouts confondus (pour badge PR).
// Alimente les indices "la dernière fois : 45kg × 10" pendant la séance active.
export async function GET(_: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({}, { status: 200 })
  const { id: workoutId } = await params

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { movements: { select: { movementId: true } } },
  })
  if (!workout) return NextResponse.json({}, { status: 200 })

  const movementIds = [...new Set(workout.movements.map(m => m.movementId))]
  if (movementIds.length === 0) return NextResponse.json({}, { status: 200 })

  // Toutes les séries loggées par cet utilisateur pour ces mouvements, récentes d'abord
  const rows = await prisma.sessionSet.findMany({
    where: { movementId: { in: movementIds }, session: { userId } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: { movementId: true, reps: true, weight: true, setNumber: true, sessionId: true, createdAt: true },
  })

  const result: Record<string, {
    last: { weight: number | null; reps: number | null } | null
    bestWeight: number | null
  }> = {}

  for (const mid of movementIds) {
    const mine = rows.filter(r => r.movementId === mid)
    if (mine.length === 0) { result[mid] = { last: null, bestWeight: null }; continue }
    // Dernière séance = celle du set le plus récent
    const lastSessionId = mine[0].sessionId
    const lastSessionSets = mine.filter(r => r.sessionId === lastSessionId)
    // Série représentative = la plus lourde de cette séance
    const top = lastSessionSets.reduce((a, b) => ((b.weight ?? -1) > (a.weight ?? -1) ? b : a))
    const bestWeight = mine.reduce((max, r) => (r.weight != null && r.weight > max ? r.weight : max), -Infinity)
    result[mid] = {
      last: { weight: top.weight ?? null, reps: top.reps ?? null },
      bestWeight: Number.isFinite(bestWeight) ? bestWeight : null,
    }
  }

  return NextResponse.json(result)
}
