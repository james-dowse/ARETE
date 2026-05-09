import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const currentUserId = await getCurrentUserId()
  const filter = req.nextUrl.searchParams.get('filter') // 'mine' | 'community'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: Record<string, any> = {}
  if (filter === 'mine' && currentUserId) {
    where = { userId: currentUserId }
  } else if (filter === 'community' && currentUserId) {
    // Tous les workouts qui ne sont PAS de l'utilisateur courant
    where = { NOT: { userId: currentUserId } }
  }

  const workouts = await prisma.workout.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      movements: { include: { movement: true }, orderBy: { order: 'asc' } },
      user: { select: { id: true, email: true } },
    },
    take: 100,
  })
  return NextResponse.json(workouts)
}

export async function POST(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId()
    const body = await req.json()
    const { name, duration, notes, description, movements, templateId, blocks } = body

    const workout = await prisma.workout.create({
      data: {
        name,
        duration: duration ? Number(duration) : null,
        notes: notes || null,
        description: description || null,
        templateId: templateId || null,
        userId: currentUserId || null,
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
      data: (movements as { movementId: string; order: number; sets?: number; reps?: string; blockIndex?: number }[]).map((m) => ({
        workoutId: workout.id,
        movementId: m.movementId,
        order: m.order,
        sets: m.sets || null,
        reps: m.reps || null,
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
