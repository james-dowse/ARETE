import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { requireWorkoutReader } from '@/lib/authz'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id: workoutId } = await params

  const existing = await prisma.favoriteWorkout.findUnique({
    where: { userId_workoutId: { userId, workoutId } },
  })

  if (existing) {
    // Retirer un favori ne passe pas par la garde de lecture : une séance
    // publique mise en privé entre-temps resterait sinon dans les favoris sans
    // aucun moyen de l'en sortir (la bascule répondrait 404 à chaque clic).
    await prisma.favoriteWorkout.delete({ where: { id: existing.id } })
    return NextResponse.json({ favorited: false, workoutId })
  }

  // Poser le favori, en revanche, exige de pouvoir lire la séance : sans ça on
  // épinglait n'importe quelle séance privée d'un autre compte, et elle
  // remontait ensuite dans la liste des favoris avec son nom et sa durée.
  const authz = await requireWorkoutReader(workoutId)
  if (!authz.ok) return authz.response

  await prisma.favoriteWorkout.create({ data: { userId, workoutId } })
  return NextResponse.json({ favorited: true, workoutId })
}
