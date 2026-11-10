import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutReader } from '@/lib/authz'
import { cutWorkoutFrom, resolveVersion } from '@/lib/cuts'
import { contentHash, cutContent, frozenRule, loadForCopy, writeBlocks, type VersionCut } from '@/lib/workout-copy'

// POST { key } : enregistre une version de la séance comme une séance à part
// entière (planifiable, assignable, partageable), qui se souvient de son
// origine et de sa règle (Workout.derivedFromId, Workout.cut).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutReader(id)
  if (!authz.ok) return authz.response
  const { key } = await req.json().catch(() => ({})) as { key?: unknown }
  if (typeof key !== 'string' || !key) return NextResponse.json({ error: 'Version manquante' }, { status: 400 })

  const src = await loadForCopy(id)
  if (!src) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  const v = resolveVersion(cutWorkoutFrom(src), key)
  if (!v || v.rule.kind === 'full') {
    return NextResponse.json({ error: 'Cette version n’existe plus : la séance a changé.' }, { status: 409 })
  }

  const content = cutContent(src, v.result.keptBlockIds, v.result.lever)
  const cut: VersionCut = {
    rule: frozenRule(v.rule, v.result.keptBlockIds, v.result.lever),
    key: v.key,
    label: v.label,
    sourceName: src.name,
    sourceHash: contentHash(src),
    ownHash: contentHash(content),
  }

  const created = await prisma.$transaction(async txArg => {
    const tx = txArg as unknown as typeof prisma
    const w = await tx.workout.create({
      data: {
        name: `${src.name} · ${v.label}`,
        userId: authz.userId,
        derivedFromId: src.id,
        cut: JSON.stringify(cut),
        notes: src.notes, description: src.description, imageUrl: src.imageUrl, imagePosition: src.imagePosition,
        tags: src.tags, blockRest: src.blockRest, difficultyOverride: src.difficultyOverride, templateId: src.templateId,
      },
    })
    await writeBlocks(tx, w.id, content)
    return w
  })

  return NextResponse.json({ id: created.id, name: created.name }, { status: 201 })
}
