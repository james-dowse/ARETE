import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, getCurrentUserId } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { nextMovementId } from '@/lib/movement-id'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bioType = searchParams.get('bioType')
  const complexity = searchParams.get('complexity')
  const equipment = searchParams.get('equipment')
  const search = searchParams.get('search')
  const favoritesOnly = searchParams.get('favorites') === '1'

  // Chaque paramètre accepte une valeur unique ou une liste séparée par des
  // virgules (multi-sélection) — ex. bioType=Mobilité,Core.
  const toValues = (v: string | null) => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []
  const asFilter = (values: string[]) => values.length === 1 ? values[0] : { in: values }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { custom: false }
  const bioTypes = toValues(bioType)
  const complexities = toValues(complexity)
  const equipments = toValues(equipment)
  if (bioTypes.length) where.bioType = asFilter(bioTypes)
  if (complexities.length) where.complexity = asFilter(complexities)
  if (equipments.length) where.equipment = asFilter(equipments)
  if (search) where.name = { contains: search }

  if (favoritesOnly) {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json([])
    where.favorites = { some: { userId } }
  }

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
  const { name, bioType, complexity, equipment, description, imageUrl, videoUrl } = body

  if (!name?.trim() || !bioType?.trim() || !complexity?.trim()) {
    return NextResponse.json({ error: 'name, bioType et complexity sont requis' }, { status: 400 })
  }

  const data = {
    name: name.trim(),
    bioType: bioType.trim(),
    complexity: complexity.trim(),
    equipment: equipment?.trim() || null,
    description: description?.trim() || null,
    imageUrl: imageUrl?.trim() || null,
    videoUrl: videoUrl?.trim() || null,
  }

  // L'ID est toujours généré côté serveur (voir lib/movement-id.ts), jamais saisi
  // depuis le formulaire. Une poignée de tentatives absorbe la course rare où deux
  // créations concurrentes calculeraient le même "prochain" ID.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await nextMovementId()
    try {
      const movement = await prisma.movement.create({ data: { id, ...data } })
      return NextResponse.json(movement, { status: 201 })
    } catch (e) {
      const isUniqueClash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      if (!isUniqueClash || attempt === 4) throw e
    }
  }
  return NextResponse.json({ error: 'Impossible de générer un ID unique, réessaie' }, { status: 500 })
}
