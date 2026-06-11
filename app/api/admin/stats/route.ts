import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })

  const [
    totalUsers,
    totalWorkouts,
    totalMovements,
    totalSaved,
    totalFavorites,
    topMovements,
    workoutsByUser,
  ] = await Promise.all([
    prisma.invitedUser.count(),
    prisma.workout.count(),
    prisma.movement.count(),
    prisma.savedWorkout.count(),
    prisma.favoriteWorkout.count(),
    // Top 10 mouvements les plus utilisés dans les workouts
    prisma.workoutMovement.groupBy({
      by: ['movementId'],
      _count: { movementId: true },
      orderBy: { _count: { movementId: 'desc' } },
      take: 10,
    }),
    // Workouts par user (nombre de créations)
    prisma.workout.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ])

  // Résoudre noms des mouvements top
  const movIds = topMovements.map(m => m.movementId)
  const movNames = await prisma.movement.findMany({ where: { id: { in: movIds } }, select: { id: true, name: true, bioType: true } })
  const movMap = Object.fromEntries(movNames.map(m => [m.id, m]))

  // Résoudre emails des users top
  const uIds = workoutsByUser.map(u => u.userId).filter(Boolean) as string[]
  const users = await prisma.invitedUser.findMany({ where: { id: { in: uIds } }, select: { id: true, email: true } })
  const userMap = Object.fromEntries(users.map(u => [u.id, u.email]))

  return NextResponse.json({
    totals: { users: totalUsers, workouts: totalWorkouts, movements: totalMovements, saved: totalSaved, favorites: totalFavorites },
    topMovements: topMovements.map(m => ({
      movement: movMap[m.movementId] ?? { id: m.movementId, name: '?', bioType: '?' },
      count: m._count.movementId,
    })),
    workoutsByUser: workoutsByUser.map(u => ({
      email: u.userId ? (userMap[u.userId] ?? u.userId) : '(anonyme)',
      count: u._count.id,
    })),
  })
}
