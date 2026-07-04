import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE } from '@/lib/session'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/', req.url))

  const invite = await prisma.invitedUser.findUnique({ where: { token } })
  if (!invite) return NextResponse.redirect(new URL('/?invite=invalid', req.url))

  // Marquer comme accepté si encore pending
  if (invite.status === 'pending') {
    await prisma.invitedUser.update({
      where: { token },
      data: { status: 'accepted', acceptedAt: new Date() },
    })
  }

  const res = NextResponse.redirect(new URL('/?welcome=1', req.url))
  res.cookies.set(SESSION_COOKIE, invite.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 an
  })
  return res
}
