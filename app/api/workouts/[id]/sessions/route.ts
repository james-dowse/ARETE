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

export async function POST(req: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id: workoutId } = await params
  const body = await req.json().catch(() => ({}))
  const session = await prisma.workoutSession.create({
    data: { userId, workoutId, note: body.note || null },
  })
  return NextResponse.json(session, { status: 201 })
}
