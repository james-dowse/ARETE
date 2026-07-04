import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const template = await prisma.workoutTemplate.findUnique({ where: { id }, select: { userId: true } })
  if (!template) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (template.userId !== null && template.userId !== user.id && !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  await prisma.workoutTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
