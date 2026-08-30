import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

const TITLE_MAX = 60
const BODY_MAX: Record<string, number> = { app_info: 500, announcement: 280 }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { key } = await params
  const { title, body, active } = await req.json()

  const bodyMax = BODY_MAX[key] ?? 500
  if (title && title.length > TITLE_MAX) {
    return NextResponse.json({ error: `Titre trop long (max ${TITLE_MAX} caractères)` }, { status: 400 })
  }
  if (body && body.length > bodyMax) {
    return NextResponse.json({ error: `Texte trop long (max ${bodyMax} caractères)` }, { status: 400 })
  }

  const existing = await prisma.siteContent.findUnique({ where: { key } })
  const updated = await prisma.siteContent.upsert({
    where: { key },
    update: {
      title: title?.trim() || null,
      body: body?.trim() ?? '',
      active: !!active,
    },
    create: {
      key,
      title: title?.trim() || null,
      body: body?.trim() ?? '',
      active: !!active,
    },
  })

  // Une annonce qui passe active (ou dont le texte change pendant qu'elle l'est déjà)
  // déclenche une notification pour chaque utilisateur — pas de ligne "broadcast"
  // partagée : un readAt commun marquerait la notif lue pour tout le monde dès le
  // premier clic. C'est le seul déclencheur automatique pour ce contenu.
  const justPublished = key === 'announcement' && updated.active && updated.body
    && (!existing?.active || existing.body !== updated.body)
  if (justPublished) {
    const users = await prisma.invitedUser.findMany({ select: { id: true } }) as { id: string }[]
    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, title: updated.title || 'Nouvelle annonce', body: updated.body, link: '/dashboard' })),
    })
  }

  return NextResponse.json(updated)
}
