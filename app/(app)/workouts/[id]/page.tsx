import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import WorkoutDetailClient from './WorkoutDetailClient'

export const dynamic = 'force-dynamic'

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const [{ id }, { from }, user] = await Promise.all([params, searchParams, getCurrentUser()])
  // Les trois requêtes partent ensemble : compter les passages ne coûte pas un
  // aller-retour de plus, et les index posés sur WorkoutSession les rendent
  // triviales.
  const [workout, passages, dernier] = await Promise.all([
    prisma.workout.findUnique({
      where: { id },
      include: {
        movements: { include: { movement: true }, orderBy: { order: 'asc' } },
        blocks: { orderBy: { order: 'asc' } },
        template: true,
      },
    }),
    user ? prisma.workoutSession.count({ where: { workoutId: id, userId: user.id } }).catch(() => 0) : Promise.resolve(0),
    user ? prisma.workoutSession.findFirst({
      where: { workoutId: id, userId: user.id },
      orderBy: { doneAt: 'desc' },
      select: { doneAt: true },
    }).catch(() => null) : Promise.resolve(null),
  ])
  if (!workout) notFound()

  return (
    <WorkoutDetailClient
      workout={JSON.parse(JSON.stringify(workout))}
      backTo={from === 'admin' ? '/admin' : undefined}
      isAdmin={isAdmin(user?.email)}
      passages={passages}
      dernierPassage={dernier ? dernier.doneAt.toISOString() : null}
    />
  )
}
