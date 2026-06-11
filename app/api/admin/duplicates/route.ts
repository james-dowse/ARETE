import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })

  const movements = await prisma.movement.findMany({ select: { id: true, name: true, bioType: true }, orderBy: { name: 'asc' } })

  // Normalize name for comparison
  function normalize(s: string) {
    return s.toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Group by normalized name — find groups with > 1 member
  const groups = new Map<string, typeof movements>()
  for (const m of movements) {
    const key = normalize(m.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }

  const duplicates = Array.from(groups.entries())
    .filter(([, g]) => g.length > 1)
    .map(([key, group]) => ({ key, group }))
    .sort((a, b) => b.group.length - a.group.length)

  return NextResponse.json({ duplicates })
}
