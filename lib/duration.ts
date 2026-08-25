// Moteur unique d'estimation de durée — utilisé par le générateur (aperçu en
// direct pendant la construction) et par tous les affichages d'une séance déjà
// enregistrée (liste, fiche détail, en-tête de bloc). Avant ce module, ces deux
// familles d'écrans utilisaient des formules différentes : le temps affiché
// changeait selon l'endroit où on regardait la même séance, sans qu'aucune
// donnée n'ait changé entre-temps.
//
// Principes du calcul :
//  - une série au nombre de reps est estimée par `reps × tempo(type)`, le tempo
//    (secondes/répétition) étant réglable par type biomécanique dans
//    Admin > Référentiels — voir BIO_TYPE_TEMPO dans lib/types.ts ;
//  - une série chronométrée (mode « Durée ») utilise sa durée exacte ;
//  - +5s de mise en place par série (se positionner, saisir la charge) ;
//  - le repos ENTRE les séries d'un même mouvement utilise sa valeur réelle
//    (`rest`), avec un repli à 45s pour un mouvement jamais réglé ;
//  - un bloc superset est traité comme une unité : un « tour » = tous ses
//    mouvements une fois, répété `sets` fois, avec repos uniquement entre tours
//    (porté par le dernier mouvement du bloc — cohérent avec la contrainte déjà
//    appliquée en édition : 0 sur tous les mouvements du bloc sauf le dernier) ;
//  - le repos entre blocs (`restAfter`) s'ajoute au total, uniquement quand il
//    est explicitement réglé (pas de valeur inventée).

import { BIO_TYPE_TEMPO, DEFAULT_TEMPO_SEC_PER_REP, FAILURE_REPS } from './types'

export interface DurationMovement {
  sets?: number | null
  reps?: string | null
  duration?: number | null   // secondes, mode chronométré
  rest?: number | null       // secondes, entre séries (ou entre tours si dernier d'un bloc superset)
  bioType: string
  blockId?: string | null    // absent/null = mouvement hors bloc
  order?: number             // pour retrouver le dernier mouvement d'un bloc superset
}

export interface DurationBlock {
  id: string
  superset?: boolean | null
  restAfter?: number | null  // secondes avant le bloc suivant
}

const SETUP_SEC_PER_SET = 5
const DEFAULT_REST_SEC = 45

// "8-12" → 10 (moyenne) ; "Échec" → 12 (série type jusqu'à l'échec) ; vide/invalide → 10.
export function repsToCount(reps?: string | null): number {
  if (!reps) return 10
  const trimmed = reps.trim()
  if (trimmed === FAILURE_REPS) return 12
  const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2)
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : 10
}

function secondsPerSet(m: DurationMovement, tempo: Record<string, number>): number {
  if (m.duration != null) return m.duration
  return repsToCount(m.reps) * (tempo[m.bioType] ?? DEFAULT_TEMPO_SEC_PER_REP)
}

function independentMovementSeconds(m: DurationMovement, tempo: Record<string, number>): number {
  const sets = m.sets ?? 3
  const perSet = secondsPerSet(m, tempo) + SETUP_SEC_PER_SET
  const rest = m.rest ?? DEFAULT_REST_SEC
  return sets * perSet + Math.max(0, sets - 1) * rest
}

export function estimateWorkoutSeconds(
  movements: DurationMovement[],
  blocks: DurationBlock[] = [],
  tempo: Record<string, number> = BIO_TYPE_TEMPO,
): number {
  const byBlock = new Map<string, DurationMovement[]>()
  let total = 0

  for (const m of movements) {
    if (m.blockId) {
      if (!byBlock.has(m.blockId)) byBlock.set(m.blockId, [])
      byBlock.get(m.blockId)!.push(m)
    } else {
      total += independentMovementSeconds(m, tempo)
    }
  }

  // Couvre les blocs déclarés (même vides) et ceux référencés par des mouvements
  // orphelins d'une entrée `blocks` (ne devrait pas arriver, filet de sécurité).
  const blockIds = new Set([...blocks.map(b => b.id), ...byBlock.keys()])

  for (const blockId of blockIds) {
    const mvs = byBlock.get(blockId)
    if (!mvs || mvs.length === 0) continue
    const block = blocks.find(b => b.id === blockId)
    const ordered = [...mvs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    if (block?.superset) {
      const sets = ordered[0].sets ?? 3
      const workPerRound = ordered.reduce((s, m) => s + secondsPerSet(m, tempo) + SETUP_SEC_PER_SET, 0)
      const interRoundRest = ordered[ordered.length - 1].rest ?? DEFAULT_REST_SEC
      total += sets * workPerRound + Math.max(0, sets - 1) * interRoundRest
    } else {
      total += ordered.reduce((s, m) => s + independentMovementSeconds(m, tempo), 0)
    }
  }

  const orderedBlocks = blocks.filter(b => (byBlock.get(b.id)?.length ?? 0) > 0)
  total += orderedBlocks.slice(0, -1).reduce((s, b) => s + (b.restAfter ?? 0), 0)

  return total
}

export function estimateWorkoutMinutes(
  movements: DurationMovement[],
  blocks: DurationBlock[] = [],
  tempo: Record<string, number> = BIO_TYPE_TEMPO,
): number {
  return Math.max(1, Math.round(estimateWorkoutSeconds(movements, blocks, tempo) / 60))
}
