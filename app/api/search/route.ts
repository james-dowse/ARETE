import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { getAvatarOwnerIds, withHasAvatar } from '@/lib/avatar-server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ workouts: [], movements: [] })

  const userId = await getCurrentUserId()

  const [workouts, movements, users, avatarOwners] = await Promise.all([
    userId
      ? prisma.workout.findMany({
          where: {
            OR: [{ userId }, { savedBy: { some: { userId } } }],
            name: { contains: q },
          },
          select: { id: true, name: true, createdAt: true, duration: true, movements: { select: { movement: { select: { bioType: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.movement.findMany({
      where: { name: { contains: q }, custom: false },
      select: { id: true, name: true, bioType: true, complexity: true },
      orderBy: { name: 'asc' },
      take: 6,
    }),
    // Recherche par profil — nom/prénom uniquement (jamais l'email). Ouverte
    // à tout utilisateur connecté, pas réservée à l'admin : c'est le point
    // d'entrée pour trouver un profil à suivre (voir /users/[id]).
    userId
      ? prisma.invitedUser.findMany({
          where: {
            status: 'accepted',
            NOT: { id: userId },
            OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }],
          },
          // Pas d'`avatarUrl` (data URI base64) dans une recherche qui repart à
          // chaque frappe : l'image passe par /api/users/[id]/avatar.
          select: { id: true, firstName: true, lastName: true },
          take: 6,
        })
      : Promise.resolve([] as never[]),
    getAvatarOwnerIds(),
  ]) as [unknown[], unknown[], { id: string }[], Set<string>]

  return NextResponse.json({
    workouts,
    movements,
    users: users.map(u => withHasAvatar(u, avatarOwners)),
  })
}
