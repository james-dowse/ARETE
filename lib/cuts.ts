// Moteur de coupe : d'une séance complète, tirer des versions plus courtes
// (« Push », « HIIT seul », « 30 min »…) sans jamais rien inventer.
//
// Trois principes, et ils ne se négocient pas :
//  1. On garde ou on retire des BLOCS ENTIERS. Un superset coupé en deux n'est
//     plus le même stimulus. Le seul autre levier est « une série de moins à
//     chaque bloc de travail » : la structure du bloc reste, le volume baisse.
//  2. Fonction pure : même séance + même règle = même coupe. Une découpe qui
//     varierait d'une fois sur l'autre rendrait la progression illisible.
//  3. La durée vient de lib/duration.ts, le moteur unique de l'application :
//     une version annonce la durée que la séance affichera une fois lancée.
//
// Rien ici ne lit ni n'écrit la base. Les versions « tiroirs » sont ce calcul
// exécuté à l'affichage ; une version enregistrée est une copie de la séance
// restreinte aux blocs gardés (à venir : POST /api/workouts/[id]/versions).

import { estimateWorkoutSeconds, type DurationMovement, type DurationBlock } from './duration'
import { BIO_TYPE_TEMPO } from './types'
import {
  type BlockRole, BLOCK_ROLE_LABEL, WORK_ROLES, PREP_ROLES, ROLE_DROP_ORDER,
  TITLE_FOCUS, normTitle, roleOf,
} from './block-role'

export interface CutBlock {
  id: string
  order: number
  bioType?: string | null      // le nom du bloc
  role?: string | null
  superset?: boolean | null
  restAfter?: number | null
}

export interface CutMovement {
  blockId?: string | null      // null = hors bloc
  order?: number
  sets?: number | null
  reps?: string | null
  rest?: number | null
  duration?: number | null
  bioType: string              // type anatomique du MOUVEMENT
  equipment?: string | null
}

export interface CutWorkout {
  blocks: CutBlock[]
  movements: CutMovement[]
}

export type CutRule =
  | { kind: 'full' }
  | { kind: 'focus'; value: string; keepWarmup: boolean }
  | { kind: 'roles'; keep: BlockRole[] }
  | { kind: 'noprep' }
  | { kind: 'duration'; targetMin: number; lever: boolean }
  | { kind: 'blocks'; ids: string[]; lever?: boolean }
  // Plusieurs pastilles choisies ensemble : les blocs de chacune, additionnés.
  // « Push » + « Pull » garde l'échauffement, Push et Pull, et rien d'autre.
  | { kind: 'union'; rules: CutRule[] }

export interface CutResult {
  keptBlockIds: string[]
  dropped: { blockId: string; reason: string }[]
  // Mouvements hors bloc laissés de côté : aucune version ne sait où les ranger.
  looseDropped: number
  lever: boolean
  seconds: number
  // Règle de durée seulement : la cible n'est pas tenue, `seconds` est alors
  // la version la plus courte possible sans couper un bloc de travail.
  unreachable: boolean
  // Règle de durée seulement : ce qui a été retiré, dans l'ordre, et le gain.
  steps: { blockId: string | null; label: string; seconds: number }[]
}

// ── Lecture d'un bloc ─────────────────────────────────────────────────────────

const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 0) - (b.order ?? 0)

export function movementsOf(w: CutWorkout, blockId: string): CutMovement[] {
  return w.movements.filter(m => m.blockId === blockId).sort(byOrder)
}

// Le focus d'un bloc : ce qu'il fait travailler. Le nom du bloc d'abord s'il
// désigne un type (PUSH, PULL…), sinon le type majoritaire de ses mouvements à
// 60 % au moins ; en dessous, « Mixte » — et un bloc mixte ne fait pas de
// version par focus, plutôt que d'en inventer une.
export function focusOf(block: CutBlock, movements: CutMovement[]): string {
  const t = normTitle(block.bioType)
  for (const [re, f] of TITLE_FOCUS) if (re.test(t)) return f
  if (!movements.length) return 'Vide'
  const count = new Map<string, number>()
  for (const m of movements) count.set(m.bioType, (count.get(m.bioType) ?? 0) + 1)
  let best = '', n = 0
  for (const [k, c] of count) if (c > n) { best = k; n = c }
  return n / movements.length >= 0.6 ? best : 'Mixte'
}

// ── Durée ─────────────────────────────────────────────────────────────────────

