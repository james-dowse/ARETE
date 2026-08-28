import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, getCurrentUserId } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

const CATEGORIES = ['sport', 'sante', 'nutrition']

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const resources = await prisma.resource.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(resources)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, url, source, category } = await req.json()
  if (!title?.trim() || !url?.trim() || !source?.trim() || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'title, url, source et category (sport/sante/nutrition) requis' }, { status: 400 })
  }

  const resource = await prisma.resource.create({
    data: { title: title.trim(), url: url.trim(), source: source.trim(), category },
  })
  return NextResponse.json(resource, { status: 201 })
}
