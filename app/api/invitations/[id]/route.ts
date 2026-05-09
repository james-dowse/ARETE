import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE — révoquer une invitation
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.invitedUser.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })
  }
}
