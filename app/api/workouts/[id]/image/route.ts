import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put, del } from '@vercel/blob'
import { requireWorkoutOwner } from '@/lib/authz'

// Vercel Blob : le disque local n'est pas inscriptible en prod (lecture seule
// hors /tmp, et /tmp n'est pas partagé entre invocations serverless). Nécessite
// un Blob Store connecté au projet (BLOB_READ_WRITE_TOKEN injecté par Vercel).
const SAFE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const ext = SAFE_EXTS.includes(rawExt) ? rawExt : 'jpg'
  const filename = `workout-images/${id}-${Date.now()}.${ext}`

  const previous = await prisma.workout.findUnique({ where: { id }, select: { imageUrl: true } })

  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type || undefined,
    addRandomSuffix: false,
  })

  await prisma.workout.update({ where: { id }, data: { imageUrl: blob.url, imagePosition: null } })

  if (previous?.imageUrl?.includes('.public.blob.vercel-storage.com/')) {
    await del(previous.imageUrl).catch(() => { /* ancien blob deja absent, sans consequence */ })
  }

  return NextResponse.json({ imageUrl: blob.url })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response

  const workout = await prisma.workout.findUnique({ where: { id }, select: { imageUrl: true } })
  if (workout?.imageUrl?.includes('.public.blob.vercel-storage.com/')) {
    await del(workout.imageUrl).catch(() => { /* deja absent */ })
  }

  await prisma.workout.update({ where: { id }, data: { imageUrl: null, imagePosition: null } })
  return NextResponse.json({ ok: true })
}
