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
  // Log de performance par série (optionnel — rétro-compatible avec l'ancien "J'ai fait")
  const sets: IncomingSet[] = Array.isArray(body.sets) ? body.sets : []
  const rows = sets
    .filter(s => s.movementId && Number.isFinite(s.setNumber))
    .map(s => ({
      movementId: s.movementId,
      setNumber: s.setNumber,
      reps: s.reps == null ? null : Math.round(s.reps),
      weight: s.weight == null ? null : s.weight,
      rpe: s.rpe == null ? null : Math.round(s.rpe),
      completed: s.completed ?? true,
    }))

  // Les deux écritures sous une même transaction. Un échec du createMany
  // laissait jusqu'ici une séance sans aucune série : elle comptait comme faite
  // dans les statistiques et dans « la dernière fois », son contenu était perdu,
  // et rien ne la distinguait d'une séance où l'on n'avait rien noté. Un échec
  // franc vaut mieux — le client sait désormais garder la charge utile et
  // rejouer l'envoi.
  const session = await prisma.$transaction(async txArg => {
    // Même contournement que dans app/api/workouts/route.ts : sous TS strict, le
    // type du client de transaction de Prisma 7 perd ses délégués de modèle,
    // alors que son comportement à l'exécution est correct.
    const tx = txArg as unknown as typeof prisma
    const created = await tx.workoutSession.create({
      data: { userId, workoutId, note: body.note || null },
    })
    if (rows.length > 0) {
      await tx.sessionSet.createMany({
        data: rows.map(r => ({ ...r, sessionId: created.id })),
      })
    }
    return created
  })

  return NextResponse.json(session, { status: 201 })
}
