import { describe, it, expect } from 'vitest'
import { inferRole, roleOf } from './block-role'
import { applyCut, blocksKey, combine, cutWorkoutFrom, durationKey, setsAfterCut, focusOf, isCombinable, keepBlocks, movementsOf, parseSessionCut, proposeVersions, resolveVersion, sessionCutJson, workoutSeconds, type CutWorkout, type CutMovement, type CutRule } from './cuts'

// Deux séances de référence, celles de la note de conception : Supermover
// (un bloc par grand type de travail) et Warrior Day (HIIT entouré de
// préparation et de complément).
function seance(blocks: [string, boolean, number | null, [string, number, string | null, number | null, number | null][]][]): CutWorkout {
  const w: CutWorkout = { blocks: [], movements: [] }
  let o = 0
  blocks.forEach(([title, superset, restAfter, mvs], i) => {
    const id = `b${i + 1}`
    w.blocks.push({ id, order: i, bioType: title, superset, restAfter })
    for (const [bioType, sets, reps, rest, duration] of mvs) {
      w.movements.push({ blockId: id, order: o++, bioType, sets, reps, rest, duration })
    }
  })
  return w
}

const SUPERMOVER = seance([
  ['ÉCHAUFFEMENT', false, 60, [['Core focus', 2, '10', 15, null], ['Lower body', 2, '5', 15, null], ['Push', 2, '10', 20, null]]],
  ['PUSH', true, 90, [['Push', 4, '6', 0, null], ['Push', 4, '8', 0, null], ['Push', 4, '8', 90, null]]],
  ['PULL', true, 90, [['Pull', 4, '6', 0, null], ['Pull', 4, '10', 0, null], ['Pull', 4, '15', 90, null]]],
  ['COMPOUND', false, 90, [['Compound', 4, '8', 75, null], ['Compound', 4, '6', 75, null], ['Compound', 3, '3', 60, null]]],
  ['FINISHER', true, 60, [['Compound', 3, null, 0, 40], ['Compound', 3, null, 0, 40], ['Core focus', 3, null, 60, 30]]],
  ['RETOUR AU CALME', false, null, [['Lower body', 2, null, 10, 60], ['Lower body', 2, null, 10, 60], ['Core focus', 1, null, 0, 120]]],
])

const WARRIOR_DAY = seance([
  ['ÉCHAUFFEMENT', false, 60, [['Boxing', 1, null, 0, 180], ['Push', 2, '10', 15, null]]],
  ['MOBILITÉ HANCHES', false, 60, [['Lower body', 2, '8', 15, null], ['Lower body', 2, '8', 20, null], ['Lower body', 2, '12', 15, null]]],
  ['HIIT BOXE', true, 120, [['Boxing', 6, null, 0, 120], ['Compound', 6, null, 60, 30]]],
  ['HIIT KETTLEBELL', true, 90, [['Compound', 5, null, 0, 30], ['Lower body', 5, '10', 0, null], ['Push', 5, '8', 60, null]]],
  ['GAINAGE', false, 60, [['Core focus', 3, null, 30, 45], ['Core focus', 3, null, 30, 30]]],
  ['RETOUR AU CALME', false, null, [['Lower body', 2, null, 10, 60], ['Core focus', 1, null, 0, 120]]],
])

const min = (s: number) => Math.round(s / 60)

describe('inferRole — le rôle se déduit du nom du bloc', () => {
  it.each([
    ['ÉCHAUFFEMENT', 'echauffement'], ['echauffement', 'echauffement'], ['Warm-up', 'echauffement'],
    ['MOBILITÉ HANCHES', 'mobilite'], ['HIIT BOXE', 'conditionnement'], ['FINISHER', 'conditionnement'],
    ['EMOM 12', 'conditionnement'], ['RETOUR AU CALME', 'calme'], ['Étirements', 'calme'],
    ['GAINAGE', 'accessoire'], ['PUSH', 'force'], ['Push', 'force'], ['FORCE BAS DU CORPS', 'force'],
  ])('%s → %s', (title, role) => {
    expect(inferRole(title).role).toBe(role)
    expect(inferRole(title).how).toBe('nom')
  })
  it('un nom inconnu donne Force, mais le dit', () => {
    expect(inferRole('BRAS')).toEqual({ role: 'force', how: 'defaut' })
  })
  it('un bloc sans nom donne Force, et le dit aussi', () => {
    expect(inferRole('')).toEqual({ role: 'force', how: 'vide' })
    expect(inferRole(null)).toEqual({ role: 'force', how: 'vide' })
  })
  it('un rôle choisi l’emporte sur la déduction', () => {
    expect(roleOf({ bioType: 'PUSH', role: 'conditionnement' })).toEqual({ role: 'conditionnement', confirmed: true, how: 'choisi' })
    expect(roleOf({ bioType: 'PUSH', role: 'nimporte' }).confirmed).toBe(false)
  })
})

