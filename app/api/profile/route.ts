import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  return NextResponse.json({
    id: user.id, email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  const { firstName, lastName, bio } = await req.json()
  const updated = await prisma.invitedUser.update({
    where: { id: user.id },
    data: {
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      bio: bio?.trim() || null,
    },
  })
  return NextResponse.json({
    id: updated.id, email: updated.email,
    firstName: updated.firstName, lastName: updated.lastName,
    bio: updated.bio, avatarUrl: updated.avatarUrl,
  })
}
