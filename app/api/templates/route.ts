import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export async function GET() {
  const currentUserId = await getCurrentUserId()
  const templates = await prisma.workoutTemplate.findMany({
    where: currentUserId ? { userId: currentUserId } : { userId: null },
    orderBy: { createdAt: 'desc' },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const currentUserId = await getCurrentUserId()
  const body = await req.json()
  const { name, blocks } = body

  const template = await prisma.workoutTemplate.create({
    data: {
      name,
      userId: currentUserId || null,
      blocks: {
        create: (blocks as { bioType: string | null; complexity: string | null; count: number; order: number }[]).map((b) => ({
          bioType: b.bioType || null,
          complexity: b.complexity || null,
          count: Number(b.count),
          order: Number(b.order),
        })),
      },
    },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(template)
}
