import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const workouts = await prisma.workout.findMany({
    where: { movements: { some: { movementId: id } } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      duration: true,
      userId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      movements: { select: { id: true }, where: { movementId: id } },
      _count: { select: { movements: true } },
    },
  })
  return NextResponse.json(workouts)
}
