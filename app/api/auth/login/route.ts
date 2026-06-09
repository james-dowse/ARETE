import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE } from '@/lib/session'

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

  // Marquer comme accepté si encore pending
  if (user.status === 'pending') {
    await prisma.invitedUser.update({
      where: { id: user.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 an
  })
  return res
}
