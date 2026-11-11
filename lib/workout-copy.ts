// Copier les blocs et mouvements d'une séance dans une autre — une seule
// écriture pour « Dupliquer » et pour « Enregistrer comme version ».
//
// La copie de « Dupliquer » perdait jusqu'ici le repos entre séries (`rest`) de
// chaque mouvement : il n'était pas dans la liste des champs recopiés. Il l'est
// ici, avec le rôle des blocs.
//
// Et l'empreinte de contenu, qui dit si une séance a changé depuis qu'une
// version en a été tirée (ou si la version a été retouchée depuis).

import { createHash } from 'crypto'
import { prisma } from './prisma'
import { applyCut, cutWorkoutFrom, setsAfterCut, type CutBlock, type CutRule } from './cuts'

export interface CopyBlock {
  id: string; order: number; bioType: string | null; instructions: string | null
  restAfter: number | null; superset: boolean; dropset: boolean; role: string | null; section: string | null
}
export interface CopyMovement {
  movementId: string; order: number; sets: number | null; reps: string | null
  rest: number | null; duration: number | null; blockId: string | null
  movement: { bioType: string; equipment: string | null }
}
export interface CopySource {
  id: string; name: string; userId: string | null; derivedFromId: string | null; cut: string | null
  duration: number | null; notes: string | null; templateId: string | null; description: string | null
  imageUrl: string | null; imagePosition: string | null; tags: string | null; blockRest: number | null
  difficultyOverride: string | null
  blocks: CopyBlock[]
  movements: CopyMovement[]
}

export async function loadForCopy(id: string): Promise<CopySource | null> {
  return await prisma.workout.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: 'asc' } },
      movements: { orderBy: { order: 'asc' }, include: { movement: { select: { bioType: true, equipment: true } } } },
    },
  }) as CopySource | null
}

// Empreinte du contenu d'une séance, indépendante des identifiants : deux
// séances aux mêmes blocs et aux mêmes mouvements ont la même. Les blocs sont
// pris dans leur ordre, les mouvements dans leur ordre au sein de leur bloc.
export function contentHash(w: {
  blocks: { id: string; order: number; bioType?: string | null; instructions?: string | null; restAfter?: number | null; superset?: boolean | null; dropset?: boolean | null; role?: string | null; section?: string | null }[]
  movements: { movementId: string; order: number; sets?: number | null; reps?: string | null; rest?: number | null; duration?: number | null; blockId?: string | null }[]
}): string {
  const blocks = [...w.blocks].sort((a, b) => a.order - b.order)
  const index = new Map(blocks.map((b, i) => [b.id, i]))
  const mv = [...w.movements]
    .sort((a, b) => a.order - b.order)
    .map(m => [m.blockId != null ? (index.get(m.blockId) ?? -1) : -1, m.movementId, m.sets ?? null, m.reps ?? null, m.rest ?? null, m.duration ?? null])
  const bl = blocks.map(b => [b.bioType ?? null, b.instructions ?? null, b.restAfter ?? null, !!b.superset, !!b.dropset, b.role ?? null, b.section ?? null])
  return createHash('sha256').update(JSON.stringify([bl, mv])).digest('hex').slice(0, 16)
}

// Le contenu qu'une coupe produit, en mémoire : les blocs gardés, leurs
// mouvements, les séries réduites si le levier est tiré.
export function cutContent(src: CopySource, keptBlockIds: readonly string[], lever: boolean) {
  const kept = new Set(keptBlockIds)
  const blocks = src.blocks.filter(b => kept.has(b.id))
  const byId = new Map(blocks.map(b => [b.id, b as CutBlock]))
  const movements = src.movements
    .filter(m => m.blockId != null && kept.has(m.blockId))
    .map(m => ({ ...m, sets: setsAfterCut(byId.get(m.blockId!)!, m.sets, lever) ?? null }))
  return { blocks, movements }
}

type Tx = typeof prisma

// Écrit des blocs et leurs mouvements dans une séance, en remappant les blockId.
export async function writeBlocks(tx: Tx, workoutId: string, content: { blocks: CopyBlock[]; movements: (Omit<CopyMovement, 'movement'> & { movement?: unknown })[] }) {
  const blockIdMap: Record<string, string> = {}
  for (const b of content.blocks) {
    const created = await tx.workoutBlock.create({
      data: {
        workoutId, order: b.order, bioType: b.bioType, instructions: b.instructions,
        restAfter: b.restAfter, superset: b.superset, dropset: b.dropset, role: b.role, section: b.section,
      },
    })
    blockIdMap[b.id] = created.id
  }
  if (content.movements.length) {
    await tx.workoutMovement.createMany({
      data: content.movements.map(m => ({
        workoutId, movementId: m.movementId, order: m.order, sets: m.sets, reps: m.reps,
        rest: m.rest, duration: m.duration, blockId: m.blockId ? (blockIdMap[m.blockId] ?? null) : null,
      })),
    })
  }
}

// ── Versions enregistrées ─────────────────────────────────────────────────────

// Ce que Workout.cut retient d'une version.
export interface VersionCut {
  rule: CutRule
  key: string
  label: string
  sourceName: string
  sourceHash: string   // empreinte de l'origine au moment de la copie
  ownHash: string      // empreinte de la copie elle-même
}

export function parseVersionCut(raw: string | null | undefined): VersionCut | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return v && v.rule && typeof v.label === 'string' && typeof v.sourceHash === 'string' ? v as VersionCut : null
  } catch { return null }
}

// Une durée visée se fige en liste de blocs à l'enregistrement : une version
// enregistrée doit rester la même tant qu'on ne la remet pas à jour, même si un
// bloc de l'origine change de durée entre-temps.
export function frozenRule(rule: CutRule, keptBlockIds: readonly string[], lever: boolean): CutRule {
  return rule.kind === 'duration' ? { kind: 'blocks', ids: [...keptBlockIds], lever } : rule
}

// Applique la règle d'une version à sa séance d'origine telle qu'elle est.
export function reapply(src: CopySource, rule: CutRule) {
  return applyCut(cutWorkoutFrom(src), rule)
}
