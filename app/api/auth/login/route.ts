import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendMagicLinkEmail, sendLoginRelayEmail } from '@/lib/email'

const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.invitedUser.findUnique({ where: { email: normalizedEmail } })

  if (!user) {
    return NextResponse.json({ error: 'Adresse non reconnue' }, { status: 404 })
  }

  // Code à 6 chiffres (saisi dans l'app — marche dans les PWA iOS/Android) +
  // suffixe aléatoire pour garder loginToken unique et alimenter le lien magique.
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const loginToken = `${code}.${randomBytes(24).toString('hex')}`
  await prisma.invitedUser.update({
    where: { id: user.id },
    data: { loginToken, loginTokenExp: new Date(Date.now() + TOKEN_TTL_MS) },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'
  const loginUrl = `${appUrl}/api/auth/verify?token=${loginToken}`

  // Envoi direct ; si Resend refuse (plan sans domaine vérifié), relais vers l'admin
  let relayed = false
  try {
    await sendMagicLinkEmail(user.email, loginUrl, code)
  } catch (err) {
    console.error('[magic link email error]', err)
    const ownerEmail = process.env.RESEND_OWNER_EMAIL
    if (!ownerEmail) {
      return NextResponse.json({ error: "L'email de connexion n'a pas pu être envoyé. Réessaie ou contacte l'administrateur." }, { status: 502 })
    }
    try {
      await sendLoginRelayEmail(ownerEmail, user.email, loginUrl, code)
      relayed = true
    } catch (relayErr) {
      console.error('[login relay email error]', relayErr)
      return NextResponse.json({ error: "L'email de connexion n'a pas pu être envoyé. Réessaie ou contacte l'administrateur." }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: true, relayed })
}
