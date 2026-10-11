import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// POST /api/workouts/claim — rattache tous les workouts userId=null au user connecté.
//
// Outil de migration legacy : les séances créées avant l'authentification n'ont
// pas de propriétaire. Réservé à l'administrateur, et pas seulement « connecté » :
// le updateMany ci-dessous ne filtre que sur userId=null, donc avec une simple
// session c'était premier arrivé premier servi sur TOUTES les séances
// orphelines, pour les trois comptes — et sans retour en arrière possible,
// puisque rien ne mémorise à qui elles appartenaient.
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const result = await prisma.workout.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  })

  return NextResponse.json({ claimed: result.count })
}
