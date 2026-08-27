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
  // Compense un ancien bug côté client (voir app/(app)/planner/page.tsx) où
  // toISODate() décalait la date d'un jour pour les fuseaux en avance sur UTC
  // (Europe/Paris) : certains WeekPlan existants ont pu être créés sous ce
  // "lundi" décalé de -1 jour. On tente donc aussi la veille par sécurité.
  const shiftedWeekStart = new Date(weekStart.getTime() - 86400000)

  const entriesInclude = {
    orderBy: [{ dayOfWeek: 'asc' as const }, { order: 'asc' as const }],
    include: {
      workout: {
        select: {
          id: true, name: true, duration: true, tags: true,
          movements: { select: { movement: { select: { bioType: true } } } },
        },
      },
    },
  }

  // L'exact weekStart doit toujours primer : findFirst sur les deux candidats
  // sans tri ne garantit pas l'ordre, et peut renvoyer l'ancien plan "décalé"
  // (créé sous l'ancien bug côté client) alors qu'un plan à la bonne date,
  // avec des entrées plus récentes, existe déjà.
  const plan = await prisma.weekPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { entries: entriesInclude },
  }) ?? await prisma.weekPlan.findFirst({
    where: { userId, weekStart: shiftedWeekStart },
    include: { entries: entriesInclude },
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
