import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  const { id } = await params
  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== user.id) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const updated = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } })
  return NextResponse.json(updated)
}
