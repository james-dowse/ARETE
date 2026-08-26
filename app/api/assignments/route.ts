import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json([], { status: 200 })

  const assignments = await prisma.assignedWorkout.findMany({
    where: { assignedToId: user.id },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
    include: {
      workout: {
        include: {
          movements: { include: { movement: true } },
          blocks: true,
        },
      },
      assignedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  // Complétion déduite : une WorkoutSession du même workout par ce user, postérieure
  // à l'assignation, vaut "fait" — pas de champ "done" dupliqué en base.
  const sessions = await prisma.workoutSession.findMany({
    where: { userId: user.id, workoutId: { in: assignments.map(a => a.workoutId) } },
    select: { workoutId: true, doneAt: true },
  })

  const result = assignments.map(a => {
    const done = sessions.some(s => s.workoutId === a.workoutId && s.doneAt >= a.createdAt)
    return { ...a, done }
  })

  return NextResponse.json(result)
}
