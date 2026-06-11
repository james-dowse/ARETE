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
