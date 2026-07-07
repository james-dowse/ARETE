// Logique pure de dimensionnement du générateur — extraite de app/generator/page.tsx
// pour être testable. Règle métier : si durée fournie (mode « Au temps »), durée exacte
// et repos exacts, jamais de dépassement ; sinon 30 s de travail par série de ~10 reps.

// Estimation : 30 s de travail par série (~10 reps) ; repos uniquement ENTRE les séries.
// Si durationSec fourni (mode durée), il remplace les 30 s.
export function minPerMov(sets: number, rest: number, durationSec?: number | null): number {
  return sets * (durationSec != null ? durationSec / 60 : 0.5) + Math.max(0, sets - 1) * rest
}

export interface BlockLite { count: number; sets: number; rest: number; duration?: number | null }

// Durée totale estimée d'une structure (blocs + repos inter-blocs).
export function estimateTotalMinutes(blocks: BlockLite[], blockRestBetween: number): number {
  const movts = blocks.reduce((s, b) => s + b.count * minPerMov(b.sets, b.rest, b.duration), 0)
  const inter = Math.max(0, blocks.length - 1) * blockRestBetween
  return movts + inter
}

export interface SizingInput {
  targetDur: number            // minutes cibles
  sets: number                 // séries par mouvement (selon difficulté)
  globalBlockRest: number      // repos entre blocs (min)
  defaultRest: number          // repos entre séries (min)
  fixed: boolean               // true = mode « Au temps » (durée exacte, jamais de dépassement)
  nbBlocksSeed?: number        // pour le mode aléatoire (2-4) ; ignoré si fixed
}
export interface Sizing { nbBlocks: number; totalMovTarget: number; distribution: number[] }

// Dimensionnement du workout (partie déterministe de generateRandom, hors random/fetch).
// En mode fixe, on arrondit vers le bas (floor) : la durée cible n'est JAMAIS dépassée.
export function sizeWorkout(inp: SizingInput): Sizing {
  const { targetDur, sets, globalBlockRest, defaultRest, fixed } = inp
  let nbBlocks = fixed
    ? Math.max(2, Math.min(4, Math.round(targetDur / 15)))     // ~1 bloc / quart d'heure
    : (inp.nbBlocksSeed ?? 3)

  const round = fixed ? Math.floor : Math.round
  const timePerMov = sets * 0.5 + Math.max(0, sets - 1) * defaultRest
  let available = Math.max(timePerMov, targetDur - Math.max(0, nbBlocks - 1) * globalBlockRest)
  let totalMovTarget = Math.max(2, round(available / timePerMov))

  if (fixed) {
    // Durée exacte : jamais de dépassement — on réduit les blocs si besoin.
    nbBlocks = Math.max(2, Math.min(nbBlocks, Math.floor(totalMovTarget / 2)))
    available = Math.max(timePerMov, targetDur - Math.max(0, nbBlocks - 1) * globalBlockRest)
    totalMovTarget = Math.max(2, round(available / timePerMov))
  } else {
    totalMovTarget = Math.max(nbBlocks * 2, totalMovTarget)
  }

  const base = Math.max(fixed ? 1 : 2, Math.floor(totalMovTarget / nbBlocks))
  const extra = Math.max(0, Math.min(nbBlocks, totalMovTarget - base * nbBlocks))
  const distribution = Array.from({ length: nbBlocks }, (_, i) => base + (i < extra ? 1 : 0))
  return { nbBlocks, totalMovTarget, distribution }
}
