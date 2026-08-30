import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// GET — vue d'ensemble de tous les WOD assignés, tous users confondus (dashboard
// de pilotage admin). La complétion se déduit comme dans /api/assignments : une
// WorkoutSession du même workout/user postérieure à l'assignation vaut "fait".
export async function GET() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Cast explicite : ce `findMany` à includes imbriqués pousse l'inférence de
  // type de Prisma au-delà de ce que TS résout correctement sous ce mode
  // strict (any implicite en cascade sur tout ce qui en dépend).
  const assignments = await prisma.assignedWorkout.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      workout: { select: { id: true, name: true, duration: true } },
      assignedTo: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
      assignedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  }) as ({ workoutId: string; assignedToId: string; createdAt: Date } & Record<string, unknown>)[]

  const sessions = await prisma.workoutSession.findMany({
    where: { workoutId: { in: assignments.map(a => a.workoutId) } },
    select: { userId: true, workoutId: true, doneAt: true },
  }) as { userId: string; workoutId: string; doneAt: Date }[]

  const result = assignments.map(a => {
    const done = sessions.some(s => s.userId === a.assignedToId && s.workoutId === a.workoutId && s.doneAt >= a.createdAt)
    return { ...a, done }
  })

  return NextResponse.json(result)
}

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
