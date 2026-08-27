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

// PATCH { dayOfWeek?, order? } — déplace une entrée du planning.
// - dayOfWeek seul (déplacement vers un autre jour, drag and drop) : ajoutée
//   à la fin du jour cible.
// - order seul (réordonnancement au sein d'un même jour) : position exacte
//   fournie par le client, qui a déjà recalculé l'ordre de tout le jour.
// - les deux : déplacement vers un autre jour à une position précise.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const { dayOfWeek, order } = await req.json()
  if (dayOfWeek === undefined && order === undefined) {
    return NextResponse.json({ error: 'dayOfWeek et/ou order requis' }, { status: 400 })
  }
  if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
    return NextResponse.json({ error: 'dayOfWeek doit être entre 0 et 6' }, { status: 400 })
  }

  const entry = await prisma.weekPlanEntry.findUnique({
    where: { id },
    include: { weekPlan: { select: { id: true, userId: true } } },
  })
  if (!entry || entry.weekPlan.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (order !== undefined) {
    data.order = order
    if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek
  } else {
    // dayOfWeek seul : append à la fin du jour cible (comportement historique).
    const maxOrder = await prisma.weekPlanEntry.aggregate({
      where: { weekPlanId: entry.weekPlan.id, dayOfWeek },
      _max: { order: true },
    })
    data.dayOfWeek = dayOfWeek
    data.order = (maxOrder._max.order ?? -1) + 1
  }

  const updated = await prisma.weekPlanEntry.update({ where: { id }, data })
  return NextResponse.json(updated)
}
