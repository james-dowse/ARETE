'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BIO_TYPES, COMPLEXITIES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, computeWorkoutDifficulty } from '@/lib/types'
import { estimateWorkoutMinutes, type DurationBlock } from '@/lib/duration'
import { stripHtmlMultiline } from '@/lib/html'
import { useToast } from '@/components/Toast'
import { Zap, Users, User, Share2, X, Send, CheckCircle2, AlertCircle, Bookmark, BookmarkCheck, Layers, Star, Clock, ChevronDown, ChevronUp, CalendarPlus, Copy, Pencil, Trash2, PlayCircle, Search, ArrowUpDown } from 'lucide-react'

interface WorkoutUser { id: string; email: string }
interface WorkoutMovementItem {
  id: string; sets?: number | null; reps?: string | null; duration?: number | null
  rest?: number | null; blockId?: string | null; order?: number
  movement: { bioType: string; name: string; complexity: string }
}
interface Workout {
  id: string
  name: string
  description?: string | null
  createdAt: string
  duration?: number | null
  imageUrl?: string | null
  imagePosition?: string | null
  movements: WorkoutMovementItem[]
  blocks?: (DurationBlock & { order?: number; bioType?: string | null })[]
  user?: WorkoutUser | null
  isSaved?: boolean
  isFavorite?: boolean
  tags?: string | null
  _savedSource?: string
  _savedAt?: string
  _lastViewedAt?: string | null
}

const fmtMin = (min: number) => min < 60 ? `~${min}min` : `~${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`

// ── Tri ──────────────────────────────────────────────────────────────────────
type SortOption = 'recent' | 'oldest' | 'name' | 'name-desc' | 'duration' | 'movements'

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Plus récent',
  oldest: 'Plus ancien',
  name: 'Nom (A→Z)',
  'name-desc': 'Nom (Z→A)',
  duration: 'Durée croissante',
  movements: 'Nb mouvements',
}

const toDurationMovements = (movements: WorkoutMovementItem[]) => movements.map(m => ({
  sets: m.sets, reps: m.reps, duration: m.duration, rest: m.rest,
  blockId: m.blockId, order: m.order, bioType: m.movement.bioType,
}))
const estimatedMinutes = (w: Workout): number => estimateWorkoutMinutes(toDurationMovements(w.movements), w.blocks)

// Aperçu compact du WOD pour le cartouche : une colonne par bloc (les
// mouvements sans bloc forment une colonne finale sans titre), pour exploiter
// toute la largeur de la carte. Chaque colonne tronque ses mouvements ; si le
// workout a plus de blocs que MAX_COLUMNS, une pastille "+N blocs" les résume.
const CARD_PREVIEW_MAX_COLUMNS = 4
const CARD_PREVIEW_MAX_ROWS_PER_COLUMN = 5

// Le "titre" d'un bloc est stocké dans son champ bioType (texte libre saisi en
// édition) ; à défaut on retombe sur "Bloc N".
function blockTitle(bioType: string | null | undefined, fallback: string): string {
  const text = (bioType ?? '').trim()
  return text || fallback
}

interface PreviewColumn {
  label: string | null
  movements: { name: string; bioType: string }[]
  hiddenInColumn: number
}

