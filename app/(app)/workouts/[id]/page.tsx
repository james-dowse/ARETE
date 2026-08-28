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
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      movements: { include: { movement: true }, orderBy: { order: 'asc' } },
      blocks: { orderBy: { order: 'asc' } },
      template: true,
    },
  })
  if (!workout) notFound()

  return <WorkoutDetailClient workout={JSON.parse(JSON.stringify(workout))} backTo={from === 'admin' ? '/admin' : undefined} isAdmin={isAdmin(user?.email)} />
}
