import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id: workoutId } = await params

  const existing = await prisma.favoriteWorkout.findUnique({
    where: { userId_workoutId: { userId, workoutId } },
  })

  if (existing) {
    await prisma.favoriteWorkout.delete({ where: { id: existing.id } })
    return NextResponse.json({ favorited: false, workoutId })
  } else {
    await prisma.favoriteWorkout.create({ data: { userId, workoutId } })
    return NextResponse.json({ favorited: true, workoutId })
  }
}
