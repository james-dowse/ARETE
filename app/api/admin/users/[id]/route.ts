import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const target = await prisma.invitedUser.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true, bio: true, avatarUrl: true, status: true },
  })
  if (!target) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(target)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { firstName, lastName, bio, avatarUrl } = await req.json()
  const updated = await prisma.invitedUser.update({
    where: { id },
    data: {
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      bio: bio?.trim() || null,
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
    },
    select: { id: true, email: true, firstName: true, lastName: true, bio: true, avatarUrl: true },
  })
  return NextResponse.json(updated)
}
