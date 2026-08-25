import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: followedId } = await params
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  if (currentUserId === followedId) return NextResponse.json({ error: 'Impossible de te suivre toi-même' }, { status: 400 })

  const target = await prisma.invitedUser.findUnique({ where: { id: followedId }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  await prisma.follow.upsert({
    where: { followerId_followedId: { followerId: currentUserId, followedId } },
    create: { followerId: currentUserId, followedId },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: followedId } = await params
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  await prisma.follow.deleteMany({ where: { followerId: currentUserId, followedId } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: followedId } = await params
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const { notifyByEmail } = await req.json()
  const updated = await prisma.follow.updateMany({
    where: { followerId: currentUserId, followedId },
    data: { notifyByEmail: !!notifyByEmail },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
