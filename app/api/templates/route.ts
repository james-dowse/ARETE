import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Parse a stored string value: JSON array or single string → string[]
function parseArr(v: string | null): string[] {
  if (!v) return []
  try {
    const p = JSON.parse(v)
    if (Array.isArray(p)) return p
    return [v]
  } catch {
    return [v]
  }
}

export async function GET() {
  const currentUserId = await getCurrentUserId()
  const templates = await prisma.workoutTemplate.findMany({
    where: currentUserId ? { userId: currentUserId } : { userId: null },
    orderBy: { createdAt: 'desc' },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })

  // Deserialize arrays stored as JSON strings
  const result = templates.map(t => ({
    ...t,
    blocks: t.blocks.map(b => ({
      ...b,
      bioTypes: parseArr(b.bioType),
      complexities: parseArr(b.complexity),
      equipments: parseArr(b.equipments),
    })),
  }))

  return NextResponse.json(result)
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
        create: (blocks as { bioTypes?: string[]; complexities?: string[]; equipments?: string[]; count: number; order: number }[]).map((b) => ({
          bioType: b.bioTypes?.length ? JSON.stringify(b.bioTypes) : null,
          complexity: b.complexities?.length ? JSON.stringify(b.complexities) : null,
          equipments: b.equipments?.length ? JSON.stringify(b.equipments) : null,
          count: Number(b.count),
          order: Number(b.order),
        })),
      },
    },
    include: { blocks: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(template)
}
