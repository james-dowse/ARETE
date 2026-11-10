// Rôle fonctionnel d'un bloc de séance — ce à quoi il sert dans la séance, et
// non ce qu'il fait travailler (ça, c'est le focus, lu sur les mouvements : voir
// focusOf dans lib/cuts.ts).
//
// Le rôle sert à couper une séance proprement : « HIIT seul » garde les blocs
// Conditionnement, « 30 min » retire d'abord le retour au calme, puis la
// mobilité, l'accessoire, l'échauffement, et jamais un bloc de travail.
//
// Il est stocké sur WorkoutBlock.role par sa clé. Tant qu'il est null, il est
// DÉDUIT du nom du bloc (WorkoutBlock.bioType, saisi en capitales) et l'écran le
// dit : une déduction se montre comme telle, elle ne se fait pas passer pour un
// choix de l'utilisateur.

export const BLOCK_ROLES = ['echauffement', 'mobilite', 'force', 'conditionnement', 'accessoire', 'calme'] as const
export type BlockRole = typeof BLOCK_ROLES[number]

export const BLOCK_ROLE_LABEL: Record<BlockRole, string> = {
  echauffement: 'Échauffement',
  mobilite: 'Mobilité',
  force: 'Force',
  conditionnement: 'Conditionnement',
  accessoire: 'Accessoire',
  calme: 'Retour au calme',
}

// Les blocs de travail : jamais retirés par une coupe à la durée.
export const WORK_ROLES: ReadonlySet<BlockRole> = new Set<BlockRole>(['force', 'conditionnement'])

// Les blocs de préparation et de retour au calme, retirés par « Sans préparation ».
export const PREP_ROLES: ReadonlySet<BlockRole> = new Set<BlockRole>(['echauffement', 'mobilite', 'calme'])

// Ordre de retrait pour tenir une durée : 1 part en premier. null = jamais retiré.
export const ROLE_DROP_ORDER: Record<BlockRole, number | null> = {
  calme: 1, mobilite: 2, accessoire: 3, echauffement: 4, force: null, conditionnement: null,
}

export function isBlockRole(v: unknown): v is BlockRole {
  return typeof v === 'string' && (BLOCK_ROLES as readonly string[]).includes(v)
}

// Accents retirés, capitales : « Échauffement », « echauffement » et
// « ÉCHAUFFEMENT » doivent donner la même chose.
export function normTitle(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

// Les types anatomiques reconnus dans un nom de bloc (anciens blocs du
// générateur nommés « Push », nouveaux blocs nommés « PUSH »).
export const TITLE_FOCUS: ReadonlyArray<readonly [RegExp, string]> = [
  [/PUSH/, 'Push'], [/PULL/, 'Pull'], [/COMPOUND/, 'Compound'],
  [/LOWER|JAMBES/, 'Lower body'], [/CORE|GAINAGE/, 'Core focus'], [/BOXE|BOXING/, 'Boxing'],
]

const ROLE_RULES: ReadonlyArray<readonly [RegExp, BlockRole]> = [
  [/ECHAUFF|WARM|ACTIVATION|PREPA/, 'echauffement'],
  [/MOBIL/, 'mobilite'],
  [/HIIT|METCON|FINISHER|CARDIO|TABATA|EMOM|AMRAP|CIRCUIT|CONDITION/, 'conditionnement'],
  [/CALME|COOL|RECUP|ETIREMENT|STRETCH|RESPIR/, 'calme'],
  [/GAINAGE|ACCESS|ABDO/, 'accessoire'],
]

// Comment le rôle a été obtenu :
//  - 'nom'    : un mot du nom du bloc l'a désigné ;
//  - 'defaut' : rien reconnu, Force par défaut (le cas à surveiller) ;
//  - 'vide'   : bloc sans nom, Force par défaut.
export type RoleHow = 'nom' | 'defaut' | 'vide'

export function inferRole(title: string | null | undefined): { role: BlockRole; how: RoleHow } {
  const t = normTitle(title)
  if (!t) return { role: 'force', how: 'vide' }
  for (const [re, r] of ROLE_RULES) if (re.test(t)) return { role: r, how: 'nom' }
  if (/FORCE|STRENGTH|HYPERTROPH|PUISSANCE|POWER/.test(t) || TITLE_FOCUS.some(([re]) => re.test(t))) {
    return { role: 'force', how: 'nom' }
  }
  return { role: 'force', how: 'defaut' }
}

// Le rôle effectif d'un bloc : celui choisi s'il y en a un, sinon la déduction.
export function roleOf(block: { role?: string | null; bioType?: string | null }): {
  role: BlockRole; confirmed: boolean; how: RoleHow | 'choisi'
} {
  if (isBlockRole(block.role)) return { role: block.role, confirmed: true, how: 'choisi' }
  const g = inferRole(block.bioType)
  return { role: g.role, confirmed: false, how: g.how }
}
