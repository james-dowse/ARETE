import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const WORKOUT_INCLUDE = {
  movements: { include: { movement: true }, orderBy: { order: 'asc' } },
  user: { select: { id: true, email: true } },
} as const

export async function GET(req: NextRequest) {
  try {
  const currentUserId = await getCurrentUserId()
  const filter = req.nextUrl.searchParams.get('filter') // 'mine' | 'saved' | 'community'

  // ── Workouts importés (SavedWorkout) ──────────────────────────────────────
  if (filter === 'saved') {
    // Si non authentifié → liste vide
    if (!currentUserId) return NextResponse.json([])

    const rows = await prisma.savedWorkout.findMany({
      where: {
        userId: currentUserId,
        workout: { NOT: { userId: currentUserId } }, // jamais ses propres créations
      },
      orderBy: { savedAt: 'desc' },
      include: {
        workout: {
          include: WORKOUT_INCLUDE,
        },
      },
    })
    // Aplatir : retourner les workouts avec metadata source/savedAt
    const result = rows.map(r => ({
      ...r.workout,
      _savedSource: r.source,
      _savedAt: r.savedAt,
    }))
    return NextResponse.json(result)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: Record<string, any> = {}

  if (filter === 'mine') {
    // Authentifié → ses workouts ; pas de session → workouts sans propriétaire (données legacy)
    where = currentUserId
      ? { userId: currentUserId }
      : { userId: null }
  } else if (filter === 'community') {
    // Workouts d'autres utilisateurs identifiés — jamais les siens, jamais les anonymes
    if (!currentUserId) {
      // Pas de session : communauté = workouts avec un userId (pas les anonymes qui sont "les siens")
      where = { userId: { not: null } }
    } else {
      where = { userId: { not: null }, NOT: { userId: currentUserId } }
    }
  }

  // savedBy n'est utile que pour la communauté (savoir si l'utilisateur a déjà sauvegardé)
  const needsSavedBy = filter === 'community' && !!currentUserId

  const workouts = await prisma.workout.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      ...WORKOUT_INCLUDE,
      ...(needsSavedBy
        ? { savedBy: { where: { userId: currentUserId! }, select: { id: true } } }
        : {}),
    },
    take: 100,
  })

  // Transformer savedBy → isSaved (booléen)
  const result = workouts.map(w => ({
    ...w,
    isSaved: needsSavedBy && Array.isArray((w as { savedBy?: { id: string }[] }).savedBy) && (w as { savedBy?: { id: string }[] }).savedBy!.length > 0,
    savedBy: undefined,
  }))

  return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/workouts]', err)
    return NextResponse.json({ error: 'Erreur serveur', details: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId()
    const body = await req.json()
    const { name, duration, notes, description, movements, templateId, blocks, blockRest } = body

    const workout = await prisma.workout.create({
      data: {
        name,
        duration: duration ? Number(duration) : null,
        notes: notes || null,
        description: description || null,
        templateId: templateId || null,
        userId: currentUserId || null,
        blockRest: blockRest != null ? Number(blockRest) : null,
      },
    })

    const blockIdMap: Record<number, string> = {}
    if (blocks && blocks.length > 0) {
      for (const b of blocks as { order: number; bioType?: string | null; instructions?: string | null }[]) {
        const block = await prisma.workoutBlock.create({
          data: { workoutId: workout.id, order: b.order, bioType: b.bioType || null, instructions: b.instructions || null },
        })
        blockIdMap[b.order] = block.id
      }
    }

    await prisma.workoutMovement.createMany({
      data: (movements as { movementId: string; order: number; sets?: number; reps?: string; rest?: number; blockIndex?: number }[]).map((m) => ({
        workoutId: workout.id,
        movementId: m.movementId,
        order: m.order,
        sets: m.sets || null,
        reps: m.reps || null,
        rest: m.rest != null ? Number(m.rest) : null,
        blockId: m.blockIndex !== undefined ? (blockIdMap[m.blockIndex] ?? null) : null,
      })),
    })

    const full = await prisma.workout.findUnique({
      where: { id: workout.id },
      include: {
        blocks: { orderBy: { order: 'asc' } },
        movements: { include: { movement: true }, orderBy: { order: 'asc' } },
      },
    })
    return NextResponse.json(full)
  } catch (err) {
    console.error('[POST /api/workouts]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