function buildCardPreview(w: Workout): { columns: PreviewColumn[]; hiddenBlocksCount: number } {
  const blocks = (w.blocks ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const byBlock = new Map<string, WorkoutMovementItem[]>()
  const flat: WorkoutMovementItem[] = []
  for (const m of w.movements) {
    if (m.blockId) {
      if (!byBlock.has(m.blockId)) byBlock.set(m.blockId, [])
      byBlock.get(m.blockId)!.push(m)
    } else {
      flat.push(m)
    }
  }
  for (const arr of byBlock.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const allColumns: PreviewColumn[] = []
  blocks.forEach((b, i) => {
    const mvs = byBlock.get(b.id) ?? []
    if (mvs.length === 0) return
    allColumns.push({
      label: blockTitle(b.bioType, `Bloc ${i + 1}`),
      movements: mvs.slice(0, CARD_PREVIEW_MAX_ROWS_PER_COLUMN).map(m => ({ name: m.movement.name, bioType: m.movement.bioType })),
      hiddenInColumn: Math.max(0, mvs.length - CARD_PREVIEW_MAX_ROWS_PER_COLUMN),
    })
  })
  // Comme la fiche détail (WorkoutDetailClient) : dès qu'il y a des blocs, les
  // mouvements sans blockId ne sont pas affichés (résidus d'édition antérieurs
  // à l'ajout de blocs) — sinon ils formeraient une colonne fantôme qui ne
  // correspond à aucun bloc réel du WOD.
  if (blocks.length === 0 && flat.length > 0) {
    allColumns.push({
      label: null,
      movements: flat.slice(0, CARD_PREVIEW_MAX_ROWS_PER_COLUMN).map(m => ({ name: m.movement.name, bioType: m.movement.bioType })),
      hiddenInColumn: Math.max(0, flat.length - CARD_PREVIEW_MAX_ROWS_PER_COLUMN),
    })
  }

  return {
    columns: allColumns.slice(0, CARD_PREVIEW_MAX_COLUMNS),
    hiddenBlocksCount: Math.max(0, allColumns.length - CARD_PREVIEW_MAX_COLUMNS),
  }
}

function sortWorkouts(list: Workout[], sortBy: SortOption): Workout[] {
  const arr = [...list]
  switch (sortBy) {
    case 'oldest':    return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    case 'name':      return arr.sort((a, b) => a.name.localeCompare(b.name))
    case 'name-desc': return arr.sort((a, b) => b.name.localeCompare(a.name))
    case 'duration':  return arr.sort((a, b) => estimatedMinutes(a) - estimatedMinutes(b))
    case 'movements': return arr.sort((a, b) => b.movements.length - a.movements.length)
    case 'recent':
    default:          return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

// ── Helpers semaine ─────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}
function toISODate(d: Date): string { return d.toISOString().split('T')[0] }

// ── Modale ajout au planner ──────────────────────────────────────────────────
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function AddToWeekModal({ workoutId, onClose, onAdded }: { workoutId: string; onClose: () => void; onAdded: () => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const weekStart = toISODate(getMonday(new Date()))
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 })()

  async function handleAdd() {
    if (selected === null) return
    setSaving(true)
    await fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId, dayOfWeek: selected, weekStart }),
    })
    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <div onClick={onClose} className="overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 380, padding: '24px 24px 20px', boxShadow: 'var(--elev-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarPlus size={16} color="var(--gold)" />
            <span style={{ fontWeight: 700, fontSize: 16 }}>Ajouter à ma semaine</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
          {DAYS_FR.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding: '10px 4px', borderRadius: 10, border: `2px solid ${selected === i ? 'var(--crimson)' : i === todayIdx ? 'rgba(200,165,95,0.3)' : 'var(--border)'}`,
                background: selected === i ? 'var(--crimson-ghost)' : 'var(--bg-elevated)',
                color: selected === i ? 'var(--crimson-bright)' : i === todayIdx ? 'rgba(200,165,95,0.8)' : 'var(--text-muted)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
              }}
            >{day}</button>
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={selected === null || saving}
          style={{ width: '100%', padding: '11px', background: 'var(--gold)', color: 'var(--ink)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: selected === null || saving ? 'default' : 'pointer', opacity: selected === null ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <CalendarPlus size={14} />
          {saving ? 'Ajout…' : selected !== null ? `Ajouter — ${DAYS_FR[selected]}` : 'Choisir un jour'}
        </button>
      </div>
    </div>
  )
}

