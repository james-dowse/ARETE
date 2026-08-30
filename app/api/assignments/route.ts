import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json([], { status: 200 })

  // Cast explicite : ce `findMany` à includes profondément imbriqués pousse
  // l'inférence de type de Prisma au-delà de ce que TS résout correctement
  // sous ce mode strict (any implicite en cascade sur tout ce qui en dépend).
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
  }) as ({ workoutId: string; createdAt: Date } & Record<string, unknown>)[]

  // Complétion déduite : une WorkoutSession du même workout par ce user, postérieure
  // à l'assignation, vaut "fait" — pas de champ "done" dupliqué en base.
  const sessions = await prisma.workoutSession.findMany({
    where: { userId: user.id, workoutId: { in: assignments.map(a => a.workoutId) } },
    select: { workoutId: true, doneAt: true },
  }) as { workoutId: string; doneAt: Date }[]

  const result = assignments.map(a => {
    const done = sessions.some(s => s.workoutId === a.workoutId && s.doneAt >= a.createdAt)
    return { ...a, done }
  })

  return NextResponse.json(result)
}
