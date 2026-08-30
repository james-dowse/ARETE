import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const assignment = await prisma.assignedWorkout.findUnique({
    where: { id },
    select: { assignedToId: true, workout: { select: { name: true } } },
  })
  await prisma.assignedWorkout.delete({ where: { id } }).catch(() => null)

  // Symétrique à la notification de création (POST /api/admin/assignments) :
  // le coach peut aussi retirer un WOD déjà assigné, l'utilisateur doit le savoir.
  if (assignment) {
    await prisma.notification.create({
      data: {
        userId: assignment.assignedToId,
        title: 'WOD retiré par le coach',
        body: assignment.workout.name,
        link: '/workouts',
      },
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
