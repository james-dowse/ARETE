import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Recherche de profil par nom OU email — contrairement à /api/search (qui exclut
// l'email pour la découverte publique de profils à suivre), ce point d'entrée
// sert à identifier précisément un destinataire (recommandation, assignation
// admin) : on cherche souvent quelqu'un dont on connaît le prénom mais pas
// l'orthographe exacte de l'email, ou l'inverse — d'où le OR sur les deux.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ users: [] })

  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const users = await prisma.invitedUser.findMany({
    where: {
      status: 'accepted',
      NOT: { id: userId },
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    take: 8,
  })

  return NextResponse.json({ users })
}
