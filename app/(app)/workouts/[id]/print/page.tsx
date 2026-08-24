'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'

interface Movement { id: string; name: string; bioType: string }
interface WorkoutMovement { id: string; order: number; sets?: number | null; reps?: string | null; rest?: number | null; blockId?: string | null; movement: Movement }
interface Block { id: string; order: number; bioType?: string | null; instructions?: string | null; restAfter?: number | null }
interface Workout {
  id: string; name: string; createdAt: string; duration?: number | null; tags?: string | null
  notes?: string | null; movements: WorkoutMovement[]; blocks: Block[]
  user?: { firstName?: string | null; lastName?: string | null; email: string } | null
}

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

  return (
    <>
      <button className="print-btn" onClick={() => window.print()}>Imprimer / PDF</button>

      <h1>{workout.name}</h1>
      <div className="meta">
        <span>{new Date(workout.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        {authorName && <span>par {authorName}</span>}
        {workout.duration && <span>{workout.duration} min cible</span>}
        <span>{workout.movements.length} mouvement{workout.movements.length > 1 ? 's' : ''}</span>
      </div>

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
                Bloc {bi + 1}{block.bioType ? ` · ${block.bioType}` : ''}
                {block.instructions ? ` · ${block.instructions}` : ''}
                {block.restAfter ? ` · repos bloc ${block.restAfter}s` : ''}
              </div>
              {bMovs.map((wm, i) => <MovRow key={wm.id} wm={wm} i={i} />)}
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
  return (
    <div className="movement-row">
      <span className="num">{i + 1}</span>
      <span className="bt-dot" style={{ background: BIO_TYPE_COLORS[wm.movement.bioType] || '#ccc' }} />
      <span className="mov-name">{wm.movement.name}</span>
      {(wm.sets || wm.reps) && (
        <span className="sets">
          {wm.sets ? `${wm.sets} séries` : ''}
          {wm.sets && wm.reps ? ' × ' : ''}
          {wm.reps || ''}
        </span>
      )}
      {wm.rest ? <span className="rest-label">{wm.rest}s repos</span> : null}
    </div>
  )
}
