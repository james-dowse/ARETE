import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if ('value' in body) data.value = body.value?.trim()
  if ('icon' in body) data.icon = body.icon?.trim() || null
  if ('color' in body) data.color = body.color?.trim() || null
  if ('position' in body) data.position = Number(body.position)

  const opt = await prisma.attributeOption.update({ where: { id }, data })
  return NextResponse.json(opt)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await prisma.attributeOption.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
