import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { WORKOUT_SELECT } from '@/lib/workout-select'
import { getAvatarOwnerIds, withHasAvatar } from '@/lib/avatar-server'

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
      // Même projection légère que /api/workouts : l'onglet « WOD du coach »
      // affiche les mêmes cartouches. `movement: true` tirait description,
      // imageUrl et videoUrl de chaque mouvement de chaque WOD assigné.
      workout: { select: WORKOUT_SELECT },
      assignedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  }) as ({ workoutId: string; createdAt: Date; workout: { user: { id: string } | null } } & Record<string, unknown>)[]

  // Complétion déduite : une WorkoutSession du même workout par ce user, postérieure
  // à l'assignation, vaut "fait" — pas de champ "done" dupliqué en base.
  const [sessions, avatarOwners] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId: user.id, workoutId: { in: assignments.map(a => a.workoutId) } },
      select: { workoutId: true, doneAt: true },
    }) as Promise<{ workoutId: string; doneAt: Date }[]>,
    getAvatarOwnerIds(),
  ])

  const result = assignments.map(a => {
    const done = sessions.some(s => s.workoutId === a.workoutId && s.doneAt >= a.createdAt)
    return { ...a, workout: { ...a.workout, user: withHasAvatar(a.workout.user, avatarOwners) }, done }
  })

  return NextResponse.json(result)
}
