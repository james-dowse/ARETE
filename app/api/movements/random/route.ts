import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET a single random movement, optionally filtered by bioType and/or complexity
// Excludes a list of movement IDs already in the workout
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bioType = searchParams.get('bioType')
  const complexity = searchParams.get('complexity')
  const excludeRaw = searchParams.get('exclude') // comma-separated ids

  const where: Record<string, unknown> = {}
  if (bioType) where.bioType = bioType
  if (complexity) where.complexity = complexity

  const exclude = excludeRaw ? excludeRaw.split(',').filter(Boolean) : []

  const pool = await prisma.movement.findMany({ where })
  const filtered = exclude.length ? pool.filter(m => !exclude.includes(m.id)) : pool

  if (filtered.length === 0) {
    // Fall back without exclusion if pool is too small
    const fallback = pool[Math.floor(Math.random() * pool.length)]
    return NextResponse.json(fallback ?? null)
  }

  const pick = filtered[Math.floor(Math.random() * filtered.length)]
  return NextResponse.json(pick)
}