// ── Modale de partage ────────────────────────────────────────────────────────
function ShareModal({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleShare() {
    if (!email.trim()) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/workouts/${workout.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Erreur'); setStatus('error') }
      else setStatus('done')
    } catch { setErrorMsg('Erreur réseau'); setStatus('error') }
  }

  return (
    <div onClick={onClose} className="overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 420, padding: '24px 24px 20px', boxShadow: 'var(--elev-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Share2 size={16} color="var(--gold)" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Recommander cette séance</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {status === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>
            <CheckCircle2 size={40} color="var(--green)" />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Recommandation envoyée !</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> recevra un email. S'il l'accepte, la séance sera sauvegardée dans ses <em>Sauvegardés</em>.
            </div>
            <button onClick={onClose} style={{ marginTop: 8, padding: '9px 24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fermer</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Recommande cette séance à un autre utilisateur ARETE. S'il accepte, elle sera automatiquement ajoutée à ses <strong style={{ color: 'var(--text-primary)' }}>Sauvegardés</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setStatus('idle'); setErrorMsg('') }}
                onKeyDown={e => e.key === 'Enter' && handleShare()}
                placeholder="email@exemple.com"
                style={{ flex: 1, background: 'var(--bg-elevated)', border: `1px solid ${status === 'error' ? 'var(--red)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={handleShare}
                disabled={status === 'sending' || !email.trim()}
                style={{ padding: '9px 16px', background: 'var(--gold)', color: 'var(--ink)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: status === 'sending' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!email.trim() || status === 'sending') ? 0.6 : 1 }}
              >
                <Send size={13} />
                {status === 'sending' ? '…' : 'Envoyer'}
              </button>
            </div>
            {status === 'error' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--red)' }}>
                <AlertCircle size={13} />{errorMsg}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Workout card ─────────────────────────────────────────────────────────────
function WorkoutCard({
  w, context, onShare, onToggleSave, onDelete, onToggleFavorite,
}: {
  w: Workout
  context: 'mine' | 'saved' | 'community'
  onShare?: () => void
  onToggleSave?: (saved: boolean) => void
  onDelete?: () => void
  onToggleFavorite?: (fav: boolean) => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [isSaved, setIsSaved] = useState(w.isSaved ?? false)
  const [isFavorite, setIsFavorite] = useState(w.isFavorite ?? false)
  const [addingToWeek, setAddingToWeek] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bioTypes = Array.from(new Set(w.movements.map(m => m.movement.bioType)))
  const difficulty = computeWorkoutDifficulty(w.movements.map(m => ({ complexity: m.movement.complexity })))
  const estMin = estimateWorkoutMinutes(toDurationMovements(w.movements), w.blocks)
  const initiale = w.user?.email?.[0]?.toUpperCase() ?? '?'
  const { columns: previewColumns, hiddenBlocksCount } = buildCardPreview(w)

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${w.id}/duplicate`, { method: 'POST' })
    const copy = await res.json()
    setDuplicating(false)
    router.push(`/workouts/${copy.id}`)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Supprimer cette séance ?')) return
    setDeleting(true)
    await fetch(`/api/workouts/${w.id}`, { method: 'DELETE' })
    setDeleting(false)
    onDelete?.()
  }

  async function handleToggleSave() {
    setSaving(true)
    const method = isSaved ? 'DELETE' : 'POST'
    await fetch(`/api/workouts/${w.id}/save`, { method })
    const next = !isSaved
    setIsSaved(next)
    setSaving(false)
    onToggleSave?.(next)
  }

  async function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault()
    setToggling(true)
    const res = await fetch(`/api/workouts/${w.id}/favorite`, { method: 'POST' })
    const data = await res.json()
    setIsFavorite(data.favorited)
    setToggling(false)
    onToggleFavorite?.(data.favorited)
  }

  const showFooter = context === 'mine' || context === 'saved' || context === 'community'

  return (
    <div className="card card-interactive" style={{ borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <Link href={`/workouts/${w.id}`} style={{ textDecoration: 'none', display: 'block', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
          <div style={{ width: 90, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {w.imageUrl ? (
              <img src={w.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: w.imagePosition || '50% 50%', display: 'block' }} />
            ) : (
              <img src="/logo.svg" alt="" style={{ width: '40%', height: '40%', objectFit: 'contain', opacity: 0.18, display: 'block' }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
                  {isFavorite && <Star size={12} fill="var(--gold)" color="var(--gold)" style={{ flexShrink: 0 }} />}
                </div>
                {w.description && stripHtmlMultiline(w.description) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtmlMultiline(w.description)}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {new Date(w.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  {w.duration ? ` · ${w.duration} min cible` : ''}
                  {context !== 'mine' && w.user && (
                    <>
                      <span>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{initiale}</span>
                        {w.user.email.split('@')[0]}
                      </span>
                    </>
                  )}
                  {context === 'saved' && w._savedSource === 'shared' && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(200,165,95,0.12)', color: 'var(--gold)', border: '1px solid rgba(200,165,95,0.25)', fontWeight: 600 }}>recommandé</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dim)' }}>{w.movements.length}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', marginTop: 1 }}>{fmtMin(estMin)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 1 }}>
          {previewColumns.map((col, ci) => (
            <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {col.label && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</div>}
              {col.movements.map((m, mi) => (
                <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{m.name}</span>
                </div>
              ))}
              {col.hiddenInColumn > 0 && <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>+{col.hiddenInColumn}…</div>}
            </div>
          ))}
          {hiddenBlocksCount > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>+{hiddenBlocksCount} blocs</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {difficulty && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: `${COMPLEXITY_COLORS[difficulty]}18`, color: COMPLEXITY_COLORS[difficulty], border: `1px solid ${COMPLEXITY_COLORS[difficulty]}40` }}>{difficulty}</span>
          )}
          {bioTypes.map(bt => (
            <span key={bt} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${BIO_TYPE_COLORS[bt] || '#fff'}15`, color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)', border: `1px solid ${BIO_TYPE_COLORS[bt] || '#fff'}28` }}>{bt}</span>
          ))}
          {w.tags && w.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
            <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--gold-ghost)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>#{tag}</span>
          ))}
        </div>
      </Link>

      {showFooter && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {/* Gauche : favori + actions contextuelles */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(context === 'mine' || context === 'saved') && (
              <button onClick={handleToggleFavorite} disabled={toggling}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: isFavorite ? 'rgba(200,165,95,0.12)' : 'none', border: `1px solid ${isFavorite ? 'rgba(200,165,95,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 9px', color: isFavorite ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, cursor: toggling ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                <Star size={12} fill={isFavorite ? 'var(--gold)' : 'none'} />
              </button>
            )}
            {context === 'community' && (
              <button onClick={e => { e.preventDefault(); handleToggleSave() }} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: isSaved ? 'rgba(200,165,95,0.1)' : 'none', border: `1px solid ${isSaved ? 'rgba(200,165,95,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 10px', color: isSaved ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                {isSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                {isSaved ? 'Sauvegardé' : 'Sauvegarder'}
              </button>
            )}
            {context === 'saved' && (
              <button onClick={e => { e.preventDefault(); handleToggleSave() }} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                <X size={11} /> Retirer
              </button>
            )}
            {context === 'mine' && onShare && (
              <button onClick={e => { e.preventDefault(); onShare() }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                <Share2 size={12} /> Recommander
              </button>
            )}
          </div>

          {/* Droite : Démarrer → Semaine → Dupliquer → Modifier → Supprimer */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.preventDefault(); router.push(`/workouts/${w.id}/active`) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(200,165,95,0.12)', border: '1px solid rgba(200,165,95,0.35)', borderRadius: 6, padding: '5px 11px', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <PlayCircle size={13} /> Démarrer
            </button>
            {(context === 'mine' || context === 'saved') && (
              <button onClick={e => { e.preventDefault(); setAddingToWeek(true) }}
                title="Ajouter à ma semaine"
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', borderRadius: 6, padding: '5px 10px', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <CalendarPlus size={12} /> Semaine
              </button>
            )}
            {context === 'mine' && (
              <>
                <button onClick={handleDuplicate} disabled={duplicating}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: duplicating ? 'wait' : 'pointer', opacity: duplicating ? 0.6 : 1 }}>
                  <Copy size={12} /> {duplicating ? '…' : 'Dupliquer'}
                </button>
                <button onClick={e => { e.preventDefault(); router.push(`/workouts/${w.id}?edit=1`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Pencil size={12} /> Modifier
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: deleting ? 'var(--text-dim)' : 'var(--red)', fontSize: 12, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!deleting) { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'var(--red)' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {addingToWeek && (
        <AddToWeekModal
          workoutId={w.id}
          onClose={() => setAddingToWeek(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  )
}

// ── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <span style={{ color: 'var(--text-dim)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{count}</span>
    </div>
  )
}

// ── Tabs principal ───────────────────────────────────────────────────────────
export default function WorkoutsTabs({ currentUserId }: { currentUserId: string | null }) {
  const [tab, setTab] = useState<'mine' | 'community'>('mine')
  const [myWorkouts, setMyWorkouts] = useState<Workout[]>([])
  const [savedWorkouts, setSavedWorkouts] = useState<Workout[]>([])
  const [communityWorkouts, setCommunityWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sharingWorkout, setSharingWorkout] = useState<Workout | null>(null)
  const toast = useToast()
  const [claiming, setClaiming] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  // Filtres multi-sélection : un ensemble vide = pas de restriction sur ce critère
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [bioFilters, setBioFilters] = useState<Set<string>>(new Set())
  const [difficultyFilters, setDifficultyFilters] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [searchQuery, setSearchQuery] = useState('')

  const toggleInSet = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSet(next)
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('imported') === '1') {
      toast('Séance sauvegardée ✓ ✓')
      window.history.replaceState({}, '', '/workouts')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Le tag n'est plus filtré côté serveur : toutes les données du tab sont
  // chargées une fois, puis les filtres (bio/difficulté/tags, multi-sélection)
  // s'appliquent côté client comme le reste — plus de rechargement réseau
  // à chaque clic sur un tag.
  const loadMine = useCallback(async () => {
    setFetchError(null)
    try {
      const [rMine, rSaved] = await Promise.all([
        fetch('/api/workouts?filter=mine').then(async r => {
          const data = await r.json()
          if (!r.ok) throw new Error(data?.details ?? data?.error ?? `HTTP ${r.status}`)
          return Array.isArray(data) ? data : []
        }),
        fetch('/api/workouts?filter=saved').then(async r => {
          const data = await r.json()
          if (!r.ok) throw new Error(data?.details ?? data?.error ?? `HTTP ${r.status}`)
          return Array.isArray(data) ? data : []
        }),
      ])
      setMyWorkouts(rMine)
      setSavedWorkouts(rSaved)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erreur de chargement')
    }
  }, [])

  const loadCommunity = useCallback(async () => {
    const data = await fetch('/api/workouts?filter=community').then(r => r.json())
    setCommunityWorkouts(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = tab === 'mine' ? loadMine() : loadCommunity()
    p.finally(() => setLoading(false))
  }, [tab, loadMine, loadCommunity])

  const tabStyle = (t: 'mine' | 'community'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: tab === t ? 700 : 500, fontSize: 13,
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? 'var(--on-accent)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  })

  const hasAnything = myWorkouts.length > 0 || savedWorkouts.length > 0

  const handleClaimWorkouts = async () => {
    setClaiming(true)
    try {
      const res = await fetch('/api/workouts/claim', { method: 'POST' })
      const { claimed } = await res.json()
      if (claimed > 0) {
        toast(`${claimed} séance${claimed > 1 ? 's' : ''} récupérée${claimed > 1 ? 's' : ''} ✓`)
        await loadMine()
      } else {
        toast('Aucune séance orpheline trouvée', 'info')
      }
    } finally {
      setClaiming(false)
    }
  }

  // Tags disponibles dans l'onglet courant
  const allTagsSet = new Set<string>()
  const allSrc = tab === 'mine' ? [...myWorkouts, ...savedWorkouts] : communityWorkouts
  allSrc.forEach(w => w.tags?.split(',').map(t => t.trim()).filter(Boolean).forEach(t => allTagsSet.add(t)))
  const availableTags = Array.from(allTagsSet).sort()

  // Filtre local, multi-sélection : recherche texte + type biomécanique + difficulté + tags,
  // tous appliqués côté client. À l'intérieur d'un critère c'est un OU (une séance "Tirage"
  // OU "Poussée" matche si les deux sont cochés), entre critères c'est un ET.
  const matchesFilter = (w: Workout) => {
    if (searchQuery.trim() && !w.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false
    if (bioFilters.size > 0 && !w.movements.some(wm => bioFilters.has(wm.movement.bioType))) return false
    if (difficultyFilters.size > 0) {
      const diff = computeWorkoutDifficulty(w.movements.map(wm => ({ complexity: wm.movement.complexity })))
      if (!diff || !difficultyFilters.has(diff)) return false
    }
    if (activeTags.size > 0) {
      const tags = w.tags?.split(',').map(t => t.trim()).filter(Boolean) ?? []
      if (!tags.some(t => activeTags.has(t))) return false
    }
    return true
  }
  const myWorkoutsFiltered = sortWorkouts(myWorkouts.filter(matchesFilter), sortBy)
  const savedWorkoutsFiltered = sortWorkouts(savedWorkouts.filter(matchesFilter), sortBy)
  const communityWorkoutsFiltered = sortWorkouts(communityWorkouts.filter(matchesFilter), sortBy)

  // Sections dérivées
  const allMine = [...myWorkoutsFiltered, ...savedWorkoutsFiltered]
  const favorites = allMine.filter(w => w.isFavorite)
  // Récents : triés par lastViewedAt (saved) ou createdAt (mine), top 5, non favoris
  const nonFavs = allMine.filter(w => !w.isFavorite)
  const recents = [...nonFavs].sort((a, b) => {
    const da = new Date(a._lastViewedAt ?? a._savedAt ?? a.createdAt).getTime()
    const db = new Date(b._lastViewedAt ?? b._savedAt ?? b.createdAt).getTime()
    return db - da
  }).slice(0, 5)

  const updateFavorite = (id: string, fav: boolean) => {
    setMyWorkouts(prev => prev.map(w => w.id === id ? { ...w, isFavorite: fav } : w))
    setSavedWorkouts(prev => prev.map(w => w.id === id ? { ...w, isFavorite: fav } : w))
  }

  return (
    <>
      {/* Tabs + compteur dynamique */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, boxShadow: 'var(--shadow-sm)' }}>
          <button style={tabStyle('mine')} onClick={() => setTab('mine')}><User size={14} /> Mes séances</button>
          <button style={tabStyle('community')} onClick={() => setTab('community')}><Users size={14} /> Communauté</button>
        </div>
        {!loading && (
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {tab === 'mine'
              ? `${myWorkoutsFiltered.length + savedWorkoutsFiltered.length} entraînement${myWorkoutsFiltered.length + savedWorkoutsFiltered.length !== 1 ? 's' : ''}`
              : `${communityWorkoutsFiltered.length} entraînement${communityWorkoutsFiltered.length !== 1 ? 's' : ''} dans la communauté`
            }
          </span>
        )}
      </div>

      {/* Recherche texte + tri */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', maxWidth: 340, flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une séance…"
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={12} color="var(--text-muted)" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px' }}>
          <ArrowUpDown size={13} color="var(--text-muted)" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
              <option key={opt} value={opt} style={{ background: 'var(--bg-card)' }}>{SORT_LABELS[opt]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filtre type biomécanique (multi-sélection) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {BIO_TYPES.map(bt => {
          const active = bioFilters.has(bt)
          return (
            <button
              key={bt}
              onClick={() => toggleInSet(bioFilters, setBioFilters, bt)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: active ? `${BIO_TYPE_COLORS[bt]}18` : 'var(--bg-card)',
                color: active ? BIO_TYPE_COLORS[bt] : 'var(--text-muted)',
                border: `1px solid ${active ? BIO_TYPE_COLORS[bt] : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}
            >{BIO_TYPE_ICONS[bt]} {bt}</button>
          )
        })}
        {bioFilters.size > 0 && (
          <button
            onClick={() => setBioFilters(new Set())}
            style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          ><X size={11} /> Tout</button>
        )}
      </div>

      {/* Filtre difficulté (multi-sélection) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {COMPLEXITIES.map(c => {
          const active = difficultyFilters.has(c)
          const color = COMPLEXITY_COLORS[c]
          return (
            <button
              key={c}
              onClick={() => toggleInSet(difficultyFilters, setDifficultyFilters, c)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: active ? `${color}18` : 'var(--bg-card)',
                color: active ? color : 'var(--text-muted)',
                border: `1px solid ${active ? color : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}
            >{c}</button>
          )
        })}
        {difficultyFilters.size > 0 && (
          <button
            onClick={() => setDifficultyFilters(new Set())}
            style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          ><X size={11} /> Tout</button>
        )}
      </div>

      {/* Filtre tags */}
      {availableTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleInSet(activeTags, setActiveTags, tag)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeTags.has(tag) ? 'var(--crimson-ghost)' : 'var(--bg-card)',
                color: activeTags.has(tag) ? 'var(--crimson-bright)' : 'var(--text-muted)',
                border: `1px solid ${activeTags.has(tag) ? 'var(--crimson-border)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}
            >#{tag}</button>
          ))}
          {activeTags.size > 0 && (
            <button
              onClick={() => setActiveTags(new Set())}
              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            ><X size={11} /> Tout</button>
          )}
        </div>
      )}

      {/* Erreur de chargement */}
      {fetchError && (
        <div style={{ padding: '12px 16px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 10, fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
          ⚠ Erreur : {fetchError}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 140, background: 'var(--bg-card)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      )}

      {/* ── Onglet MES WORKOUTS ── */}
      {!loading && tab === 'mine' && (
        <>
          {!hasAnything && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucune séance</div>
              <div style={{ fontSize: 13, marginBottom: 24 }}>Génère et sauvegarde ta première séance</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/generator">
                  <button style={{ padding: '11px 26px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <Zap size={14} /> Générer
                  </button>
                </Link>
                <button
                  onClick={handleClaimWorkouts}
                  disabled={claiming}
                  style={{ padding: '11px 20px', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: claiming ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: claiming ? 0.6 : 1 }}
                >
                  {claiming ? '…' : '↩ Récupérer mes anciennes séances'}
                </button>
              </div>
            </div>
          )}

          {hasAnything && myWorkoutsFiltered.length === 0 && savedWorkoutsFiltered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Aucun résultat</div>
              <div style={{ fontSize: 13 }}>Aucune séance ne correspond à ta recherche ou à ce filtre</div>
            </div>
          )}

          {/* Section Favoris */}
          {favorites.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div
                onClick={() => setFavoritesOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: favoritesOpen ? 12 : 0, marginTop: 4, cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ color: 'var(--gold)', display: 'flex' }}><Star size={13} fill="var(--gold)" /></span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Favoris</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{favorites.length}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', display: 'flex' }}>{favoritesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
              </div>
              {favoritesOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {favorites.map(w => (
                    <WorkoutCard
                      key={w.id}
                      w={w}
                      context={myWorkouts.find(x => x.id === w.id) ? 'mine' : 'saved'}
                      onShare={myWorkouts.find(x => x.id === w.id) ? () => setSharingWorkout(w) : undefined}
                      onDelete={myWorkouts.find(x => x.id === w.id) ? () => setMyWorkouts(prev => prev.filter(x => x.id !== w.id)) : undefined}
                      onToggleSave={savedWorkouts.find(x => x.id === w.id) ? () => setSavedWorkouts(prev => prev.filter(x => x.id !== w.id)) : undefined}
                      onToggleFavorite={fav => updateFavorite(w.id, fav)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section Récents (non favoris) */}
          {recents.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div
                onClick={() => setRecentsOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: recentsOpen ? 12 : 0, marginTop: 4, cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ color: 'var(--text-dim)', display: 'flex' }}><Clock size={13} /></span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Récents</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{recents.length}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', display: 'flex' }}>{recentsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
              </div>
              {recentsOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recents.map(w => (
                  <WorkoutCard
                    key={w.id}
                    w={w}
                    context={myWorkouts.find(x => x.id === w.id) ? 'mine' : 'saved'}
                    onShare={myWorkouts.find(x => x.id === w.id) ? () => setSharingWorkout(w) : undefined}
                    onDelete={myWorkouts.find(x => x.id === w.id) ? () => setMyWorkouts(prev => prev.filter(x => x.id !== w.id)) : undefined}
                    onToggleSave={savedWorkouts.find(x => x.id === w.id) ? () => setSavedWorkouts(prev => prev.filter(x => x.id !== w.id)) : undefined}
                    onToggleFavorite={fav => updateFavorite(w.id, fav)}
                  />
                ))}
              </div>}
            </div>
          )}

          {myWorkoutsFiltered.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SectionLabel icon={<Zap size={13} />} label="Mes créations" count={myWorkoutsFiltered.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myWorkoutsFiltered.map(w => (
                  <WorkoutCard
                    key={w.id}
                    w={w}
                    context="mine"
                    onShare={() => setSharingWorkout(w)}
                    onDelete={() => setMyWorkouts(prev => prev.filter(x => x.id !== w.id))}
                    onToggleFavorite={fav => updateFavorite(w.id, fav)}
                  />
                ))}
              </div>
            </div>
          )}

          {savedWorkoutsFiltered.length > 0 && (
            <div>
              <SectionLabel icon={<Layers size={13} />} label="Sauvegardés" count={savedWorkoutsFiltered.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {savedWorkoutsFiltered.map(w => (
                  <WorkoutCard
                    key={w.id}
                    w={w}
                    context="saved"
                    onToggleSave={() => setSavedWorkouts(prev => prev.filter(x => x.id !== w.id))}
                    onToggleFavorite={fav => updateFavorite(w.id, fav)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Onglet COMMUNAUTÉ ── */}
      {!loading && tab === 'community' && (
        <>
          {communityWorkoutsFiltered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>👥</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucune séance</div>
              <div style={{ fontSize: 13 }}>
                {communityWorkouts.length === 0 ? 'Les séances de tes coéquipiers apparaîtront ici' : 'Aucun résultat pour ce filtre'}
              </div>
            </div>
          )}
          {communityWorkoutsFiltered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {communityWorkoutsFiltered.map(w => (
                <WorkoutCard
                  key={w.id}
                  w={w}
                  context="community"
                  onToggleSave={saved => {
                    setCommunityWorkouts(prev => prev.map(x => x.id === w.id ? { ...x, isSaved: saved } : x))
                    if (saved) toast('Séance sauvegardée ✓ ✓')
                  }}
                  onShare={() => setSharingWorkout(w)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modale recommandation */}
      {sharingWorkout && <ShareModal workout={sharingWorkout} onClose={() => setSharingWorkout(null)} />}

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </>
  )
}
