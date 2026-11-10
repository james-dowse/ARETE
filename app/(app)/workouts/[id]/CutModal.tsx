'use client'
// « Raccourcir ou choisir les blocs » : les deux versions faites à la main.
//  - Durée visée : le moteur retire d'abord le retour au calme, la mobilité,
//    l'accessoire, l'échauffement, jamais un bloc de travail ; si la cible reste
//    hors d'atteinte, il propose une série de moins par bloc de travail.
//  - Choisir les blocs : n'importe quelle combinaison, bloc entier par bloc entier.
// Rien n'est écrit ici : Démarrer lance la version, Enregistrer en fait une séance.

import { useState } from 'react'
import { Modal } from '@/components/ui'
import { applyCut, blocksKey, durationKey, movementsOf, workoutSeconds, type CutWorkout } from '@/lib/cuts'
import { BLOCK_ROLE_LABEL, roleOf } from '@/lib/block-role'
import { fmtMin } from './parts'

const minutes = (s: number) => Math.max(1, Math.round(s / 60))

export default function CutModal({ workout, onStart, onSave, onClose, saving }: {
  workout: CutWorkout
  onStart: (key: string) => void
  onSave: (key: string) => void
  onClose: () => void
  saving: boolean
}) {
  const fullMin = minutes(workoutSeconds(workout))
  const canShorten = fullMin >= 25
  const [mode, setMode] = useState<'duree' | 'blocs'>(canShorten ? 'duree' : 'blocs')
  const maxTarget = Math.max(15, Math.floor((fullMin - 5) / 5) * 5)
  const [target, setTarget] = useState(() => Math.min(maxTarget, Math.max(15, Math.round(fullMin * 0.6 / 5) * 5)))
  const [lever, setLever] = useState(false)
  const blocks = [...workout.blocks].sort((a, b) => a.order - b.order).filter(b => movementsOf(workout, b.id).length > 0)
  const [picked, setPicked] = useState<string[]>(() => blocks.map(b => b.id))

  // Durée visée
  const cut = applyCut(workout, { kind: 'duration', targetMin: target, lever })
  const sansLevier = lever ? applyCut(workout, { kind: 'duration', targetMin: target, lever: false }) : cut
  const keyDuree = durationKey(target, cut.lever)

  // Choix des blocs, dans l'ordre de la séance quel que soit l'ordre des clics
  const ordered = blocks.filter(b => picked.includes(b.id)).map(b => b.id)
  const choix = applyCut(workout, { kind: 'blocks', ids: ordered })
  const tout = ordered.length === blocks.length
  const keyBlocs = blocksKey(ordered)

  const key = mode === 'duree' ? keyDuree : keyBlocs
  const vide = mode === 'duree' ? cut.dropped.length === 0 && !cut.lever : ordered.length === 0 || tout
  const resultMin = minutes(mode === 'duree' ? cut.seconds : choix.seconds)

  const seg = (on: boolean) => ({
    flex: 1, padding: '7px 10px', borderRadius: 'var(--r-full)', border: 'none', cursor: 'pointer',
    fontSize: 'var(--fs-sm)', fontWeight: 700,
    background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--on-accent)' : 'var(--text-muted)',
  })

  return (
    <Modal onClose={onClose} maxWidth={440}>
      <div style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div>
          <div className="display" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>Raccourcir la séance</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 4 }}>Séance complète : {fmtMin(fullMin)}. Les blocs restent entiers.</div>
        </div>

        <div role="group" aria-label="Façon de raccourcir" style={{ display: 'flex', gap: 2, padding: 3, border: '1px solid var(--border)', borderRadius: 'var(--r-full)' }}>
          <button aria-pressed={mode === 'duree'} disabled={!canShorten} onClick={() => setMode('duree')} style={{ ...seg(mode === 'duree'), opacity: canShorten ? 1 : 0.5 }}>Durée visée</button>
          <button aria-pressed={mode === 'blocs'} onClick={() => setMode('blocs')} style={seg(mode === 'blocs')}>Choisir les blocs</button>
        </div>

        {mode === 'duree' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <label htmlFor="cut-target" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="t-micro" style={{ color: 'var(--text-dim)' }}>Durée visée</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--orange)' }} className="tnum">{target} min</span>
            </label>
            <input id="cut-target" type="range" min={15} max={maxTarget} step={5} value={target}
              onChange={e => setTarget(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div className="t-micro" style={{ color: 'var(--text-dim)' }}>Retiré, dans l’ordre</div>
            {cut.steps.length === 0
              ? <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Rien : la séance tient déjà.</div>
              : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cut.steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 'var(--fs-sm)' }}>
                      <span style={{ fontWeight: 700 }}>{s.label}</span>
                      <span className="tnum" style={{ color: 'var(--text-dim)' }}>−{minutes(s.seconds)} min</span>
                    </li>
                  ))}
                </ul>
              )}
            {(sansLevier.unreachable || lever) && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={lever} onChange={e => setLever(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                <span>Retirer une série à chaque bloc de travail. Les blocs restent entiers, le volume baisse.</span>
              </label>
            )}
            <div style={{
              padding: '10px 12px', borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700,
              background: cut.unreachable ? 'var(--dirty)' : 'var(--green-ghost)', color: cut.unreachable ? 'var(--dirty-text)' : 'var(--green)',
            }}>
              {cut.unreachable
                ? `Au plus court sans couper un bloc de travail : ${minutes(cut.seconds)} min.`
                : `Résultat : ${minutes(cut.seconds)} min, ${cut.keptBlockIds.length} bloc${cut.keptBlockIds.length > 1 ? 's' : ''} sur ${blocks.length}.`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {blocks.map((b, i) => {
              const on = picked.includes(b.id)
              const m = minutes(applyCut(workout, { kind: 'blocks', ids: [b.id] }).seconds)
              return (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${on ? 'var(--border-plus)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', cursor: 'pointer', opacity: on ? 1 : 0.6 }}>
                  <input type="checkbox" checked={on} onChange={() => setPicked(p => on ? p.filter(x => x !== b.id) : [...p, b.id])} style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bioType || 'Sans nom'}</span>
                  <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-dim)' }}>{BLOCK_ROLE_LABEL[roleOf(b).role]}</span>
                  <span className="tnum" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--orange)' }}>{m} min</span>
                </label>
              )
            })}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 4 }}>
              {ordered.length === 0 ? 'Choisissez au moins un bloc.' : tout ? 'Tous les blocs : c’est la séance complète.' : `Résultat : ${resultMin} min, ${ordered.length} bloc${ordered.length > 1 ? 's' : ''} sur ${blocks.length}.`}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => onStart(key)} disabled={vide}
            style={{ padding: '10px 16px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: vide ? 'not-allowed' : 'pointer', opacity: vide ? 0.5 : 1 }}>
            Démarrer · {resultMin} min
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(key)} disabled={vide || saving}
              style={{ flex: 1, padding: '9px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-plus)', background: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: vide || saving ? 'not-allowed' : 'pointer', opacity: vide ? 0.5 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer comme version'}
            </button>
            <button onClick={onClose}
              style={{ padding: '9px 14px', borderRadius: 'var(--r-sm)', border: 'none', background: 'none', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
