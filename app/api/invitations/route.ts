import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail, sendRelayEmail } from '@/lib/email'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { getAvatarOwnerIds, withHasAvatar } from '@/lib/avatar-server'

const appUrl =() => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// GET — liste des utilisateurs invités
export async function GET() {
  const deny = await requireAdmin()
  if (deny) return deny
  // Projection explicite plutôt qu'un `findMany` nu : celui-ci renvoyait aussi
  // `loginToken` / `loginTokenExp` (jetons de connexion magique, valables pour
  // ouvrir une session au nom de l'utilisateur) et `avatarUrl` (data URI base64
  // complet) pour chaque compte. Aucun des deux n'est utilisé par l'écran admin
  // — seul `token`, le jeton d'invitation, sert à composer le lien d'invitation.
  const users = await prisma.invitedUser.findMany({
    orderBy: { invitedAt: 'desc' },
    select: {
      id: true, email: true, token: true, status: true,
      invitedAt: true, acceptedAt: true,
      firstName: true, lastName: true, bio: true,
    },
  }) as { id: string }[]

  const avatarOwners = await getAvatarOwnerIds()
  return NextResponse.json(users.map(u => withHasAvatar(u, avatarOwners)))
}

// POST — inviter un nouvel utilisateur (ou renvoyer l'invitation)
export async function POST(req: NextRequest) {
  const deny = await requireAdmin()
  if (deny) return deny
  const { email } = await req.json()

  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Déjà invité ?
  const existing = await prisma.invitedUser.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ error: 'Cet utilisateur a déjà accepté l\'invitation' }, { status: 409 })
    }
    // Renvoyer l'invitation (pending)
    const inviteUrl = `${appUrl()}/api/invite/accept?token=${existing.token}`
    let emailOk = true
    let emailRelayed = false
    try { await sendInvitationEmail(existing.email, existing.token) }
    catch {
      const ownerEmail = process.env.RESEND_OWNER_EMAIL
      if (ownerEmail) {
        try { await sendRelayEmail(ownerEmail, existing.email, inviteUrl); emailRelayed = true }
        catch { emailOk = false }
      } else { emailOk = false }
    }
    return NextResponse.json({ ...existing, resent: true, emailOk, emailRelayed, inviteUrl })
  }

  // Créer l'utilisateur (toujours, même si l'email échoue)
  const invited = await prisma.invitedUser.create({
    data: { email: normalizedEmail },
  })

  const inviteUrl = `${appUrl()}/api/invite/accept?token=${invited.token}`
  let emailOk = true
  let emailRelayed = false
  let emailError = ''
  try {
    await sendInvitationEmail(invited.email, invited.token)
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err)
    console.error('[invite email error]', emailError)
    // Fallback : relay vers l'email du compte Resend (owner)
    const ownerEmail = process.env.RESEND_OWNER_EMAIL
    if (ownerEmail) {
      try {
        await sendRelayEmail(ownerEmail, invited.email, inviteUrl)
        emailRelayed = true
        emailOk = true
      } catch (relayErr) {
        console.error('[relay email error]', relayErr)
        emailOk = false
      }
    } else {
      emailOk = false
    }
  }

  return NextResponse.json({ ...invited, emailOk, emailRelayed, emailError, inviteUrl }, { status: 201 })
}
