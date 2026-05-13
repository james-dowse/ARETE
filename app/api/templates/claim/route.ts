import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// POST /api/templates/claim — rattache tous les templates userId=null au user connecté
export async function POST() {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const result = await prisma.workoutTemplate.updateMany({
    where: { userId: null },
    data: { userId: currentUserId },
  })

  return NextResponse.json({ claimed: result.count })
}
