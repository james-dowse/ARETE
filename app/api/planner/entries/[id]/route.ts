import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  // Verify ownership via weekPlan
  const entry = await prisma.weekPlanEntry.findUnique({
    where: { id },
    include: { weekPlan: { select: { userId: true } } },
  })
  if (!entry || entry.weekPlan.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.weekPlanEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// PATCH { dayOfWeek } — déplace une entrée vers un autre jour (drag and drop
// du planner), en l'ajoutant à la fin du jour cible (même logique de order
// que POST /api/planner).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const { dayOfWeek } = await req.json()
  if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: 'dayOfWeek requis (0-6)' }, { status: 400 })
  }

  const entry = await prisma.weekPlanEntry.findUnique({
    where: { id },
    include: { weekPlan: { select: { id: true, userId: true } } },
  })
  if (!entry || entry.weekPlan.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const maxOrder = await prisma.weekPlanEntry.aggregate({
    where: { weekPlanId: entry.weekPlan.id, dayOfWeek },
    _max: { order: true },
  })

  const updated = await prisma.weekPlanEntry.update({
    where: { id },
    data: { dayOfWeek, order: (maxOrder._max.order ?? -1) + 1 },
  })

  return NextResponse.json(updated)
}
