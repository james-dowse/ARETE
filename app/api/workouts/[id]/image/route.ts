import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { requireWorkoutOwner } from '@/lib/authz'

const UPLOAD_DIR = 'public/uploads/workout-images'
const SAFE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), UPLOAD_DIR)
  await mkdir(uploadDir, { recursive: true })

  const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const ext = SAFE_EXTS.includes(rawExt) ? rawExt : 'jpg'
  const filename = `${id}-${Date.now()}.${ext}`

  await writeFile(path.join(uploadDir, filename), buffer)

  const imageUrl = `/uploads/workout-images/${filename}`
  await prisma.workout.update({ where: { id }, data: { imageUrl } })

  return NextResponse.json({ imageUrl })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response

  const workout = await prisma.workout.findUnique({ where: { id }, select: { imageUrl: true } })
  if (workout?.imageUrl) {
    try {
      await unlink(path.join(process.cwd(), 'public', workout.imageUrl))
    } catch { /* file may not exist */ }
  }

  await prisma.workout.update({ where: { id }, data: { imageUrl: null } })
  return NextResponse.json({ ok: true })
}
