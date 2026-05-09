export type BioType = 'Lower body' | 'Push' | 'Pull' | 'Core focus' | 'Compound' | 'Boxing'
export type Complexity = 'Easy' | 'Common' | 'Hard' | 'Advanced'

export const BIO_TYPES: BioType[] = ['Lower body', 'Push', 'Pull', 'Core focus', 'Compound', 'Boxing']
export const COMPLEXITIES: Complexity[] = ['Easy', 'Common', 'Hard', 'Advanced']

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
