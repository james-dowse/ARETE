import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email) || !user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { workoutId, assignedToId, note, scheduledFor } = await req.json()
  if (!workoutId || !assignedToId) {
    return NextResponse.json({ error: 'workoutId et assignedToId requis' }, { status: 400 })
  }

  const [workout, target] = await Promise.all([
    prisma.workout.findUnique({ where: { id: workoutId }, select: { id: true, name: true } }),
    prisma.invitedUser.findUnique({ where: { id: assignedToId }, select: { id: true } }),
  ])
  if (!workout) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const assignment = await prisma.assignedWorkout.create({
    data: {
      workoutId,
      assignedToId,
      assignedById: user.id,
      note: note?.trim() || null,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    },
  })

  await prisma.notification.create({
    data: {
      userId: assignedToId,
      title: 'Nouveau WOD du coach',
      body: workout.name,
      link: `/workouts/${workoutId}`,
    },
  })

  return NextResponse.json(assignment)
}
