import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: 'asc' } },
      movements: {
        include: { movement: true },
        orderBy: { order: 'asc' },
      },
      template: true,
    },
  })
  if (!workout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(workout)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if ('description' in body) data.description = body.description || null
  if ('name' in body && typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if ('notes' in body) data.notes = body.notes || null
  if ('tags' in body) data.tags = body.tags || null
  if ('public' in body) data.public = !!body.public
  if ('imagePosition' in body) data.imagePosition = body.imagePosition || null
  if ('imageUrl' in body) {
    const raw = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (raw) {
      let valid = false
      try { valid = ['http:', 'https:'].includes(new URL(raw).protocol) } catch { /* URL invalide */ }
      if (!valid) return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
      data.imageUrl = raw
    } else {
      data.imageUrl = null
      data.imagePosition = null
    }
  }
  const updated = await prisma.workout.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  await prisma.workout.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
