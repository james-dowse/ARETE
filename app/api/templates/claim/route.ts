import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// POST /api/templates/claim — rattache tous les templates userId=null au user connecté.
//
// Même raisonnement que /api/workouts/claim : outil de migration legacy réservé
// à l'administrateur. Le updateMany ne filtre que sur userId=null, donc une
// simple session suffisait pour s'attribuer d'un clic tous les templates
// orphelins des autres comptes, irréversiblement.
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const result = await prisma.workoutTemplate.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  })

  return NextResponse.json({ claimed: result.count })
}
