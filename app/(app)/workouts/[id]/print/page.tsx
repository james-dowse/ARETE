'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, effectiveDifficulty } from '@/lib/types'
import { estimateWorkoutMinutes, type DurationMovement } from '@/lib/duration'
import { stripHtmlMultiline } from '@/lib/html'

interface Movement { id: string; name: string; bioType: string; complexity: string }
interface WorkoutMovement { id: string; order: number; sets?: number | null; reps?: string | null; duration?: number | null; rest?: number | null; blockId?: string | null; movement: Movement }
interface Block { id: string; order: number; bioType?: string | null; instructions?: string | null; restAfter?: number | null; superset?: boolean }
interface Workout {
  id: string; name: string; createdAt: string; duration?: number | null; tags?: string | null
  notes?: string | null; description?: string | null; imageUrl?: string | null; imagePosition?: string | null
  difficultyOverride?: string | null
  movements: WorkoutMovement[]; blocks: Block[]
  user?: { firstName?: string | null; lastName?: string | null; email: string } | null
}

const toDurationMovement = (wm: WorkoutMovement): DurationMovement => ({
  sets: wm.sets, reps: wm.reps, duration: wm.duration, rest: wm.rest,
  blockId: wm.blockId, order: wm.order, bioType: wm.movement.bioType,
})

export default function PrintPage() {
  const { id } = useParams<{ id: string }>()
  const [workout, setWorkout] = useState<Workout | null>(null)

  useEffect(() => {
    fetch(`/api/workouts/${id}`)
      .then(r => r.json())
      .then(setWorkout)
  }, [id])

  useEffect(() => {
    if (!workout) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [workout])

  if (!workout) return <div style={{ padding: 40, color: '#888', fontSize: 14 }}>Chargement…</div>

  const authorName = workout.user
    ? (workout.user.firstName ? `${workout.user.firstName} ${workout.user.lastName ?? ''}`.trim() : workout.user.email.split('@')[0])
    : null
  const bioTypes = Array.from(new Set(workout.movements.map(m => m.movement.bioType)))
  const hasBlocks = workout.blocks.length > 0
  const difficulty = effectiveDifficulty(workout.difficultyOverride, workout.movements.map(m => ({ complexity: m.movement.complexity })))
  const estMin = estimateWorkoutMinutes(workout.movements.map(toDurationMovement), workout.blocks)
  const description = workout.description ? stripHtmlMultiline(workout.description) : ''

  return (
    <>
      <button className="print-btn" onClick={() => window.print()}>Imprimer / PDF</button>

      <div className="brand-bar">
        <span className="brand-word">ARETE</span>
        <span className="brand-sub">Fiche d&apos;entraînement</span>
      </div>

      {workout.imageUrl && (
        <img className="cover" src={workout.imageUrl} alt="" style={{ objectPosition: workout.imagePosition || '50% 50%' }} />
      )}

      <div className="title-row">
        <h1>{workout.name}</h1>
        {difficulty && (
          <span className="chip diff-chip" style={{ background: `${COMPLEXITY_COLORS[difficulty]}18`, color: COMPLEXITY_COLORS[difficulty], border: `1px solid ${COMPLEXITY_COLORS[difficulty]}50` }}>
            {difficulty}
          </span>
        )}
      </div>

      <div className="meta">
        <span>{new Date(workout.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        {authorName && <span>par {authorName}</span>}
        <span>~{estMin} min estimé{workout.duration ? ` · ${workout.duration} min cible` : ''}</span>
        <span>{workout.movements.length} mouvement{workout.movements.length > 1 ? 's' : ''}</span>
      </div>

      {description && <div className="description">{description}</div>}

      <div className="bio-chips">
        {bioTypes.map(bt => (
          <span key={bt} className="chip" style={{ background: `${BIO_TYPE_COLORS[bt]}18`, color: BIO_TYPE_COLORS[bt], border: `1px solid ${BIO_TYPE_COLORS[bt]}40` }}>
            {BIO_TYPE_ICONS[bt]} {bt}
          </span>
        ))}
        {workout.tags && workout.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
          <span key={tag} className="tag-chip">#{tag}</span>
        ))}
      </div>

      <div className="section-label">Programme</div>

      {hasBlocks ? (
        workout.blocks.map((block, bi) => {
          const bMovs = workout.movements.filter(m => m.blockId === block.id)
          return (
            <div key={block.id} className="block">
              <div className="block-header">
                <span>
                  Bloc {bi + 1}{block.bioType ? ` · ${block.bioType}` : ''}
                  {block.instructions ? ` · ${block.instructions}` : ''}
                </span>
                {block.superset && <span className="superset-chip">⚡ Superset</span>}
              </div>
              {bMovs.map((wm, i) => <MovRow key={wm.id} wm={wm} i={i} />)}
              {block.restAfter && bi < workout.blocks.length - 1 && (
                <div className="block-rest">⏸ {block.restAfter}s de repos avant le bloc suivant</div>
              )}
            </div>
          )
        })
      ) : (
        <div className="block">
          {workout.movements.map((wm, i) => <MovRow key={wm.id} wm={wm} i={i} />)}
        </div>
      )}

      {workout.notes && (
        <>
          <div className="section-label">Notes</div>
          <div className="notes-box" dangerouslySetInnerHTML={{ __html: workout.notes }} />
        </>
      )}

      <div className="page-footer">
        <span>ARETE — {workout.name}</span>
        <span>Imprimé le {new Date().toLocaleDateString('fr-FR')}</span>
      </div>
    </>
  )
}

function MovRow({ wm, i }: { wm: WorkoutMovement; i: number }) {
  const target = wm.sets ?? 0
  return (
    <div className="movement-row">
      <span className="num">{i + 1}</span>
      <span className="bt-dot" style={{ background: BIO_TYPE_COLORS[wm.movement.bioType] || '#ccc' }} />
      <span className="mov-name">{wm.movement.name}</span>
      <span className="bt-label">{wm.movement.bioType}</span>
      {wm.duration != null ? (
        <span className="sets">{wm.duration}s</span>
      ) : wm.reps ? (
        <span className="sets">{wm.reps}</span>
      ) : null}
      {wm.rest ? <span className="rest-label">{wm.rest}s repos</span> : null}
      {target > 0 && (
        <span className="set-boxes" aria-hidden>
          {Array.from({ length: target }).map((_, si) => <span key={si} className="set-box" />)}
        </span>
      )}
    </div>
  )
}
