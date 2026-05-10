import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { sendWorkoutShareEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id: workoutId } = await params
  const { email } = await req.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 })
  }

  // Vérifier que le workout appartient bien à l'utilisateur courant
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { user: { select: { email: true } } },
  })

  if (!workout) {
    return NextResponse.json({ error: 'Workout introuvable' }, { status: 404 })
  }
  if (workout.userId !== currentUserId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Récupérer l'expéditeur
  const sender = await prisma.invitedUser.findUnique({ where: { id: currentUserId } })
  if (!sender) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  // Vérifier que le destinataire est un utilisateur ARETE actif
  const recipient = await prisma.invitedUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  })
  if (!recipient || recipient.status !== 'accepted') {
    return NextResponse.json(
      { error: 'Cet email ne correspond à aucun utilisateur ARETE actif' },
      { status: 404 },
    )
  }

  // Ne pas partager avec soi-même
  if (recipient.id === currentUserId) {
    return NextResponse.json({ error: 'Tu ne peux pas te partager un workout à toi-même' }, { status: 400 })
  }

  // Vérifier si un partage existe déjà (pending ou accepté)
  const existing = await prisma.workoutShare.findFirst({
    where: { workoutId, sharedToEmail: recipient.email, status: { in: ['pending', 'accepted'] } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Ce workout a déjà été partagé avec cet utilisateur' }, { status: 409 })
  }

  // Créer le partage
  const share = await prisma.workoutShare.create({
    data: {
      workoutId,
      sharedByUserId: currentUserId,
      sharedToEmail: recipient.email,
      sharedToUserId: recipient.id, // on lie directement puisqu'il est déjà inscrit
      status: 'pending',
    },
  })

  // Envoyer l'email
  try {
    await sendWorkoutShareEmail(recipient.email, sender.email, workout.name, share.token)
  } catch (err) {
    console.error('[share email]', err)
    // On ne bloque pas si l'email échoue — le partage est créé
  }

  return NextResponse.json({ ok: true, shareId: share.id })
}
