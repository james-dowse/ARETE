import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const m = await prisma.movement.findUnique({ where: { id } })
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(m)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { name, bioType, complexity, description, imageUrl, videoUrl } = body

  const m = await prisma.movement.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(bioType !== undefined && { bioType: bioType.trim() }),
      ...(complexity !== undefined && { complexity: complexity.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || null }),
      ...(videoUrl !== undefined && { videoUrl: videoUrl?.trim() || null }),
    },
  })
  return NextResponse.json(m)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  // Check if used in workouts
  const uses = await prisma.workoutMovement.count({ where: { movementId: id } })
  if (uses > 0) {
    return NextResponse.json(
      { error: `Ce mouvement est utilisé dans ${uses} workout${uses > 1 ? 's' : ''}. Supprimez-le de ces workouts d'abord.` },
      { status: 409 }
    )
  }
  await prisma.movement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
