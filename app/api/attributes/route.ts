import { NextRequest, NextResponse } from 'next/server'
import type { AttributeOption } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import {
  getCachedAttributes, setCachedAttributes, invalidateAttributes,
  type AttributesPayload,
} from '@/lib/attributes-cache'

// Référentiel quasi statique : le navigateur peut le garder une minute et
// continuer à l'afficher pendant la revalidation.
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }

// Default seed values (used only when DB is empty for a category)
const DEFAULTS = {
  bioType: [
    { value: 'Lower body', icon: '🦵', color: '#6BAE7C', tempo: 3.5 },
    { value: 'Push',       icon: '💪', color: '#7CA8D4', tempo: 3 },
    { value: 'Pull',       icon: '🔄', color: '#C47878', tempo: 3 },
    { value: 'Core focus', icon: '🎯', color: '#5BBEBE', tempo: 3.5 },
    { value: 'Compound',   icon: '⚡', color: '#C8A040', tempo: 3 },
    { value: 'Boxing',     icon: '🥊', color: '#9E7AC4', tempo: 1.2 },
  ],
  complexity: [
    { value: 'Easy',     icon: null, color: '#8CC98C' },
    { value: 'Common',   icon: null, color: '#DEC06B' },
    { value: 'Hard',     icon: null, color: '#D98A8A' },
    { value: 'Advanced', icon: null, color: '#9C9892' },
  ],
  equipment: [
    { value: 'Barre force',    icon: '🏋️', color: null },
    { value: 'Haltère',        icon: '🪙', color: null },
    { value: 'Kettlebell',     icon: '🔔', color: null },
    { value: 'Cable',          icon: '〰️', color: null },
    { value: 'Anneaux',        icon: '⭕', color: null },
    { value: 'Elastique',      icon: '🪢', color: null },
    { value: 'Poids corps',    icon: '🤸', color: null },
    { value: 'Barre traction', icon: '🔝', color: null },
    { value: 'Box',            icon: '📦', color: null },
  ],
}

// Seed uniquement les catégories réellement absentes. N'est déclenché que
// lorsqu'une lecture révèle un trou — pas avant chaque lecture comme avant.
async function seedMissing(missing: string[]) {
  for (const category of missing) {
    const items = DEFAULTS[category as keyof typeof DEFAULTS]
    if (!items) continue
    for (const [i, item] of items.entries()) {
      await prisma.attributeOption.upsert({
        where: { category_value: { category, value: item.value } },
        create: { ...item, category, position: i },
        update: {},
      })
    }
  }
}

const ORDER_BY = [{ category: 'asc' }, { position: 'asc' }, { value: 'asc' }] as const

function split(all: AttributeOption[]): AttributesPayload {
  return {
    bioTypes:     all.filter(o => o.category === 'bioType'),
    complexities: all.filter(o => o.category === 'complexity'),
    equipments:   all.filter(o => o.category === 'equipment'),
  }
}

export async function GET() {
  const hit = getCachedAttributes()
  if (hit) return NextResponse.json(hit, { headers: CACHE_HEADERS })

  type AttrOption = { id: string; category: string; value: string; icon: string | null; color: string | null; position: number; tempo: number | null }
  let all = await prisma.attributeOption.findMany({ orderBy: [...ORDER_BY] }) as AttrOption[]

  // Base neuve ou catégorie vidée : on sème puis on relit, une seule fois.
  const missing = Object.keys(DEFAULTS).filter(c => !all.some(o => o.category === c))
  if (missing.length > 0) {
    try {
      await seedMissing(missing)
      all = await prisma.attributeOption.findMany({ orderBy: [...ORDER_BY] }) as AttrOption[]
    } catch { /* non bloquant : on renvoie ce que la base contient déjà */ }
  }

  const payload = split(all)
  setCachedAttributes(payload)
  return NextResponse.json(payload, { headers: CACHE_HEADERS })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { category, value, icon, color, tempo } = await req.json()
  if (!category || !value?.trim()) return NextResponse.json({ error: 'category et value requis' }, { status: 400 })

  const maxPos = await prisma.attributeOption.aggregate({ where: { category }, _max: { position: true } })
  const position = (maxPos._max.position ?? -1) + 1

  const opt = await prisma.attributeOption.create({
    data: { category, value: value.trim(), icon: icon?.trim() || null, color: color?.trim() || null, tempo: tempo === '' || tempo == null ? null : Number(tempo), position },
  })
  invalidateAttributes()
  return NextResponse.json(opt, { status: 201 })
}
