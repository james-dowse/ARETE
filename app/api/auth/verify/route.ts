import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE } from '@/lib/session'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/login?error=invalid_link', req.url))

  const user = await prisma.invitedUser.findUnique({ where: { loginToken: token } })
  if (!user || !user.loginTokenExp || user.loginTokenExp.getTime() < Date.now()) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', req.url))
  }

  // Token à usage unique
  await prisma.invitedUser.update({
    where: { id: user.id },
    data: {
      loginToken: null,
      loginTokenExp: null,
      ...(user.status === 'pending' ? { status: 'accepted', acceptedAt: new Date() } : {}),
    },
  })

  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 an
  })
  return res
}
