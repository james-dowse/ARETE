import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ workouts: [], movements: [] })

  const userId = await getCurrentUserId()

  const [workouts, movements] = await Promise.all([
    userId
      ? prisma.workout.findMany({
          where: {
            OR: [{ userId }, { savedBy: { some: { userId } } }],
            name: { contains: q },
          },
          select: { id: true, name: true, createdAt: true, duration: true, movements: { select: { movement: { select: { bioType: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.movement.findMany({
      where: { name: { contains: q } },
      select: { id: true, name: true, bioType: true, complexity: true },
      orderBy: { name: 'asc' },
      take: 6,
    }),
  ])

  return NextResponse.json({ workouts, movements })
}
