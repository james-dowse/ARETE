import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE } from '@/lib/session'

// Connexion par code : saisi DANS l'app → pose le cookie dans le bon contexte
// (indispensable pour les PWA installées iOS/Android, cookies isolés de Safari/Chrome).
export async function POST(req: NextRequest) {
  const { email, code } = await req.json()
  if (!email?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'Email et code requis' }, { status: 400 })
  }
  const normalizedEmail = email.trim().toLowerCase()
  const cleanCode = String(code).trim()

  const user = await prisma.invitedUser.findUnique({ where: { email: normalizedEmail } })
  if (!user || !user.loginToken || !user.loginTokenExp || user.loginTokenExp.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 401 })
  }
  // loginToken = "<code>.<suffixe>"
  const storedCode = user.loginToken.split('.')[0]
  if (storedCode !== cleanCode) {
    return NextResponse.json({ error: 'Code incorrect' }, { status: 401 })
  }

  // Code à usage unique
  await prisma.invitedUser.update({
    where: { id: user.id },
    data: {
      loginToken: null,
      loginTokenExp: null,
      ...(user.status === 'pending' ? { status: 'accepted', acceptedAt: new Date() } : {}),
    },
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 an
  })
  return res
}
