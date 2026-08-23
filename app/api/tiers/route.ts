import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export interface TierDTO {
  key: string
  label: string
  complexities: string[]
  sets: number
  position: number
}

// Échelons par défaut, dérivés de l'échelle de complexité réelle (et non d'indices
// codés en dur) : chaque échelon prend deux crans consécutifs, du plus facile au
// plus dur. Sert uniquement à amorcer la table la première fois.
async function defaultTiers(): Promise<TierDTO[]> {
  const rows = await prisma.attributeOption.findMany({
    where: { category: 'complexity' },
    orderBy: [{ position: 'asc' }, { value: 'asc' }],
  })
  const scale = rows.map(r => r.value)
  if (scale.length === 0) return []

  const at = (i: number) => scale[Math.min(Math.max(i, 0), scale.length - 1)]
  const last = scale.length - 1
  return [
    { key: 'easy',   label: 'Novice',        complexities: [...new Set([at(0), at(1)])],               sets: 2, position: 0 },
    { key: 'medium', label: 'Intermédiaire', complexities: [...new Set([at(Math.floor(last / 2)), at(Math.floor(last / 2) + 1)])], sets: 3, position: 1 },
    { key: 'hard',   label: 'Avancé',        complexities: [...new Set([at(last - 1), at(last)])],     sets: 4, position: 2 },
  ]
}

async function ensureSeeded() {
  const count = await prisma.difficultyTier.count()
  if (count > 0) return
  const tiers = await defaultTiers()
  for (const t of tiers) {
    await prisma.difficultyTier.upsert({
      where: { key: t.key },
      create: { key: t.key, label: t.label, complexities: JSON.stringify(t.complexities), sets: t.sets, position: t.position },
      update: {},
    })
  }
}

function parse(row: { key: string; label: string; complexities: string; sets: number; position: number }): TierDTO {
  let complexities: string[] = []
  try {
    const raw = JSON.parse(row.complexities)
    if (Array.isArray(raw)) complexities = raw.filter(v => typeof v === 'string')
  } catch { /* valeur illisible : échelon sans complexité, visible tel quel dans l'admin */ }
  return { key: row.key, label: row.label, complexities, sets: row.sets, position: row.position }
}

export async function GET() {
  try { await ensureSeeded() } catch { /* non bloquant : on renvoie ce qui existe déjà */ }

  const rows = await prisma.difficultyTier.findMany({ orderBy: [{ position: 'asc' }, { key: 'asc' }] })
  return NextResponse.json({ tiers: rows.map(parse) })
}

// Remplace l'ensemble de la configuration en une fois (l'admin édite tous les
// échelons puis enregistre) — évite les états intermédiaires incohérents.
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const incoming = body?.tiers
  if (!Array.isArray(incoming)) return NextResponse.json({ error: 'tiers[] requis' }, { status: 400 })

  // Les complexités proposées doivent exister dans le référentiel : on refuse une
  // configuration qui pointerait vers un niveau supprimé (sinon blocs vides).
  const known = new Set(
    (await prisma.attributeOption.findMany({ where: { category: 'complexity' }, select: { value: true } })).map(r => r.value)
  )

  const clean: TierDTO[] = []
  const seen = new Set<string>()
  for (const [i, t] of incoming.entries()) {
    const key = String(t?.key ?? '').trim()
    const label = String(t?.label ?? '').trim()
    if (!key || !label) return NextResponse.json({ error: `Échelon ${i + 1} : clé et libellé requis` }, { status: 400 })
    if (seen.has(key)) return NextResponse.json({ error: `Clé en double : ${key}` }, { status: 400 })
    seen.add(key)

    const complexities: string[] = Array.isArray(t?.complexities) ? t.complexities.map((c: unknown) => String(c)) : []
    const unknown = complexities.filter((c: string) => !known.has(c))
    if (unknown.length) return NextResponse.json({ error: `Niveaux inconnus pour « ${label} » : ${unknown.join(', ')}` }, { status: 400 })
    if (complexities.length === 0) return NextResponse.json({ error: `« ${label} » doit contenir au moins un niveau` }, { status: 400 })

    const sets = Number(t?.sets)
    clean.push({
      key,
      label,
      complexities: [...new Set(complexities)],
      sets: Number.isFinite(sets) && sets >= 1 && sets <= 10 ? Math.round(sets) : 3,
      position: i,
    })
  }

  await prisma.$transaction([
    prisma.difficultyTier.deleteMany({ where: { key: { notIn: clean.map(t => t.key) } } }),
    ...clean.map(t =>
      prisma.difficultyTier.upsert({
        where: { key: t.key },
        create: { key: t.key, label: t.label, complexities: JSON.stringify(t.complexities), sets: t.sets, position: t.position },
        update: { label: t.label, complexities: JSON.stringify(t.complexities), sets: t.sets, position: t.position },
      })
    ),
  ])

  const rows = await prisma.difficultyTier.findMany({ orderBy: [{ position: 'asc' }, { key: 'asc' }] })
  return NextResponse.json({ tiers: rows.map(parse) })
}
