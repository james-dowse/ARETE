'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Zap, Calendar, GripVertical, Plus, Trash2, Search } from 'lucide-react'
import { BIO_TYPES, COMPLEXITIES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, effectiveDifficulty } from '@/lib/types'
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

// Construit "YYYY-MM-DD" à partir des composants LOCAUX de la date (jamais
// toISOString(), qui convertit en UTC : pour un fuseau en avance sur UTC —
// Europe/Paris — minuit local un lundi devient dimanche 22h ou 23h UTC, donc
// .toISOString().split('T')[0] renvoyait la veille. Ce décalage silencieux
// faisait que le planning enregistrait ses séances sous un "lundi" qui ne
// correspondait à aucune semaine réellement affichée ailleurs dans l'app.
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Sélecteur de séance (bouton "+" d'un jour) ────────────────────────────
interface PickerWorkout {
  id: string; name: string; duration?: number | null
  imageUrl?: string | null; imagePosition?: string | null
  difficultyOverride?: string | null
  movements: { movement: { bioType: string; complexity: string } }[]
}

function WorkoutPickerModal({ dayLabel, onPick, onClose }: {
  dayLabel: string
  onPick: (workoutId: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [workouts, setWorkouts] = useState<PickerWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [bioFilters, setBioFilters] = useState<Set<string>>(new Set())
  const [difficultyFilters, setDifficultyFilters] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/workouts?filter=mine')
      .then(r => r.json())
      .then(d => { setWorkouts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggleFilter = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSet(next)
  }

  const filtered = workouts.filter(w => {
    if (search.trim() && !w.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (bioFilters.size > 0 && !w.movements.some(m => bioFilters.has(m.movement.bioType))) return false
    if (difficultyFilters.size > 0) {
      const diff = effectiveDifficulty(w.difficultyOverride, w.movements.map(m => ({ complexity: m.movement.complexity })))
      if (!diff || !difficultyFilters.has(diff)) return false
    }
    return true
  })

  return (
    <div onClick={onClose} className="overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 420, maxHeight: '78vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--elev-3)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Ajouter une séance</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{dayLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={17} /></button>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une séance…"
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {BIO_TYPES.map(bt => {
              const active = bioFilters.has(bt)
              const color = BIO_TYPE_COLORS[bt]
              return (
                <button key={bt} onClick={() => toggleFilter(bioFilters, setBioFilters, bt)}
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, cursor: 'pointer', fontWeight: active ? 600 : 400, background: active ? `${color}18` : 'var(--bg-elevated)', border: `1px solid ${active ? color : 'var(--border)'}`, color: active ? color : 'var(--text-muted)' }}>
                  {BIO_TYPE_ICONS[bt]} {bt}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {COMPLEXITIES.map(c => {
              const active = difficultyFilters.has(c)
              const color = COMPLEXITY_COLORS[c]
              return (
                <button key={c} onClick={() => toggleFilter(difficultyFilters, setDifficultyFilters, c)}
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, cursor: 'pointer', fontWeight: active ? 600 : 400, background: active ? `${color}18` : 'var(--bg-elevated)', border: `1px solid ${active ? color : 'var(--border)'}`, color: active ? color : 'var(--text-muted)' }}>
                  {c}
                </button>
              )
            })}
            {(bioFilters.size > 0 || difficultyFilters.size > 0) && (
              <button onClick={() => { setBioFilters(new Set()); setDifficultyFilters(new Set()) }}
                style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
                ✕ Réinitialiser
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune séance trouvée</div>
          )}
          {!loading && filtered.map(w => {
            const difficulty = effectiveDifficulty(w.difficultyOverride, w.movements.map(m => ({ complexity: m.movement.complexity })))
            const bioTypes = Array.from(new Set(w.movements.map(m => m.movement.bioType))).slice(0, 3)
            return (
              <button key={w.id} onClick={() => onPick(w.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 2, textAlign: 'left', transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {w.imageUrl
                    ? <img src={w.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: w.imagePosition || '50% 50%' }} />
                    : <img src="/logo.svg" alt="" style={{ width: '45%', height: '45%', objectFit: 'contain', opacity: 0.18 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {difficulty && <span style={{ width: 7, height: 7, borderRadius: '50%', background: COMPLEXITY_COLORS[difficulty] || 'var(--text-muted)', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {difficulty && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `${COMPLEXITY_COLORS[difficulty]}18`, color: COMPLEXITY_COLORS[difficulty], border: `1px solid ${COMPLEXITY_COLORS[difficulty]}40` }}>{difficulty}</span>
                    )}
                    {bioTypes.map(bt => (
                      <span key={bt} style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 10, background: `${BIO_TYPE_COLORS[bt] || '#fff'}18`, color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)', border: `1px solid ${BIO_TYPE_COLORS[bt] || '#fff'}28` }}>{bt}</span>
                    ))}
                    {w.duration && <span style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{w.duration} min</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [entries, setEntries] = useState<PlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const toast = useToast()

  // ── Drag and drop (pointer events — fonctionne souris ET tactile, contrairement
  // au drag natif HTML5 qui ne se déclenche pas sur mobile) ──
  const [dragEntry, setDragEntry] = useState<PlanEntry | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const [overDelete, setOverDelete] = useState(false)
  const dragStateRef = useRef<{ entry: PlanEntry; startX: number; startY: number; moved: boolean; startDay: number; reordered: boolean } | null>(null)

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

  const moveEntry = async (entryId: string, dayOfWeek: number) => {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, dayOfWeek } : e))
    const res = await fetch(`/api/planner/entries/${entryId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek }),
    }).catch(() => null)
    if (!res || !res.ok) { toast('Impossible de déplacer cette séance', 'error'); load(weekStart) }
  }

  // Réordonnancement au sein d'un même jour (glisser une carte au-dessus/en
  // dessous d'une autre) — persiste l'ordre final de tout le jour concerné.
  const persistDayOrder = async (dayOfWeek: number, orderedIds: string[]) => {
    const res = await Promise.all(orderedIds.map((entryId, i) =>
      fetch(`/api/planner/entries/${entryId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: i }),
      }).catch(() => null)
    ))
    if (res.some(r => !r || !r.ok)) { toast('Impossible de réordonner cette journée', 'error'); load(weekStart) }
  }

  const addEntry = async (workoutId: string, dayOfWeek: number) => {
    const res = await fetch('/api/planner', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId, dayOfWeek, weekStart: toISODate(weekStart) }),
    }).catch(() => null)
    if (!res || !res.ok) { toast('Impossible d\'ajouter cette séance', 'error'); return }
    const created = await res.json()
    setEntries(prev => [...prev, created])
    setPickerDay(null)
    toast('Ajoutée à la semaine ✓')
  }

  const goWeek = (delta: number) => {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + delta * 7); return d })
  }

  // ── Pointer drag handlers ──
  const handlePointerDown = (e: React.PointerEvent, entry: PlanEntry) => {
    e.preventDefault()
    dragStateRef.current = { entry, startX: e.clientX, startY: e.clientY, moved: false, startDay: entry.dayOfWeek, reordered: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = dragStateRef.current
    if (!st) return
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY
    if (!st.moved && Math.hypot(dx, dy) < 6) return
    st.moved = true
    if (!dragEntry) setDragEntry(st.entry)
    setDragPos({ x: e.clientX, y: e.clientY })

    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const dayEl = el?.closest('[data-planner-day]') as HTMLElement | null
    const entryEl = el?.closest('[data-planner-entry]') as HTMLElement | null
    const deleteEl = el?.closest('[data-planner-delete]')
    setOverDelete(!!deleteEl)
    const overDay = deleteEl ? null : dayEl ? Number(dayEl.dataset.plannerDay) : null
    setHoverDay(overDay)

    // Survol d'une autre carte du MÊME jour que la carte glissée en ce moment
    // (son jour courant, pas son jour de départ — elle peut avoir déjà changé
    // de jour pendant ce même geste) : on réordonne en direct, comme le
    // drag-and-drop des blocs/mouvements ailleurs dans l'app.
    const targetId = entryEl?.dataset.plannerEntry
    if (targetId && targetId !== st.entry.id && overDay != null) {
      setEntries(prev => {
        const dragged = prev.find(e => e.id === st.entry.id)
        const target = prev.find(e => e.id === targetId)
        if (!dragged || !target || dragged.dayOfWeek !== target.dayOfWeek || dragged.dayOfWeek !== overDay) return prev
        const dayIds = prev.filter(e => e.dayOfWeek === overDay).map(e => e.id)
        const from = dayIds.indexOf(dragged.id), to = dayIds.indexOf(target.id)
        if (from === to) return prev
        dayIds.splice(to, 0, dayIds.splice(from, 1)[0])
        st.reordered = true
        const orderById = new Map(dayIds.map((id, i) => [id, i]))
        return prev.map(e => e.dayOfWeek === overDay && orderById.has(e.id) ? { ...e, order: orderById.get(e.id)! } : e)
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.order - b.order)
      })
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    const st = dragStateRef.current
    dragStateRef.current = null
    if (st?.moved) {
      const liveDay = entries.find(en => en.id === st.entry.id)?.dayOfWeek ?? st.startDay
      if (overDelete) {
        removeEntry(st.entry.id)
      } else if (hoverDay != null && hoverDay !== liveDay) {
        moveEntry(st.entry.id, hoverDay)
      } else if (st.reordered && hoverDay != null) {
        const dayIds = entries.filter(e => e.dayOfWeek === hoverDay).sort((a, b) => a.order - b.order).map(e => e.id)
        persistDayOrder(hoverDay, dayIds)
      }
    }
    setDragEntry(null)
    setDragPos(null)
    setHoverDay(null)
    setOverDelete(false)
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
  }

  const isCurrentWeek = toISODate(weekStart) === toISODate(getMonday(new Date()))
  const isDragging = !!dragEntry

  const totalByDay = DAYS.map((_, i) => entries.filter(e => e.dayOfWeek === i).length)
  const totalWorkouts = entries.length

  return (
    <>
      <div style={{ maxWidth: 1320, margin: '0 auto', width: '100%' }} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="r-h1">Planning</h1>
            <p className="r-subtitle">
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
        <div className="r-planner-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {DAYS.map((day, i) => {
            const dayEntries = entries.filter(e => e.dayOfWeek === i)
            const dayDate = new Date(weekStart); dayDate.setDate(weekStart.getDate() + i)
            const isToday = toISODate(dayDate) === toISODate(new Date())
            const isHovered = isDragging && hoverDay === i
            return (
              <div key={i} data-planner-day={i} style={{
                display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 10, padding: isHovered ? 4 : 0,
                background: isHovered ? 'var(--gold-ghost)' : 'transparent',
                outline: isHovered ? '2px dashed var(--gold-border)' : 'none',
                transition: 'background 0.15s',
              }}>
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
                  <>
                    {dayEntries.map(entry => {
                      const bioTypes = Array.from(new Set(entry.workout.movements.map(m => m.movement.bioType)))
                      const isBeingDragged = dragEntry?.id === entry.id
                      return (
                        <div key={entry.id} data-planner-entry={entry.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px 9px 6px', position: 'relative', opacity: isBeingDragged ? 0.35 : 1, display: 'flex', gap: 4 }}>
                          <div
                            onPointerDown={e => handlePointerDown(e, entry)}
                            style={{ touchAction: 'none', cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--text-dim)', flexShrink: 0, padding: '2px 2px' }}
                            title="Glisser pour déplacer">
                            <GripVertical size={13} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
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
                        </div>
                      )
                    })}
                    <button onClick={() => setPickerDay(i)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px', borderRadius: 8, background: 'none', border: '1px dashed var(--border-plus)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      <Plus size={12} /> Ajouter
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {!loading && totalWorkouts === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Calendar size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Semaine vide</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Ouvre une séance et clique "Ajouter à ma semaine", ou utilise le "+" d'un jour</div>
            <Link href="/workouts">
              <button style={{ padding: '10px 24px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Zap size={13} /> Voir mes séances
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Ghost du drag — suit le pointeur */}
      {isDragging && dragPos && dragEntry && (
        <div style={{
          position: 'fixed', left: dragPos.x, top: dragPos.y, transform: 'translate(-50%, -50%) rotate(-2deg)',
          zIndex: 2000, pointerEvents: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--gold-border)',
          borderRadius: 8, padding: '9px 14px', boxShadow: 'var(--elev-3)', maxWidth: 220,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dragEntry.workout.name}
          </div>
        </div>
      )}

      {/* Zone de suppression façon Android — apparaît pendant le drag */}
      <div
        data-planner-delete
        style={{
          position: 'fixed', left: '50%', bottom: isDragging ? 24 : -80, transform: 'translateX(-50%)',
          zIndex: 1999, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 999,
          background: overDelete ? 'var(--red)' : 'rgba(23,19,15,0.92)', border: `1px solid ${overDelete ? 'var(--red)' : 'rgba(255,255,255,0.15)'}`,
          color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          transition: 'bottom 0.25s ease, background 0.15s ease', pointerEvents: isDragging ? 'auto' : 'none',
        }}>
        <Trash2 size={15} />
        {overDelete ? 'Relâche pour supprimer' : 'Glisser ici pour supprimer'}
      </div>

      {pickerDay != null && (
        <WorkoutPickerModal
          dayLabel={DAYS[pickerDay]}
          onPick={workoutId => addEntry(workoutId, pickerDay)}
          onClose={() => setPickerDay(null)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @media (max-width: 768px) {
          .r-planner-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
