import { describe, it, expect } from 'vitest'
import { minPerMov, estimateTotalMinutes, sizeWorkout } from './generator-math'

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