function secondsOf(
  w: CutWorkout, kept: ReadonlySet<string>, lever: boolean, withLoose: boolean,
  tempo: Record<string, number>,
): number {
  const blocks = w.blocks.filter(b => kept.has(b.id)).sort(byOrder)
  const work = new Set(blocks.filter(b => WORK_ROLES.has(roleOf(b).role)).map(b => b.id))
  const movements: DurationMovement[] = w.movements
    .filter(m => (m.blockId ? kept.has(m.blockId) : withLoose))
    .map(m => ({
      sets: lever && m.blockId && work.has(m.blockId) ? Math.max(1, (m.sets ?? 3) - 1) : m.sets,
      reps: m.reps, duration: m.duration, rest: m.rest,
      bioType: m.bioType, blockId: m.blockId ?? null, order: m.order,
    }))
  const dBlocks: DurationBlock[] = blocks.map(b => ({ id: b.id, superset: b.superset, restAfter: b.restAfter }))
  return estimateWorkoutSeconds(movements, dBlocks, tempo)
}

export function workoutSeconds(w: CutWorkout, tempo: Record<string, number> = BIO_TYPE_TEMPO): number {
  return secondsOf(w, new Set(w.blocks.map(b => b.id)), false, true, tempo)
}

// ── La coupe ──────────────────────────────────────────────────────────────────

export function applyCut(w: CutWorkout, rule: CutRule, tempo: Record<string, number> = BIO_TYPE_TEMPO): CutResult {
  const blocks = [...w.blocks].sort(byOrder)
  const kept = new Set(blocks.map(b => b.id))
  const dropped: CutResult['dropped'] = []
  const steps: CutResult['steps'] = []
  const drop = (b: CutBlock, reason: string) => { kept.delete(b.id); dropped.push({ blockId: b.id, reason }) }
  const label = (b: CutBlock) => BLOCK_ROLE_LABEL[roleOf(b).role]
  const full = rule.kind === 'full'
  let lever = false
  let unreachable = false

  if (rule.kind === 'union') {
    // Une durée ne s'additionne pas (« 30 min + Push » ne veut rien dire), et la
    // séance complète contient déjà tout : seules les règles de sélection comptent.
    const keep = new Set<string>()
    for (const r of rule.rules) {
      if (r.kind === 'duration' || r.kind === 'full' || r.kind === 'union') continue
      for (const id of applyCut(w, r, tempo).keptBlockIds) keep.add(id)
    }
    for (const b of blocks) if (!keep.has(b.id)) drop(b, `${label(b)} hors de cette combinaison`)
  } else if (rule.kind === 'focus') {
    for (const b of blocks) {
      const r = roleOf(b).role
      const f = focusOf(b, movementsOf(w, b.id))
      if (r === 'force' && f === rule.value) continue
      if (rule.keepWarmup && r === 'echauffement') continue
      drop(b, WORK_ROLES.has(r) ? `Focus ${f}, pas ${rule.value}` : `${label(b)} hors de cette version`)
    }
  } else if (rule.kind === 'roles') {
    for (const b of blocks) if (!rule.keep.includes(roleOf(b).role)) drop(b, `${label(b)} hors de cette version`)
  } else if (rule.kind === 'noprep') {
    for (const b of blocks) if (PREP_ROLES.has(roleOf(b).role)) drop(b, `${label(b)} retiré`)
  } else if (rule.kind === 'blocks') {
    const ids = new Set(rule.ids)
    for (const b of blocks) if (!ids.has(b.id)) drop(b, 'Hors de cette version')
    lever = !!rule.lever
  } else if (rule.kind === 'duration') {
    const target = rule.targetMin * 60
    // Le dernier bloc d'un même rôle part le premier : on garde l'ordre de la
    // séance aussi intact que possible.
    const order = blocks
      .map((b, i) => ({ b, i, p: ROLE_DROP_ORDER[roleOf(b).role] }))
      .filter((x): x is { b: CutBlock; i: number; p: number } => x.p != null)
      .sort((a, z) => a.p - z.p || z.i - a.i)
    let cur = secondsOf(w, kept, false, false, tempo)
    for (const x of order) {
      if (cur <= target) break
      const before = cur
      drop(x.b, `${label(x.b)} retiré pour tenir ${rule.targetMin} min`)
      cur = secondsOf(w, kept, false, false, tempo)
      steps.push({ blockId: x.b.id, label: x.b.bioType || label(x.b), seconds: before - cur })
    }
    if (cur > target && rule.lever) {
      const before = cur
      lever = true
      cur = secondsOf(w, kept, true, false, tempo)
      steps.push({ blockId: null, label: 'Une série de moins par bloc de travail', seconds: before - cur })
    }
    unreachable = cur > target
  }

  const looseDropped = full ? 0 : w.movements.filter(m => !m.blockId).length
  return {
    keptBlockIds: blocks.filter(b => kept.has(b.id)).map(b => b.id),
    dropped, looseDropped, lever, unreachable, steps,
    seconds: secondsOf(w, kept, lever, full, tempo),
  }
}

