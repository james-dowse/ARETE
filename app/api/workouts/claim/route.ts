import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// POST /api/workouts/claim — rattache tous les workouts userId=null au user connecté
export async function POST() {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const result = await prisma.workout.updateMany({
    where: { userId: null },
    data: { userId: currentUserId },
  })

  return NextResponse.json({ claimed: result.count })
}
