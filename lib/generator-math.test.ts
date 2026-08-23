import { describe, it, expect } from 'vitest'
import {
  minPerMov, estimateTotalMinutes, sizeWorkout,
  planifierBlocs, capaciteDe, categoriesPeuFournies, type Capacity,
} from './generator-math'

describe('minPerMov', () => {
  it('30s/série + repos entre séries', () => {
    expect(minPerMov(3, 1)).toBe(3.5)      // 3*0.5 + 2*1
    expect(minPerMov(2, 1)).toBe(2)        // 2*0.5 + 1*1
    expect(minPerMov(1, 1)).toBe(0.5)      // 1 série → aucun repos
  })
  it('mode durée : la durée exacte remplace les 30s', () => {
    expect(minPerMov(3, 1, 45)).toBe(4.25) // 3*0.75 + 2*1
  })
})

describe('sizeWorkout — mode « Au temps » ne dépasse jamais la cible', () => {
  // Régression du bug « 55 min → 1h10 »
  it('55 min / Intermédiaire (sets=3) tient dans 55 min', () => {
    const s = sizeWorkout({ targetDur: 55, sets: 3, globalBlockRest: 2, defaultRest: 1, fixed: true })
    const blocks = s.distribution.map(count => ({ count, sets: 3, rest: 1 }))
    const est = estimateTotalMinutes(blocks, 2)
    expect(est).toBeLessThanOrEqual(55)          // JAMAIS de dépassement
    expect(est).toBeGreaterThanOrEqual(55 - 5)   // et pas trop court
    expect(s.distribution.reduce((a, b) => a + b, 0)).toBe(s.totalMovTarget)
  })
  it.each([20, 30, 45, 60, 90])('%i min ne dépasse pas la cible', (dur) => {
    for (const sets of [2, 3, 4]) {
      const s = sizeWorkout({ targetDur: dur, sets, globalBlockRest: 2, defaultRest: 1, fixed: true })
      const blocks = s.distribution.map(count => ({ count, sets, rest: 1 }))
      expect(estimateTotalMinutes(blocks, 2)).toBeLessThanOrEqual(dur)
      expect(s.nbBlocks).toBeGreaterThanOrEqual(2)
    }
  })
})

// ── Planification selon la capacité réelle du catalogue ──────────────────────
// Régression du bug « 70 min → 37 min » : un bloc tiré sur une catégorie trop
// peu fournie revenait incomplet, sans compensation ni message.
describe('planifierBlocs', () => {
  const capacity: Capacity = {
    'Bas du corps':  { Commun: 25, Difficile: 24 },
    'Core':          { Commun: 21, Difficile: 25 },
    'Mobilité':      { Commun: 17, Difficile: 10 },
    'Poussée':       { Commun: 15, Difficile: 18 },
    'Poigne':        { Commun: 6,  Difficile: 1 },
    'Sac de frappe': { Commun: 3,  Difficile: 1 },
  }
  const bioTypes = Object.keys(capacity)
  const cxs = ['Commun', 'Difficile']
  const sansHasard = <T,>(a: T[]): T[] => [...a]   // rend les tests déterministes

  it('capaciteDe additionne tous les niveaux de l’échelon', () => {
    expect(capaciteDe(capacity, 'Poigne', cxs)).toBe(7)        // et non 1 (Difficile seul)
    expect(capaciteDe(capacity, 'Inconnue', cxs)).toBe(0)
  })

  it('sert exactement le total demandé quand la capacité suffit', () => {
    const p = planifierBlocs({ capacity, bioTypes, complexities: cxs, nbBlocks: 4, totalMov: 18, shuffle: sansHasard })
    expect(p.blocs.reduce((s, b) => s + b.count, 0)).toBe(18)
    expect(p.manquants).toBe(0)
    p.blocs.forEach(b => expect(b.count).toBeLessThanOrEqual(b.capacite))
  })

  it('sur une séance courte, écarte les catégories trop peu fournies', () => {
    const p = planifierBlocs({ capacity, bioTypes, complexities: cxs, nbBlocks: 2, totalMov: 8, shuffle: sansHasard })
    expect(p.blocs.map(b => b.bioType)).not.toContain('Sac de frappe')
    expect(p.blocs.reduce((s, b) => s + b.count, 0)).toBe(8)
  })

  it('honore une catégorie imposée et reporte le reliquat', () => {
    const p = planifierBlocs({
      capacity, bioTypes, complexities: cxs, nbBlocks: 2, totalMov: 10,
      imposees: ['Sac de frappe'], autoriserPeuFournies: true, shuffle: sansHasard,
    })
    const sac = p.blocs.find(b => b.bioType === 'Sac de frappe')!
    expect(sac).toBeDefined()
    expect(sac.demande).toBe(5)
    expect(sac.count).toBe(4)                                   // plafonné à sa capacité réelle
    expect(sac.count).toBeLessThan(sac.demande)                 // → déclenche le message
    expect(p.blocs.reduce((s, b) => s + b.count, 0)).toBe(10)   // total malgré tout tenu
    expect(p.manquants).toBe(0)
  })

  it('signale ce que le catalogue ne peut pas fournir du tout', () => {
    const maigre: Capacity = { A: { Commun: 2 }, B: { Commun: 1 } }
    const p = planifierBlocs({ capacity: maigre, bioTypes: ['A', 'B'], complexities: ['Commun'], nbBlocks: 2, totalMov: 10, shuffle: sansHasard })
    expect(p.blocs.reduce((s, b) => s + b.count, 0)).toBe(3)
    expect(p.manquants).toBe(7)
  })

  it('categoriesPeuFournies suit le référentiel, sans liste codée en dur', () => {
    expect(categoriesPeuFournies(capacity, bioTypes, cxs, 5)).toEqual(['Sac de frappe'])
    expect(categoriesPeuFournies(capacity, bioTypes, cxs, 8)).toEqual(['Poigne', 'Sac de frappe'])
  })
})
