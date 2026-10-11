import { NextRequest, NextResponse } from 'next/server'
import { type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

interface Block {
  bioTypes?: string[]
  complexities?: string[]
  equipments?: string[]
  count: number
  exclude?: string[]   // IDs à exclure (reroll)
}

// Bornes volontairement très au-dessus de l'usage réel (le générateur demande
// 2 à 6 blocs, voir lib/generator-math.ts) : le corps de la requête venait du
// client sans aucun plafond, et chaque bloc déclenche un findMany. Un tableau
// de mille blocs faisait donc mille allers-retours base sur une seule requête.
const MAX_BLOCS = 20
const MAX_MOUVEMENTS_PAR_BLOC = 50
const MAX_EXCLUSIONS = 500

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  // Le référentiel de mouvements est une donnée de l'application, pas un
  // catalogue ouvert : cette route le servait sans cookie, alors que proxy.ts
  // laisse passer tout /api sans contrôle.
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const body = await req.json()
  const blocks: Block[] = (Array.isArray(body.blocks) ? body.blocks : []).slice(0, MAX_BLOCS)
  const videoOnly: boolean = body.videoOnly === true

  const result: { id: string; name: string; bioType: string; complexity: string; videoUrl: string | null; blockIndex: number }[] = []

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx]
    const where: Prisma.MovementWhereInput = { custom: false }
    if (block.bioTypes?.length) where.bioType = { in: block.bioTypes }
    if (block.complexities?.length) where.complexity = { in: block.complexities }
    if (block.equipments?.length) where.equipment = { in: block.equipments }
    if (block.exclude?.length) where.id = { notIn: block.exclude.slice(0, MAX_EXCLUSIONS) }
    if (videoOnly) where.videoUrl = { not: null }

    // select explicite : sans lui, chaque bloc tirait aussi `description` et
    // `imageUrl` de tout le pool, pour ne garder que cinq champs à l'arrivée.
    const pool = await prisma.movement.findMany({
      where,
      select: { id: true, name: true, bioType: true, complexity: true, videoUrl: true },
    }) as { id: string; name: string; bioType: string; complexity: string; videoUrl: string | null }[]
    const count = Math.max(0, Math.min(Number(block.count) || 0, MAX_MOUVEMENTS_PAR_BLOC))
    const picked = shuffle(pool).slice(0, count)

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
