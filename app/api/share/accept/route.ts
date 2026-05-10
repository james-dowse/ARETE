import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/workouts?error=token_manquant', req.url))
  }

  const share = await prisma.workoutShare.findUnique({ where: { token } })
  if (!share) {
    return NextResponse.redirect(new URL('/workouts?error=lien_invalide', req.url))
  }
  if (share.status === 'accepted') {
    return NextResponse.redirect(new URL('/workouts?tab=community&info=deja_accepte', req.url))
  }

  // Vérifier que l'utilisateur connecté correspond bien au destinataire
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) {
    // Pas connecté → rediriger vers la page d'accueil (ou login)
    return NextResponse.redirect(new URL(`/?redirect_share=${token}`, req.url))
  }

  if (share.sharedToUserId && share.sharedToUserId !== currentUserId) {
    return NextResponse.redirect(new URL('/workouts?error=non_autorise', req.url))
  }

  // Accepter le partage
  await prisma.workoutShare.update({
    where: { token },
    data: {
      status: 'accepted',
      sharedToUserId: currentUserId,
      acceptedAt: new Date(),
    },
  })

  // Importer automatiquement le workout dans "Importés"
  await prisma.savedWorkout.upsert({
    where: { workoutId_userId: { workoutId: share.workoutId, userId: currentUserId } },
    create: { workoutId: share.workoutId, userId: currentUserId, source: 'shared' },
    update: {},
  })

  return NextResponse.redirect(new URL('/workouts?imported=1', req.url))
}
