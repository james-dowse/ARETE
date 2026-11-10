import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner, requireWorkoutReader } from '@/lib/authz'
import { contentHash, cutContent, loadForCopy, parseVersionCut, reapply, writeBlocks, type VersionCut } from '@/lib/workout-copy'

// POST { force?: boolean } : remet une version à jour depuis sa séance
// d'origine, en réappliquant sa règle. Si la version a été retouchée depuis sa
// création, refus (409, retouched) sauf `force` : la remise à jour remplace ses
// blocs et ses mouvements. Les sessions déjà faites ne bougent pas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const { force } = await req.json().catch(() => ({})) as { force?: boolean }

  const child = await loadForCopy(id)
  const cut = parseVersionCut(child?.cut)
  if (!child || !cut) return NextResponse.json({ error: 'Cette séance n’est pas une version.' }, { status: 409 })
  if (!child.derivedFromId) return NextResponse.json({ error: 'La séance d’origine a été supprimée.' }, { status: 409 })
  const reader = await requireWorkoutReader(child.derivedFromId)
  if (!reader.ok) return NextResponse.json({ error: 'La séance d’origine n’est plus accessible.' }, { status: 409 })

  if (contentHash(child) !== cut.ownHash && !force) {
    return NextResponse.json({ error: 'Cette version a été modifiée depuis sa création.', retouched: true }, { status: 409 })
  }

  const src = await loadForCopy(child.derivedFromId)
  if (!src) return NextResponse.json({ error: 'La séance d’origine a été supprimée.' }, { status: 409 })
  const result = reapply(src, cut.rule)
  if (!result.keptBlockIds.length) {
    return NextResponse.json({ error: 'Les blocs de cette version n’existent plus dans la séance d’origine.' }, { status: 409 })
  }
  const content = cutContent(src, result.keptBlockIds, result.lever)
  const next: VersionCut = { ...cut, sourceName: src.name, sourceHash: contentHash(src), ownHash: contentHash(content) }

  await prisma.$transaction(async txArg => {
    const tx = txArg as unknown as typeof prisma
    await tx.workoutMovement.deleteMany({ where: { workoutId: id } })
    await tx.workoutBlock.deleteMany({ where: { workoutId: id } })
    await writeBlocks(tx, id, content)
    await tx.workout.update({ where: { id }, data: { cut: JSON.stringify(next) } })
  })

  return NextResponse.json({ ok: true })
}
