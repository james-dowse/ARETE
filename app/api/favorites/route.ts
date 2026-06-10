import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// GET /api/favorites — returns movementIds favorited by current user
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json([])

  const favs = await prisma.favoriteMovement.findMany({
    where: { userId },
    select: { movementId: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(favs.map(f => f.movementId))
}

// POST /api/favorites { movementId } — toggle favorite, returns { favorited: boolean }
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { movementId } = await req.json()
  if (!movementId) return NextResponse.json({ error: 'movementId requis' }, { status: 400 })

  const existing = await prisma.favoriteMovement.findUnique({
    where: { userId_movementId: { userId, movementId } },
  })

  if (existing) {
    await prisma.favoriteMovement.delete({ where: { id: existing.id } })
    return NextResponse.json({ favorited: false, movementId })
  } else {
    await prisma.favoriteMovement.create({ data: { userId, movementId } })
    return NextResponse.json({ favorited: true, movementId })
  }
}