describe('focusOf — ce que le bloc fait travailler', () => {
  const mv = (bt: string): CutMovement => ({ bioType: bt })
  it('le nom du bloc d’abord', () => {
    expect(focusOf({ id: 'x', order: 0, bioType: 'PULL' }, [mv('Push')])).toBe('Pull')
  })
  it('sinon le type des mouvements, à 60 % au moins', () => {
    expect(focusOf({ id: 'x', order: 0, bioType: 'BLOC A' }, [mv('Pull'), mv('Pull'), mv('Push')])).toBe('Pull')
    expect(focusOf({ id: 'x', order: 0, bioType: 'BLOC A' }, [mv('Pull'), mv('Push'), mv('Lower body')])).toBe('Mixte')
  })
})

describe('proposeVersions', () => {
  it('Supermover : une version par type de travail, le finisher seul, sans préparation', () => {
    const v = proposeVersions(SUPERMOVER)
    expect(v.map(x => x.label)).toEqual(['Complète', 'Push', 'Pull', 'Compound', 'Finisher seul', 'Sans préparation'])
    expect(min(v[0].result.seconds)).toBe(61)
    expect(min(v[1].result.seconds)).toBe(15)
    expect(v[1].result.keptBlockIds).toEqual(['b1', 'b2'])   // échauffement gardé
  })
  it('Warrior Day : HIIT seul et sans préparation, pas de version par focus', () => {
    const v = proposeVersions(WARRIOR_DAY)
    expect(v.map(x => x.label)).toEqual(['Complète', 'HIIT seul', 'Sans préparation', '45 min'])
    expect(v.find(x => x.label === 'HIIT seul')!.result.keptBlockIds).toEqual(['b3', 'b4'])
  })
  it('un rôle changé change les versions', () => {
    const w: CutWorkout = { ...SUPERMOVER, blocks: SUPERMOVER.blocks.map(b => b.id === 'b4' ? { ...b, role: 'accessoire' } : b) }
    expect(proposeVersions(w).map(x => x.label)).not.toContain('Compound')
  })
  it('un seul bloc : rien d’autre que la séance complète', () => {
    const w: CutWorkout = { blocks: [SUPERMOVER.blocks[1]], movements: movementsOf(SUPERMOVER, 'b2') }
    expect(proposeVersions(w).map(x => x.label)).toEqual(['Complète'])
  })
})

describe('combine — plusieurs pastilles ensemble', () => {
  const v = proposeVersions(SUPERMOVER)
  const pick = (...labels: string[]) => labels.map(l => v.find(x => x.label === l)!)
  it('Push + Pull : échauffement, Push et Pull, pas le reste', () => {
    const c = combine(SUPERMOVER, pick('Push', 'Pull'))
    expect(c.label).toBe('Push + Pull')
    expect(c.result.keptBlockIds).toEqual(['b1', 'b2', 'b3'])
    expect(min(c.result.seconds)).toBe(28)
    expect(c.result.dropped.map(d => d.blockId)).toEqual(['b4', 'b5', 'b6'])
  })
  it('Push + Finisher seul : un type de travail et le HIIT', () => {
    expect(combine(SUPERMOVER, pick('Push', 'Finisher seul')).result.keptBlockIds).toEqual(['b1', 'b2', 'b5'])
  })
  it('l’ordre du choix ne change pas la coupe, seulement le libellé', () => {
    expect(combine(SUPERMOVER, pick('Pull', 'Push')).result.keptBlockIds).toEqual(combine(SUPERMOVER, pick('Push', 'Pull')).result.keptBlockIds)
  })
  it('une seule pastille : la version elle-même', () => {
    expect(combine(SUPERMOVER, pick('Pull'))).toBe(pick('Pull')[0])
  })
  it('seuls les types de travail et le HIIT se combinent', () => {
    expect(v.filter(isCombinable).map(x => x.label)).toEqual(['Push', 'Pull', 'Compound', 'Finisher seul'])
  })
  it('une durée glissée dans une combinaison est ignorée', () => {
    const r = applyCut(SUPERMOVER, { kind: 'union', rules: [{ kind: 'focus', value: 'Push', keepWarmup: true }, { kind: 'duration', targetMin: 30, lever: true }] })
    expect(r.keptBlockIds).toEqual(['b1', 'b2'])
  })
})

