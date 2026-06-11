import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

type Ctx = { params: Promise<{ id: string }> }

// POST — fire-and-forget from workout detail page to track last viewed
export async function POST(_: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ ok: false })

  const { id: workoutId } = await params

  await prisma.savedWorkout.updateMany({
    where: { workoutId, userId },
    data: { lastViewedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
