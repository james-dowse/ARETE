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
  const tagFilter = req.nextUrl.searchParams.get('tag') // optional tag filter

  // ── Workouts importés (SavedWorkout) ──────────────────────────────────────
  if (filter === 'saved') {
    // Si non authentifié → liste vide
    if (!currentUserId) return NextResponse.json([])

    const [rows, favIds] = await Promise.all([
      prisma.savedWorkout.findMany({
        where: {
          userId: currentUserId,
          workout: {
            NOT: { userId: currentUserId },
            ...(tagFilter ? { tags: { contains: tagFilter } } : {}),
          },
        },
        orderBy: { savedAt: 'desc' },
        include: { workout: { include: WORKOUT_INCLUDE } },
      }),
      prisma.favoriteWorkout.findMany({
        where: { userId: currentUserId },
        select: { workoutId: true },
      }),
    ])
    const favSet = new Set(favIds.map(f => f.workoutId))
    const result = rows.map(r => ({
      ...r.workout,
      _savedSource: r.source,
      _savedAt: r.savedAt,
      _lastViewedAt: r.lastViewedAt,
      isFavorite: favSet.has(r.workoutId),
    }))
    return NextResponse.json(result)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: Record<string, any> = {}

  if (filter === 'mine') {
    // Authentifié → ses workouts ; pas de session → workouts sans propriétaire (données legacy)
    const base = currentUserId ? { userId: currentUserId } : { userId: null }
    where = tagFilter ? { ...base, tags: { contains: tagFilter } } : base
  } else if (filter === 'community') {
    // Workouts d'autres utilisateurs identifiés — jamais les siens, jamais les anonymes
    const tagPart = tagFilter ? { tags: { contains: tagFilter } } : {}
    if (!currentUserId) {
      where = { userId: { not: null }, ...tagPart }
    } else {
      where = { userId: { not: null }, NOT: { userId: currentUserId }, ...tagPart }
    }
  }

  // savedBy n'est utile que pour la communauté (savoir si l'utilisateur a déjà sauvegardé)
  const needsSavedBy = filter === 'community' && !!currentUserId
  const needsFavorites = filter === 'mine' && !!currentUserId

  const [workouts, favIds] = await Promise.all([
    prisma.workout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ...WORKOUT_INCLUDE,
        ...(needsSavedBy
          ? { savedBy: { where: { userId: currentUserId! }, select: { id: true } } }
          : {}),
      },
      take: 100,
    }),
    needsFavorites
      ? prisma.favoriteWorkout.findMany({ where: { userId: currentUserId! }, select: { workoutId: true } })
      : Promise.resolve([] as { workoutId: string }[]),
  ])
  const favSet = new Set(favIds.map(f => f.workoutId))

  // Transformer savedBy → isSaved (booléen)
  const result = workouts.map(w => ({
    ...w,
    isSaved: needsSavedBy && Array.isArray((w as { savedBy?: { id: string }[] }).savedBy) && (w as { savedBy?: { id: string }[] }).savedBy!.length > 0,
    isFavorite: needsFavorites ? favSet.has(w.id) : undefined,
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

    const workout = await prisma.$transaction(async (tx) => {
      const w = await tx.workout.create({
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
        for (const b of blocks as { order: number; bioType?: string | null; instructions?: string | null; restAfter?: number | null; superset?: boolean }[]) {
          const block = await tx.workoutBlock.create({
            data: { workoutId: w.id, order: b.order, bioType: b.bioType || null, instructions: b.instructions || null, restAfter: b.restAfter != null ? Number(b.restAfter) : null, superset: !!b.superset },
          })
          blockIdMap[b.order] = block.id
        }
      }

      await tx.workoutMovement.createMany({
        data: (movements as { movementId: string; order: number; sets?: number; reps?: string; rest?: number; duration?: number | null; blockIndex?: number }[]).map((m) => ({
          workoutId: w.id,
          movementId: m.movementId,
          order: m.order,
          sets: m.sets || null,
          reps: m.reps || null,
          rest: m.rest != null ? Number(m.rest) : null,
          duration: m.duration != null ? Number(m.duration) : null,
          blockId: m.blockIndex !== undefined ? (blockIdMap[m.blockIndex] ?? null) : null,
        })),
      })

      return w
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
