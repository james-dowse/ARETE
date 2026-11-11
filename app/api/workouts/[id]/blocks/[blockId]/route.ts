import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'
import { isBlockRole } from '@/lib/block-role'

// Vérifie propriété du workout + appartenance du bloc à ce workout
async function authorize(id: string, blockId: string) {
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const block = await prisma.workoutBlock.findUnique({ where: { id: blockId }, select: { workoutId: true } })
  if (!block || block.workoutId !== id) {
    return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params
  const denied = await authorize(id, blockId)
  if (denied) return denied
  const { instructions, superset, dropset, bioType, restAfter, order, role } = await req.json()
  // Rôle : une clé de lib/block-role.ts, ou vide pour revenir à la déduction par le nom.
  if (role !== undefined && role !== null && role !== '' && !isBlockRole(role)) {
    return NextResponse.json({ error: 'Rôle de bloc inconnu' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if (instructions !== undefined) data.instructions = instructions === '' ? null : instructions
  if (superset !== undefined) data.superset = !!superset
  if (dropset !== undefined) data.dropset = !!dropset
  // Exclusivité : un bloc ne peut pas être les deux à la fois, et ce PATCH est
  // partiel — un client qui n'envoie qu'un champ pourrait sinon laisser l'autre
  // à vrai. Le régime qui vient d'être activé gagne ; si les deux arrivent à
  // vrai dans la même requête, le dropset gagne (le plus spécifique).
  if (data.dropset === true) data.superset = false
  else if (data.superset === true) data.dropset = false
  if (bioType !== undefined) data.bioType = bioType === '' ? null : bioType
  if (restAfter !== undefined) data.restAfter = restAfter === '' || restAfter === null ? null : Number(restAfter)
  if (order !== undefined) data.order = Number(order)
  if (role !== undefined) data.role = role || null

  const updated = await prisma.workoutBlock.update({
    where: { id: blockId },
    data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params
  const denied = await authorize(id, blockId)
  if (denied) return denied
  await prisma.workoutBlock.delete({ where: { id: blockId } })
  return NextResponse.json({ ok: true })
}
