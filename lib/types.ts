export type BioType = 'Lower body' | 'Push' | 'Pull' | 'Core focus' | 'Compound' | 'Boxing'
export type Complexity = 'Easy' | 'Common' | 'Hard' | 'Advanced'
export type Equipment = 'Barre force' | 'Haltère' | 'Kettlebell' | 'Cable' | 'Anneaux' | 'Elastique' | 'Poids corps' | 'Barre traction' | 'Box'

export const FAILURE_REPS = 'Échec'

export const BIO_TYPES: BioType[] = ['Lower body', 'Push', 'Pull', 'Core focus', 'Compound', 'Boxing']
export const COMPLEXITIES: Complexity[] = ['Easy', 'Common', 'Hard', 'Advanced']
export const EQUIPMENT_TYPES: Equipment[] = ['Barre force', 'Haltère', 'Kettlebell', 'Cable', 'Anneaux', 'Elastique', 'Poids corps', 'Barre traction', 'Box']

export const EQUIPMENT_ICONS: Record<string, string> = {
  'Barre force':    '🏋️',
  'Haltère':        '🪙',
  'Kettlebell':     '🔔',
  'Cable':          '〰️',
  'Anneaux':        '⭕',
  'Elastique':      '🪢',
  'Poids corps':    '🤸',
  'Barre traction': '🔝',
  'Box':            '📦',
}

export const BIO_TYPE_COLORS: Record<string, string> = {
  'Lower body': '#6BAE7C',  // vert sauge militaire
  'Push':       '#7CA8D4',  // bleu acier poudré
  'Pull':       '#C47878',  // rouge brique terracotta
  'Core focus': '#5BBEBE',  // teal acier
  'Compound':   '#C8A040',  // ambre — proche de l'or, cohérent
  'Boxing':     '#9E7AC4',  // améthyste muted
}

export const BIO_TYPE_ICONS: Record<string, string> = {
  'Lower body': '🦵',
  'Push': '💪',
  'Pull': '🔄',
  'Core focus': '🎯',
  'Compound': '⚡',
  'Boxing': '🥊',
}

export const COMPLEXITY_COLORS: Record<string, string> = {
  'Easy':     '#6BAE7C',  // vert sauge
  'Common':   '#7CA8D4',  // bleu acier
  'Hard':     '#D4884A',  // orange terracotta
  'Advanced': '#C47878',  // rouge brique
}

// Difficulté globale d'un workout : majorité des mouvements, sauf si le niveau
// le plus élevé présent représente 30% ou plus des mouvements — auquel cas ce
// niveau l'emporte (principe de précaution : un tiers d'exercices Advanced
// suffit à qualifier la séance d'Advanced, même si le reste est Easy).
// Pure fonction de la liste de mouvements : se recalcule à chaque changement
// (reroll aléatoire, substitution bibliothèque), jamais mise en cache.
export function computeWorkoutDifficulty(movements: { complexity: string }[]): Complexity | null {
  if (movements.length === 0) return null
  const counts: Partial<Record<Complexity, number>> = {}
  movements.forEach(m => {
    const c = m.complexity as Complexity
    if (COMPLEXITIES.includes(c)) counts[c] = (counts[c] ?? 0) + 1
  })
  let highest: Complexity | null = null
  for (const level of COMPLEXITIES) if (counts[level]) highest = level
  if (!highest) return null
  const highestShare = (counts[highest] ?? 0) / movements.length
  if (highestShare >= 0.3) return highest

  let majority: Complexity = COMPLEXITIES[0]
  let max = -1
  for (const level of COMPLEXITIES) {
    const c = counts[level] ?? 0
    if (c >= max) { max = c; majority = level }
  }
  return majority
}

export interface TemplateBlockInput {
  bioType: string | null
  complexity: string | null
  count: number
  order: number
}

export interface GeneratedMovement {
  id: string
  name: string
  bioType: string
  complexity: string
  videoUrl?: string | null
  blockIndex: number
}

export interface GeneratedWorkout {
  movements: GeneratedMovement[]
  templateBlocks: TemplateBlockInput[]
  duration?: number
  rounds?: number
}
