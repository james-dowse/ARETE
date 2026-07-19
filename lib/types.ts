// Ces types documentent les valeurs par défaut (seed) — la liste réelle peut être
// étendue/renommée en base via Admin > Référentiels, d'où le typage `string` des
// tableaux ci-dessous plutôt qu'un union type figé.
export type BioType = 'Lower body' | 'Push' | 'Pull' | 'Core focus' | 'Compound' | 'Boxing'
export type Complexity = 'Easy' | 'Common' | 'Hard' | 'Advanced'
export type Equipment = 'Barre force' | 'Haltère' | 'Kettlebell' | 'Cable' | 'Anneaux' | 'Elastique' | 'Poids corps' | 'Barre traction' | 'Box'

export const FAILURE_REPS = 'Échec'

// ── Valeurs par défaut (seed initial) ──────────────────────────────────────────
// Mutées en place par applyAttributeOverrides() une fois le référentiel chargé
// (voir components/AttributesSync.tsx), pour que tous les écrans qui ont déjà
// importé ces objets/tableaux voient les valeurs à jour sans code additionnel.
export const BIO_TYPES: string[] = ['Lower body', 'Push', 'Pull', 'Core focus', 'Compound', 'Boxing']
export const COMPLEXITIES: string[] = ['Easy', 'Common', 'Hard', 'Advanced']
export const EQUIPMENT_TYPES: string[] = ['Barre force', 'Haltère', 'Kettlebell', 'Cable', 'Anneaux', 'Elastique', 'Poids corps', 'Barre traction', 'Box']

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
export function computeWorkoutDifficulty(movements: { complexity: string }[]): string | null {
  if (movements.length === 0) return null
  const counts: Record<string, number> = {}
  movements.forEach(m => {
    if (COMPLEXITIES.includes(m.complexity)) counts[m.complexity] = (counts[m.complexity] ?? 0) + 1
  })
  let highest: string | null = null
  for (const level of COMPLEXITIES) if (counts[level]) highest = level
  if (!highest) return null
  const highestShare = (counts[highest] ?? 0) / movements.length
  if (highestShare >= 0.3) return highest

  let majority: string = COMPLEXITIES[0]
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

// ── Synchronisation avec le référentiel (Admin > Référentiels) ────────────────
// La table AttributeOption (base de données) est la source de vérité éditable ;
// les constantes ci-dessus ne sont qu'un seed par défaut. On les MUTE EN PLACE
// (mêmes tableaux/objets, mêmes références) plutôt que de les réassigner, pour
// que tous les fichiers qui ont déjà fait `import { BIO_TYPE_COLORS } from
// '@/lib/types'` voient les valeurs à jour — sans avoir à toucher ces fichiers.
// Appelée par components/AttributesSync.tsx (client, une fois par session) et
// par les pages serveur qui utilisent ces maps (dashboard, progression).
export interface AttributeOptionRow {
  category: string
  value: string
  icon: string | null
  color: string | null
  position: number
}

export function applyAttributeOverrides(rows: {
  bioTypes: AttributeOptionRow[]
  complexities: AttributeOptionRow[]
  equipments: AttributeOptionRow[]
}) {
  const sync = (
    list: AttributeOptionRow[],
    targetArray: string[],
    colorMap?: Record<string, string>,
    iconMap?: Record<string, string>,
  ) => {
    if (list.length === 0) return
    const sorted = [...list].sort((a, b) => a.position - b.position)
    targetArray.length = 0
    targetArray.push(...sorted.map(o => o.value))
    if (colorMap) {
      for (const key of Object.keys(colorMap)) delete colorMap[key]
      sorted.forEach(o => { if (o.color) colorMap[o.value] = o.color })
    }
    if (iconMap) {
      for (const key of Object.keys(iconMap)) delete iconMap[key]
      sorted.forEach(o => { if (o.icon) iconMap[o.value] = o.icon })
    }
  }

  sync(rows.bioTypes, BIO_TYPES, BIO_TYPE_COLORS, BIO_TYPE_ICONS)
  sync(rows.complexities, COMPLEXITIES, COMPLEXITY_COLORS)
  sync(rows.equipments, EQUIPMENT_TYPES, undefined, EQUIPMENT_ICONS)
}
