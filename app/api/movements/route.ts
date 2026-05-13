import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bioType = searchParams.get('bioType')
  const complexity = searchParams.get('complexity')
  const search = searchParams.get('search')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (bioType) where.bioType = bioType
  if (complexity) where.complexity = complexity
  if (search) where.name = { contains: search }

  const movements = await prisma.movement.findMany({
    where,
    orderBy: [{ name: 'asc' }],
  })
  return NextResponse.json(movements)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, name, bioType, complexity, description, imageUrl, videoUrl } = body

  if (!id?.trim() || !name?.trim() || !bioType?.trim() || !complexity?.trim()) {
    return NextResponse.json({ error: 'id, name, bioType et complexity sont requis' }, { status: 400 })
  }

  // Check unique ID
  const existing = await prisma.movement.findUnique({ where: { id: id.trim() } })
  if (existing) {
    return NextResponse.json({ error: `L'ID "${id.trim()}" existe déjà` }, { status: 409 })
  }

  const movement = await prisma.movement.create({
    data: {
      id: id.trim(),
      name: name.trim(),
      bioType: bioType.trim(),
      complexity: complexity.trim(),
      description: description?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      videoUrl: videoUrl?.trim() || null,
    },
  })
  return NextResponse.json(movement, { status: 201 })
}