// ── Combiner des versions ─────────────────────────────────────────────────────

// Les versions qu'on peut cocher ensemble : par type de travail et « HIIT seul ».
// Complète, Sans préparation et les durées se choisissent seules.
export function isCombinable(v: { rule: CutRule }): boolean {
  return v.rule.kind === 'focus' || v.rule.kind === 'roles'
}

export function combine(w: CutWorkout, versions: ProposedVersion[], tempo: Record<string, number> = BIO_TYPE_TEMPO): ProposedVersion {
  if (versions.length === 1) return versions[0]
  const rule: CutRule = { kind: 'union', rules: versions.map(v => v.rule) }
  return {
    key: versions.map(v => v.key).join('+'),
    label: versions.map(v => v.label).join(' + '),
    rule,
    result: applyCut(w, rule, tempo),
  }
}

// ── Les versions proposées à l'ouverture d'une séance ─────────────────────────

export interface ProposedVersion {
  key: string
  label: string
  rule: CutRule
  result: CutResult
}

export function proposeVersions(w: CutWorkout, tempo: Record<string, number> = BIO_TYPE_TEMPO): ProposedVersion[] {
  const blocks = [...w.blocks].sort(byOrder).filter(b => movementsOf(w, b.id).length > 0)
  const cands: Omit<ProposedVersion, 'result'>[] = [{ key: 'full', label: 'Complète', rule: { kind: 'full' } }]

  const forceFoci: string[] = []
  for (const b of blocks) {
    if (roleOf(b).role !== 'force') continue
    const f = focusOf(b, movementsOf(w, b.id))
    if (f !== 'Mixte' && f !== 'Vide' && !forceFoci.includes(f)) forceFoci.push(f)
  }
  if (forceFoci.length >= 2) {
    for (const f of forceFoci) cands.push({ key: `focus:${f}`, label: f, rule: { kind: 'focus', value: f, keepWarmup: true } })
  }

  const cond = blocks.filter(b => roleOf(b).role === 'conditionnement')
  if (cond.length && cond.length < blocks.length) {
    const names = cond.map(b => normTitle(b.bioType))
    const label = names.some(n => /HIIT/.test(n)) ? 'HIIT seul' : names.some(n => /FINISHER/.test(n)) ? 'Finisher seul' : 'Cardio seul'
    cands.push({ key: 'roles:conditionnement', label, rule: { kind: 'roles', keep: ['conditionnement'] } })
  }

  if (blocks.some(b => PREP_ROLES.has(roleOf(b).role))) {
    cands.push({ key: 'noprep', label: 'Sans préparation', rule: { kind: 'noprep' } })
  }

  // Une durée n'est proposée d'office que si elle se tient sans le levier, et
  // sans tomber trop en dessous : une pastille « 30 min » qui annonce 34 min, ou
  // 18, ne dit pas la vérité. Le levier reste offert dans « Raccourcir… ».
  const fullMin = workoutSeconds(w, tempo) / 60
  for (const t of [30, 45]) {
    if (fullMin <= t + 8) continue
    const r = applyCut(w, { kind: 'duration', targetMin: t, lever: false }, tempo)
    if (!r.unreachable && r.seconds / 60 >= t - 10) {
      cands.push({ key: `duration:${t}`, label: `${t} min`, rule: { kind: 'duration', targetMin: t, lever: false } })
    }
  }

  // Une version doit garder au moins un bloc de travail, et deux règles qui
  // gardent les mêmes blocs ne font qu'une version (la première l'emporte).
  const seen = new Set<string>()
  const out: ProposedVersion[] = []
  for (const c of cands) {
    if (blocks.length < 2 && c.rule.kind !== 'full') continue
    const result = applyCut(w, c.rule, tempo)
    const keptWithMv = blocks.filter(b => result.keptBlockIds.includes(b.id))
    if (!keptWithMv.length || !keptWithMv.some(b => WORK_ROLES.has(roleOf(b).role))) continue
    const sig = keptWithMv.map(b => b.id).join(',') + (result.lever ? '+L' : '')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({ ...c, result })
  }
  return out
}
