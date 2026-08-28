import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

const CATEGORIES = ['sport', 'sante', 'nutrition']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { title, url, source, category } = await req.json()
  if (category !== undefined && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'category doit être sport, sante ou nutrition' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (title !== undefined) data.title = title.trim()
  if (url !== undefined) data.url = url.trim()
  if (source !== undefined) data.source = source.trim()
  if (category !== undefined) data.category = category

  const updated = await prisma.resource.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await prisma.resource.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