describe('branchement sur l’application', () => {
  it('la clé d’une version se résout à l’identique, combinaison comprise', () => {
    const v = resolveVersion(SUPERMOVER, 'focus:Push+focus:Pull')!
    expect(v.label).toBe('Push + Pull')
    expect(v.result.keptBlockIds).toEqual(['b1', 'b2', 'b3'])
    expect(resolveVersion(SUPERMOVER, 'focus:Pull')!.label).toBe('Pull')
  })
  it('une durée visée et un choix de blocs se résolvent aussi', () => {
    const d = resolveVersion(WARRIOR_DAY, durationKey(30, true))!
    expect(d.label).toBe('30 min')
    expect(d.result.lever).toBe(true)
    expect(d.result.keptBlockIds).toEqual(['b3', 'b4'])
    const b = resolveVersion(SUPERMOVER, blocksKey(['b2', 'b6']))!
    expect(b.label).toBe('Sur mesure')
    expect(b.result.keptBlockIds).toEqual(['b2', 'b6'])
    expect(resolveVersion(SUPERMOVER, blocksKey(['disparu']))).toBeNull()
    expect(resolveVersion(SUPERMOVER, 'focus:Push+' + durationKey(30, false))).toBeNull()
  })
  it('setsAfterCut : une série de moins sur le travail seulement, jamais sous 1', () => {
    expect(setsAfterCut({ id: 'x', order: 0, bioType: 'PUSH' }, 4, true)).toBe(3)
    expect(setsAfterCut({ id: 'x', order: 0, bioType: 'PUSH' }, 1, true)).toBe(1)
    expect(setsAfterCut({ id: 'x', order: 0, bioType: 'ÉCHAUFFEMENT' }, 2, true)).toBe(2)
    expect(setsAfterCut({ id: 'x', order: 0, bioType: 'PUSH' }, 4, false)).toBe(4)
  })
  it('une version qui n’existe plus rend null', () => {
    expect(resolveVersion(SUPERMOVER, 'focus:Boxing')).toBeNull()
    expect(resolveVersion(SUPERMOVER, 'noprep+focus:Push')).toBeNull()   // non combinables
  })
  it('keepBlocks garde les blocs choisis et leurs mouvements, pas le hors bloc', () => {
    const w = { blocks: [{ id: 'a' }, { id: 'b' }], movements: [{ blockId: 'a' }, { blockId: 'b' }, { blockId: null }] }
    expect(keepBlocks(w, ['b'])).toEqual({ blocks: [{ id: 'b' }], movements: [{ blockId: 'b' }] })
  })
  it('cutWorkoutFrom lit le type sur la fiche du mouvement', () => {
    const w = cutWorkoutFrom({ blocks: [{ id: 'a', order: 0, bioType: 'PUSH' }], movements: [{ blockId: 'a', sets: 3, movement: { bioType: 'Push' } }] })
    expect(w.movements[0]).toMatchObject({ blockId: 'a', bioType: 'Push', sets: 3 })
  })
  it('la trace de session : rien pour la séance complète, clé et libellé sinon', () => {
    const v = proposeVersions(SUPERMOVER)
    expect(sessionCutJson(v[0])).toBeUndefined()
    const raw = sessionCutJson(v[1])!
    expect(parseSessionCut(raw)).toEqual({ key: 'focus:Push', label: 'Push' })
    expect(parseSessionCut('pas du json')).toBeNull()
    expect(parseSessionCut(null)).toBeNull()
  })
})

describe('applyCut — blocs entiers, toujours', () => {
  const rules: CutRule[] = [
    { kind: 'focus', value: 'Pull', keepWarmup: true },
    { kind: 'roles', keep: ['conditionnement'] },
    { kind: 'noprep' },
    { kind: 'duration', targetMin: 30, lever: true },
    { kind: 'duration', targetMin: 45, lever: false },
  ]
  it.each(rules)('%o ne coupe jamais un bloc en deux, et redonne la même coupe', (rule) => {
    for (const w of [SUPERMOVER, WARRIOR_DAY]) {
      const a = applyCut(w, rule)
      expect(applyCut(w, rule)).toEqual(a)
      const dropped = new Set(a.dropped.map(d => d.blockId))
      expect(a.keptBlockIds.filter(id => dropped.has(id))).toEqual([])
      expect(a.keptBlockIds.length + dropped.size).toBe(w.blocks.length)
    }
  })
  it('la durée ne retire jamais un bloc de travail', () => {
    for (const w of [SUPERMOVER, WARRIOR_DAY]) {
      const a = applyCut(w, { kind: 'duration', targetMin: 15, lever: true })
      for (const b of w.blocks) {
        const r = roleOf(b).role
        if (r === 'force' || r === 'conditionnement') expect(a.keptBlockIds).toContain(b.id)
      }
    }
  })
  it('Warrior Day en 30 min : hors d’atteinte sans levier, tenu avec une série de moins', () => {
    const sans = applyCut(WARRIOR_DAY, { kind: 'duration', targetMin: 30, lever: false })
    expect(sans.unreachable).toBe(true)
    expect(min(sans.seconds)).toBe(36)
    expect(sans.steps.map(s => s.label)).toEqual(['RETOUR AU CALME', 'MOBILITÉ HANCHES', 'GAINAGE', 'ÉCHAUFFEMENT'])
    const avec = applyCut(WARRIOR_DAY, { kind: 'duration', targetMin: 30, lever: true })
    expect(avec.unreachable).toBe(false)
    expect(avec.lever).toBe(true)
    expect(avec.seconds).toBeLessThanOrEqual(30 * 60)
    expect(avec.keptBlockIds).toEqual(['b3', 'b4'])
  })
  it('la séance complète garde les mouvements hors bloc, une version non', () => {
    const w: CutWorkout = { ...SUPERMOVER, movements: [...SUPERMOVER.movements, { blockId: null, bioType: 'Core focus', sets: 3, reps: '30', rest: 30 }] }
    expect(applyCut(w, { kind: 'full' }).seconds).toBe(workoutSeconds(w))
    expect(applyCut(w, { kind: 'focus', value: 'Push', keepWarmup: true }).looseDropped).toBe(1)
  })
})
