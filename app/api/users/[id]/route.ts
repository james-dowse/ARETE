import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Profil public : nom, avatar, bio uniquement — jamais l'email ni les champs
// d'authentification (token, loginToken). Pas un réseau social : pas de
// compteur d'abonnés exposé ici (voir /api/users/[id]/follow pour le statut
// d'abonnement de l'utilisateur courant, strictement privé).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // « Public » veut dire « visible des autres comptes invités », pas « ouvert
  // au tout-venant » : la route servait nom, bio, avatar et jusqu'à 100 séances
  // sans aucun cookie, alors que la route sœur /api/users/[id]/avatar pose un
  // 401 explicite pour cette exacte raison.
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const user = await prisma.invitedUser.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, bio: true, avatarUrl: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const workouts = await prisma.workout.findMany({
    where: { userId: id, public: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, createdAt: true, duration: true, imageUrl: true, imagePosition: true, tags: true,
      difficultyOverride: true,
      movements: { select: { movement: { select: { complexity: true } } } },
    },
    take: 100,
  })

  let isFollowing = false
  let notifyByEmail = true
  if (currentUserId !== id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId: currentUserId, followedId: id } },
    })
    isFollowing = !!follow
    notifyByEmail = follow?.notifyByEmail ?? true
  }

  return NextResponse.json({ user, workouts, isFollowing, notifyByEmail, isSelf: currentUserId === id })
}
