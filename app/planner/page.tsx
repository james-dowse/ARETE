'use client'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Zap, Calendar } from 'lucide-react'
import { BIO_TYPE_COLORS } from '@/lib/types'
import { useToast } from '@/components/Toast'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface PlanWorkout {
  id: string; name: string; duration?: number | null; tags?: string | null
  movements: { movement: { bioType: string } }[]
}
interface PlanEntry {
  id: string; dayOfWeek: number; order: number; workout: PlanWorkout
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function fmtWeekLabel(mon: Date): string {
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${mon.toLocaleDateString('fr-FR', opts)} – ${sun.toLocaleDateString('fr-FR', opts)}`
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [entries, setEntries] = useState<PlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = useCallback(async (mon: Date) => {
    setLoading(true)
    const res = await fetch(`/api/planner?weekStart=${toISODate(mon)}`).catch(() => null)
    if (!res || !res.ok) {
      setEntries([])
      setLoading(false)
      return
    }
    const data = await res.json()
    setEntries(data.entries ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load(weekStart) }, [weekStart, load])

  const removeEntry = async (entryId: string) => {
    const res = await fetch(`/api/planner/entries/${entryId}`, { method: 'DELETE' }).catch(() => null)
    if (!res || !res.ok) { toast('Impossible de retirer cette séance', 'error'); return }
    setEntries(prev => prev.filter(e => e.id !== entryId))
    toast('Retirée de la semaine', 'info')
  }

  const goWeek = (delta: number) => {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + delta * 7); return d })
  }

  const isCurrentWeek = toISODate(weekStart) === toISODate(getMonday(new Date()))

  const totalByDay = DAYS.map((_, i) => entries.filter(e => e.dayOfWeek === i).length)
  const totalWorkouts = entries.length

  return (
    <AppShell>
      <div style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Planner</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 15 }}>
              {loading ? '…' : `${totalWorkouts} entraînement${totalWorkouts !== 1 ? 's' : ''} cette semaine`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => goWeek(-1)} style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 180, textAlign: 'center' }}>
              {fmtWeekLabel(weekStart)}
              {isCurrentWeek && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--gold-ghost)', color: 'var(--gold)', fontWeight: 700, border: '1px solid var(--gold-border)' }}>Cette semaine</span>}
            </div>
            <button onClick={() => goWeek(1)} style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <ChevronRight size={16} />
            </button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekStart(getMonday(new Date()))} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                Aujourd'hui
              </button>
            )}
          </div>
        </div>

        {/* Week grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {DAYS.map((day, i) => {
            const dayEntries = entries.filter(e => e.dayOfWeek === i)
            const dayDate = new Date(weekStart); dayDate.setDate(weekStart.getDate() + i)
            const isToday = toISODate(dayDate) === toISODate(new Date())
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Day header */}
                <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: isToday ? 'var(--gold-ghost)' : 'var(--bg-card)', border: `1px solid ${isToday ? 'var(--gold-border)' : 'var(--border)'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--gold)' : 'var(--text-muted)', letterSpacing: 0.5 }}>{day}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isToday ? 'var(--gold)' : 'var(--text-primary)', lineHeight: 1.3 }}>
                    {dayDate.getDate()}
                  </div>
                  {totalByDay[i] > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{totalByDay[i]} séance{totalByDay[i] > 1 ? 's' : ''}</div>
                  )}
                </div>

                {/* Workout cards for this day */}
                {loading ? (
                  <div style={{ height: 60, background: 'var(--bg-card)', borderRadius: 8, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ) : (
                  dayEntries.map(entry => {
                    const bioTypes = Array.from(new Set(entry.workout.movements.map(m => m.movement.bioType)))
                    return (
                      <div key={entry.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', position: 'relative' }}>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          style={{ position: 'absolute', top: 5, right: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2, borderRadius: 4 }}
                          title="Retirer"
                        >
                          <X size={11} />
                        </button>
                        <Link href={`/workouts/${entry.workout.id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', paddingRight: 16, lineHeight: 1.3, marginBottom: 5 }}>
                            {entry.workout.name}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {bioTypes.slice(0, 2).map(bt => (
                              <span key={bt} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: `${BIO_TYPE_COLORS[bt] || '#fff'}18`, color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)', border: `1px solid ${BIO_TYPE_COLORS[bt] || '#fff'}28` }}>{bt}</span>
                            ))}
                          </div>
                          {entry.workout.duration && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{entry.workout.duration} min</div>
                          )}
                        </Link>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>

        {!loading && totalWorkouts === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Calendar size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Semaine vide</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Ouvre une séance et clique "Ajouter à ma semaine"</div>
            <Link href="/workouts">
              <button style={{ padding: '10px 24px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Zap size={13} /> Voir mes séances
              </button>
            </Link>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </AppShell>
  )
}
