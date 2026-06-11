import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// GET /api/planner?weekStart=2026-06-09  → entries for that week
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ entries: [] })

  const weekStartStr = req.nextUrl.searchParams.get('weekStart')
  if (!weekStartStr) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 })

  const weekStart = new Date(weekStartStr)

  const plan = await prisma.weekPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: {
      entries: {
        orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
        include: {
          workout: {
            select: {
              id: true, name: true, duration: true, tags: true,
              movements: { select: { movement: { select: { bioType: true } } } },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ entries: plan?.entries ?? [] })
}

// POST /api/planner  { workoutId, dayOfWeek, weekStart }
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { workoutId, dayOfWeek, weekStart: weekStartStr } = await req.json()
  if (!workoutId || dayOfWeek === undefined || !weekStartStr) {
    return NextResponse.json({ error: 'workoutId, dayOfWeek et weekStart requis' }, { status: 400 })
  }

  const weekStart = new Date(weekStartStr)

  const plan = await prisma.weekPlan.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: { userId, weekStart },
    update: {},
  })

  const maxOrder = await prisma.weekPlanEntry.aggregate({
    where: { weekPlanId: plan.id, dayOfWeek },
    _max: { order: true },
  })

  const entry = await prisma.weekPlanEntry.create({
    data: {
      weekPlanId: plan.id,
      workoutId,
      dayOfWeek,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      workout: {
        select: {
          id: true, name: true, duration: true, tags: true,
          movements: { select: { movement: { select: { bioType: true } } } },
        },
      },
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
