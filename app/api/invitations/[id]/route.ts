import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// DELETE — révoquer une invitation
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Empêcher la suppression de son propre compte admin
  const target = await prisma.invitedUser.findUnique({ where: { id } })
  if (target && isAdmin(target.email)) {
    return NextResponse.json({ error: 'Impossible de supprimer le compte admin' }, { status: 403 })
  }

  try {
    await prisma.invitedUser.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })
  }
}
