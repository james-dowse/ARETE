import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/email'

// GET — liste des utilisateurs invités
export async function GET() {
  const users = await prisma.invitedUser.findMany({
    orderBy: { invitedAt: 'desc' },
  })
  return NextResponse.json(users)
}

// POST — inviter un nouvel utilisateur
export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Vérifier si déjà invité
  const existing = await prisma.invitedUser.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    // Re-envoyer l'invitation si toujours pending
    if (existing.status === 'pending') {
      try {
        await sendInvitationEmail(existing.email, existing.token)
      } catch (err) {
        return NextResponse.json(
          { error: `Email déjà invité — renvoi échoué : ${err instanceof Error ? err.message : 'Erreur inconnue'}` },
          { status: 500 }
        )
      }
      return NextResponse.json({ ...existing, resent: true })
    }
    return NextResponse.json({ error: 'Cet email a déjà accepté l\'invitation' }, { status: 409 })
  }

  // Créer l'entrée
  const invited = await prisma.invitedUser.create({
    data: { email: normalizedEmail },
  })

  // Envoyer l'email
  try {
    await sendInvitationEmail(invited.email, invited.token)
  } catch (err) {
    // Supprimer l'entrée si l'envoi échoue
    await prisma.invitedUser.delete({ where: { id: invited.id } })
    return NextResponse.json(
      { error: `Invitation créée mais email non envoyé : ${err instanceof Error ? err.message : 'Erreur inconnue'}` },
      { status: 500 }
    )
  }

  return NextResponse.json(invited, { status: 201 })
}
