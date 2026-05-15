import { NextRequest, NextResponse } from 'next/server'
import { type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface Block {
  bioTypes?: string[]
  complexities?: string[]
  equipments?: string[]
  count: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const blocks: Block[] = body.blocks || []

  const result: { id: string; name: string; bioType: string; complexity: string; videoUrl: string | null; blockIndex: number }[] = []

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx]
    const where: Prisma.MovementWhereInput = {}
    if (block.bioTypes?.length) where.bioType = { in: block.bioTypes }
    if (block.complexities?.length) where.complexity = { in: block.complexities }
    if (block.equipments?.length) where.equipment = { in: block.equipments }

    const pool = await prisma.movement.findMany({ where })
    const picked = shuffle(pool).slice(0, block.count)

    result.push(...picked.map(m => ({
      id: m.id,
      name: m.name,
      bioType: m.bioType,
      complexity: m.complexity,
      videoUrl: m.videoUrl,
      blockIndex: blockIdx,
    })))
  }

  return NextResponse.json({ movements: result })
}
