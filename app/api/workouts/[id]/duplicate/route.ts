import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutReader } from '@/lib/authz'
import { loadForCopy, writeBlocks } from '@/lib/workout-copy'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // requireWorkoutReader et non requireUser : avec la seule session, n'importe
  // quelle séance privée d'un autre compte se copiait — et la copie naissait
  // avec userId = le copieur, qui en devenait donc propriétaire.
  const authz = await requireWorkoutReader(id)
  if (!authz.ok) return authz.response

  const original = await loadForCopy(id)
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Une seule transaction : un échec à mi-chemin laissait une coquille de
  // séance sans ses blocs. La copie des blocs et mouvements est celle de
  // lib/workout-copy.ts, qui recopie aussi le repos entre séries et le rôle.
  const copy = await prisma.$transaction(async txArg => {
    // Même contournement que dans app/api/workouts/route.ts (type du client de
    // transaction de Prisma 7 sous TS strict).
    const tx = txArg as unknown as typeof prisma
    const created = await tx.workout.create({
      data: {
        name: `${original.name} (copie)`,
        duration: original.duration,
        notes: original.notes,
        templateId: original.templateId,
        userId: authz.userId,
      },
    })
    await writeBlocks(tx, created.id, original)
    return created
  })

  return NextResponse.json(copy)
}
