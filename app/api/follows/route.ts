import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Liste des ids de profils suivis par l'utilisateur courant — utilisé pour le
// filtre "Abonnements" de l'onglet Communauté (app/(app)/workouts/WorkoutsTabs.tsx).
export async function GET() {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ followedIds: [] })

  const follows = await prisma.follow.findMany({
    where: { followerId: currentUserId },
    select: { followedId: true },
  }) as { followedId: string }[]
  return NextResponse.json({ followedIds: follows.map(f => f.followedId) })
}
