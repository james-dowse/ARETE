import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// Default seed values (used only when DB is empty for a category)
const DEFAULTS = {
  bioType: [
    { value: 'Lower body', icon: '🦵', color: '#6BAE7C' },
    { value: 'Push',       icon: '💪', color: '#7CA8D4' },
    { value: 'Pull',       icon: '🔄', color: '#C47878' },
    { value: 'Core focus', icon: '🎯', color: '#5BBEBE' },
    { value: 'Compound',   icon: '⚡', color: '#C8A040' },
    { value: 'Boxing',     icon: '🥊', color: '#9E7AC4' },
  ],
  complexity: [
    { value: 'Easy',     icon: null, color: '#6BAE7C' },
    { value: 'Common',   icon: null, color: '#7CA8D4' },
    { value: 'Hard',     icon: null, color: '#D4884A' },
    { value: 'Advanced', icon: null, color: '#C47878' },
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

async function ensureSeeded() {
  for (const [category, items] of Object.entries(DEFAULTS)) {
    const count = await prisma.attributeOption.count({ where: { category } })
    if (count === 0) {
      for (const [i, item] of items.entries()) {
        await prisma.attributeOption.upsert({
          where: { category_value: { category, value: item.value } },
          create: { ...item, category, position: i },
          update: {},
        })
      }
    }
  }
}

export async function GET() {
  try { await ensureSeeded() } catch { /* non-fatal: return whatever is already in DB */ }

  const all = await prisma.attributeOption.findMany({ orderBy: [{ category: 'asc' }, { position: 'asc' }, { value: 'asc' }] })

  return NextResponse.json({
    bioTypes:    all.filter(o => o.category === 'bioType'),
    complexities: all.filter(o => o.category === 'complexity'),
    equipments:  all.filter(o => o.category === 'equipment'),
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { category, value, icon, color } = await req.json()
  if (!category || !value?.trim()) return NextResponse.json({ error: 'category et value requis' }, { status: 400 })

  const maxPos = await prisma.attributeOption.aggregate({ where: { category }, _max: { position: true } })
  const position = (maxPos._max.position ?? -1) + 1

  const opt = await prisma.attributeOption.create({
    data: { category, value: value.trim(), icon: icon?.trim() || null, color: color?.trim() || null, position },
  })
  return NextResponse.json(opt, { status: 201 })
}
