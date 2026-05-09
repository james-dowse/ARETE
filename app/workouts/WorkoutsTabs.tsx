'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { BIO_TYPE_COLORS } from '@/lib/types'
import WorkoutActions from './DeleteButton'
import { Zap, Users, User } from 'lucide-react'

interface WorkoutUser { id: string; email: string }
interface WorkoutMovementItem { id: string; sets?: number | null; movement: { bioType: string; name: string } }
interface Workout {
  id: string; name: string; createdAt: string; duration?: number | null
  movements: WorkoutMovementItem[]
  user?: WorkoutUser | null
}

const fmtMin = (min: number) => min < 60 ? `~${min}min` : `~${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`

function WorkoutCard({ w, isOwn, canDelete }: { w: Workout; isOwn: boolean; canDelete: boolean }) {
  const bioTypes = Array.from(new Set(w.movements.map(m => m.movement.bioType)))
  const estMin = Math.round(w.movements.reduce((sum, wm) => sum + (wm.sets ?? 2), 0))
  const initiale = w.user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <Link href={`/workouts/${w.id}`} style={{ textDecoration: 'none', display: 'block', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              {new Date(w.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              {w.duration ? ` · ${w.duration} min cible` : ''}
              {!isOwn && w.user && (
                <>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{initiale}</span>
                    {w.user.email.split('@')[0]}
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dim)' }}>{w.movements.length}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', marginTop: 1 }}>{fmtMin(estMin)}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {w.movements.slice(0, 3).map((wm, i) => (
            <div key={wm.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 14, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{wm.movement.name}</span>
              <span style={{ fontSize: 10, color: BIO_TYPE_COLORS[wm.movement.bioType] || 'var(--text-muted)', marginLeft: 'auto' }}>{wm.movement.bioType}</span>
            </div>
          ))}
          {w.movements.length > 3 && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>+{w.movements.length - 3} autres</div>
          )}
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {bioTypes.map(bt => (
            <span key={bt} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${BIO_TYPE_COLORS[bt] || '#fff'}15`, color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)', border: `1px solid ${BIO_TYPE_COLORS[bt] || '#fff'}28` }}>
              {bt}
            </span>
          ))}
        </div>
      </Link>

      {canDelete && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <WorkoutActions workoutId={w.id} />
        </div>
      )}
    </div>
  )
}

export default function WorkoutsTabs({ currentUserId }: { currentUserId: string | null }) {
  const [tab, setTab] = useState<'mine' | 'community'>('mine')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (t: 'mine' | 'community') => {
    setLoading(true)
    const res = await fetch(`/api/workouts?filter=${t}`)
    setWorkouts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  const tabStyle = (t: 'mine' | 'community'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: tab === t ? 700 : 500, fontSize: 13,
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? 'var(--on-accent)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  })

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
        <button style={tabStyle('mine')} onClick={() => setTab('mine')}>
          <User size={14} /> Mes workouts
        </button>
        <button style={tabStyle('community')} onClick={() => setTab('community')}>
          <Users size={14} /> Communauté
        </button>
      </div>

      {/* Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 140, background: 'var(--bg-card)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && workouts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          {tab === 'mine' ? (
            <>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucun workout</div>
              <div style={{ fontSize: 13, marginBottom: 24 }}>Génère et sauvegarde ton premier workout</div>
              <Link href="/generator">
                <button style={{ padding: '11px 26px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Zap size={14} /> Générer
                </button>
              </Link>
            </>
          ) : (
            <>
              <div style={{ fontSize: 44, marginBottom: 14 }}>👥</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucun workout partagé</div>
              <div style={{ fontSize: 13 }}>Les workouts de tes coéquipiers apparaîtront ici</div>
            </>
          )}
        </div>
      )}

      {/* List */}
      {!loading && workouts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {workouts.map(w => (
            <WorkoutCard
              key={w.id}
              w={w}
              isOwn={tab === 'mine'}
              canDelete={tab === 'mine' || w.user?.id === currentUserId}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </>
  )
}
