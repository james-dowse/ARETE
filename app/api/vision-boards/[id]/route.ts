import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

async function assertOwner(id: string, userId: string) {
  const board = await prisma.visionBoard.findUnique({ where: { id } })
  return board && board.userId === userId
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const board = await prisma.visionBoard.findUnique({
    where: { id },
    include: { slots: true },
  })
  if (!board || board.userId !== userId) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(board)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  if (!(await assertOwner(id, userId))) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const body = await req.json()
  const { name, pageSize, orientation, bgColor, slots } = body as {
    name?: string; pageSize?: string; orientation?: string; bgColor?: string
    slots?: {
      id?: string; x: number; y: number; w: number; h: number; z?: number
      type?: string; content?: string | null; color?: string | null
      fontSize?: number | null; fontWeight?: string | null; align?: string | null
    }[]
  }

  const board = await prisma.$transaction(async (tx) => {
    const updated = await tx.visionBoard.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(pageSize !== undefined ? { pageSize } : {}),
        ...(orientation !== undefined ? { orientation } : {}),
        ...(bgColor !== undefined ? { bgColor } : {}),
      },
    })

    if (slots) {
      await tx.visionSlot.deleteMany({ where: { boardId: id } })
      await tx.visionSlot.createMany({
        data: slots.map((s, i) => ({
          boardId: id,
          x: s.x, y: s.y, w: s.w, h: s.h,
          z: s.z ?? i,
          type: s.type || 'empty',
          content: s.content ?? null,
          color: s.color ?? null,
          fontSize: s.fontSize ?? null,
          fontWeight: s.fontWeight ?? null,
          align: s.align ?? null,
        })),
      })
    }

    return updated
  })

  const full = await prisma.visionBoard.findUnique({ where: { id: board.id }, include: { slots: true } })
  return NextResponse.json(full)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  if (!(await assertOwner(id, userId))) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  await prisma.visionBoard.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
