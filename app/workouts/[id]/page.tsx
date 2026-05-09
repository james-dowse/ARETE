import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import WorkoutDetailClient from './WorkoutDetailClient'

export const dynamic = 'force-dynamic'

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      movements: { include: { movement: true }, orderBy: { order: 'asc' } },
      blocks: { orderBy: { order: 'asc' } },
      template: true,
    },
  })
  if (!workout) notFound()

  return <WorkoutDetailClient workout={JSON.parse(JSON.stringify(workout))} />
}
