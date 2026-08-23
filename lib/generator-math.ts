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

// ── Planification des blocs selon la capacité réelle du catalogue ─────────────
// Avant, le générateur assignait un quota fixe à une catégorie tirée au hasard :
// si la bibliothèque ne contenait pas assez de mouvements pour ce couple
// (type × niveaux), le bloc revenait incomplet sans que rien ne le signale.
// Ici on part de la capacité réelle, on plafonne chaque bloc à ce qu'il peut
// servir, et on reporte le reliquat sur les blocs qui ont encore de la marge.

export type Capacity = Record<string, Record<string, number>>

/** Nombre de mouvements disponibles pour un type, tous niveaux de l'échelon confondus. */
export function capaciteDe(capacity: Capacity, bioType: string, complexities: string[]): number {
  const parNiveau = capacity[bioType]
  if (!parNiveau) return 0
  return complexities.reduce((s, c) => s + (parNiveau[c] ?? 0), 0)
}

/**
 * Une catégorie est « peu fournie » quand elle ne peut pas remplir un bloc à elle
 * seule. C'est calculé à partir du catalogue et de l'échelon choisi — donc ça suit
 * automatiquement les évolutions du référentiel, sans liste codée en dur.
 */
export function categoriesPeuFournies(
  capacity: Capacity, bioTypes: string[], complexities: string[], quota: number,
): string[] {
  return bioTypes.filter(b => capaciteDe(capacity, b, complexities) < quota)
}

export interface PlanInput {
  capacity: Capacity
  bioTypes: string[]          // catégories candidates (référentiel)
  complexities: string[]      // tous les niveaux de l'échelon choisi
  nbBlocks: number
  totalMov: number
  imposees?: string[]         // catégories explicitement demandées : toujours honorées
  autoriserPeuFournies?: boolean // null/undefined = automatique (séances ≥ 4 blocs)
  shuffle?: <T>(a: T[]) => T[]
}
export interface PlanBloc { bioType: string; count: number; capacite: number; demande: number }
export interface Plan {
  blocs: PlanBloc[]
  /** Mouvements qu'aucune catégorie retenue ne peut fournir (catalogue trop petit). */
  manquants: number
}

const melangeParDefaut = <T,>(a: T[]): T[] => {
  const c = [...a]
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]] }
  return c
}

export function planifierBlocs(inp: PlanInput): Plan {
  const { capacity, bioTypes, complexities, nbBlocks, totalMov } = inp
  const imposees = (inp.imposees ?? []).filter(b => bioTypes.includes(b)).slice(0, nbBlocks)
  const melange = inp.shuffle ?? melangeParDefaut
  const cap = (b: string) => capaciteDe(capacity, b, complexities)
  const quota = Math.ceil(totalMov / Math.max(1, nbBlocks))

  const libres = bioTypes.filter(b => !imposees.includes(b))
  const fournies = libres.filter(b => cap(b) >= quota)
  const peuFournies = libres.filter(b => cap(b) > 0 && cap(b) < quota)
  // Séances courtes : on ne pioche que des catégories capables de tenir un bloc,
  // pour ne pas qu'un bloc bancal pèse la moitié d'une séance qui n'en compte que deux.
  const autorise = inp.autoriserPeuFournies ?? (nbBlocks >= 4)

  const choisies = [...imposees]
  for (const b of melange(fournies)) { if (choisies.length >= nbBlocks) break; choisies.push(b) }
  // Au plus UNE catégorie peu fournie, en bloc d'accent
  if (autorise && choisies.length < nbBlocks && peuFournies.length > 0) choisies.push(melange(peuFournies)[0])
  for (const b of melange(libres)) { if (choisies.length >= nbBlocks) break; if (!choisies.includes(b)) choisies.push(b) }

  // Si la capacité cumulée ne suffit pas, on échange les blocs les plus petits
  // (jamais ceux imposés par l'utilisateur) contre les catégories les plus fournies.
  let capTotale = choisies.reduce((s, b) => s + cap(b), 0)
  if (capTotale < totalMov) {
    const dispo = bioTypes.filter(b => !choisies.includes(b)).sort((a, b) => cap(b) - cap(a))
    for (const gros of dispo) {
      if (capTotale >= totalMov) break
      let iMin = -1
      for (let i = 0; i < choisies.length; i++) {
        if (imposees.includes(choisies[i])) continue
        if (iMin === -1 || cap(choisies[i]) < cap(choisies[iMin])) iMin = i
      }
      if (iMin === -1 || cap(gros) <= cap(choisies[iMin])) break
      capTotale += cap(gros) - cap(choisies[iMin])
      choisies[iMin] = gros
    }
  }

  const base = Math.floor(totalMov / Math.max(1, choisies.length))
  const extra = totalMov - base * choisies.length
  const demandes = choisies.map((_, i) => base + (i < extra ? 1 : 0))
  const counts = [...demandes]
  let reste = 0
  for (let i = 0; i < counts.length; i++) {
    const c = cap(choisies[i])
    if (counts[i] > c) { reste += counts[i] - c; counts[i] = c }
  }
  // Report du reliquat sur les blocs qui ont encore de la marge
  let garde = 0
  while (reste > 0 && garde++ < 1000) {
    let place = false
    for (let i = 0; i < counts.length && reste > 0; i++) {
      if (counts[i] < cap(choisies[i])) { counts[i]++; reste--; place = true }
    }
    if (!place) break
  }

  return {
    blocs: choisies.map((b, i) => ({ bioType: b, count: counts[i], capacite: cap(b), demande: demandes[i] })),
    manquants: reste,
  }
}
