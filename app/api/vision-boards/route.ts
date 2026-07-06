import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json([])

  const boards = await prisma.visionBoard.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { slots: true },
  })
  return NextResponse.json(boards)
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = await req.json()
  const { name, pageSize, orientation, bgColor, slots } = body as {
    name: string; pageSize?: string; orientation?: string; bgColor?: string
    slots?: { x: number; y: number; w: number; h: number }[]
  }

  if (!name || !name.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const board = await prisma.visionBoard.create({
    data: {
      userId,
      name: name.trim(),
      pageSize: pageSize || 'A4',
      orientation: orientation || 'landscape',
      bgColor: bgColor || '#F1EAD8',
      slots: {
        create: (slots || []).map((s, i) => ({
          x: s.x, y: s.y, w: s.w, h: s.h, z: i, type: 'empty',
        })),
      },
    },
    include: { slots: true },
  })

  return NextResponse.json(board)
}
