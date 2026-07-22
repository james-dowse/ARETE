import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json([], { status: 200 })
  const { id: workoutId } = await params
  const sessions = await prisma.workoutSession.findMany({
    where: { workoutId, userId },
    orderBy: { doneAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(sessions)
}

interface IncomingSet {
  movementId: string
  setNumber: number
  reps?: number | null
  weight?: number | null
  rpe?: number | null
  completed?: boolean
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id: workoutId } = await params
  const body = await req.json().catch(() => ({}))
  const session = await prisma.workoutSession.create({
    data: { userId, workoutId, note: body.note || null },
  })

  // Log de performance par série (optionnel — rétro-compatible avec l'ancien "J'ai fait")
  const sets: IncomingSet[] = Array.isArray(body.sets) ? body.sets : []
  if (sets.length > 0) {
    await prisma.sessionSet.createMany({
      data: sets
        .filter(s => s.movementId && Number.isFinite(s.setNumber))
        .map(s => ({
          sessionId: session.id,
          movementId: s.movementId,
          setNumber: s.setNumber,
          reps: s.reps == null ? null : Math.round(s.reps),
          weight: s.weight == null ? null : s.weight,
          rpe: s.rpe == null ? null : Math.round(s.rpe),
          completed: s.completed ?? true,
        })),
    })
  }

  return NextResponse.json(session, { status: 201 })
}
