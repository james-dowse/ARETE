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

  // « Affichable » veut dire active ET non vide — exactement le critère du
  // tableau de bord (app/(app)/dashboard/page.tsx). Le seul et même critère sert
  // aux deux gestes ci-dessous : sans ça, un corps fait d'espaces créait les
  // notifications puis les supprimait dans la même requête.
  const estAnnonce = key === 'announcement'
  const estVisible = updated.active && !!updated.body.trim()
  const etaitVisible = !!existing?.active && !!existing.body.trim()

  // Elle devient affichable, ou son texte change alors qu'elle l'est déjà :
  // une notification par utilisateur — pas de ligne "broadcast" partagée, un
  // readAt commun marquerait la notif lue pour tout le monde dès le premier
  // clic. C'est le seul déclencheur automatique pour ce contenu.
  if (estAnnonce && estVisible && (!etaitVisible || existing?.body !== updated.body)) {
    const users = await prisma.invitedUser.findMany({ select: { id: true } }) as { id: string }[]
    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, title: updated.title || 'Nouvelle annonce', body: updated.body, link: '/dashboard' })),
    })
  }

  // Le geste symétrique. Sans lui, une notification survit au contenu qu'elle
  // annonce : le tableau de bord ne lit que les contenus actifs et non vides,
  // donc dès que l'annonce est retirée, les notifications déjà parties renvoient
  // vers une page où il n’y a plus rien à voir — et rien ne les nettoie jamais.
  // C'était asymétrique avec les séances, où le retrait est déjà notifié
  // (app/api/admin/assignments/[id]/route.ts).
  //
  // Le filtre sur link est sûr : '/dashboard' est le SEUL lien produit par le
  // chemin des annonces, les deux autres sources de notifications du dépôt
  // écrivant '/workouts' ou '/workouts/<id>'. Si tu ajoutes une source qui
  // pointe vers l'accueil, il faudra distinguer autrement.
  // La condition ne regarde QUE l'état d'arrivée, pas la transition : si
  // l'annonce n'est pas affichable après cet enregistrement, aucune notification
  // ne doit plus pointer vers elle, qu'elle vienne d'être retirée ou qu'elle le
  // soit depuis des mois. Un simple ré-enregistrement rattrape donc les lignes
  // laissées par les versions antérieures à ce correctif, sans qu'on ait à
  // toucher la base à la main.
  if (estAnnonce && !estVisible) {
    await prisma.notification.deleteMany({ where: { link: '/dashboard' } }).catch(() => null)
  }

  return NextResponse.json(updated)
}
