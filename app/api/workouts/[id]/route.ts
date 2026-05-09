import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if ('description' in body) data.description = body.description || null
  if ('name' in body) data.name = body.name
  if ('notes' in body) data.notes = body.notes || null
  const updated = await prisma.workout.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.workout.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
