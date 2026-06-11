'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BIO_TYPE_COLORS } from '@/lib/types'
import { Zap, Users, User, Share2, X, Send, CheckCircle2, AlertCircle, Bookmark, BookmarkCheck, Layers, Star, Clock, ChevronDown, ChevronUp, CalendarPlus, Copy, Pencil, Trash2 } from 'lucide-react'

interface WorkoutUser { id: string; email: string }
interface WorkoutMovementItem { id: string; sets?: number | null; movement: { bioType: string; name: string } }
interface Workout {
  id: string
  name: string
  createdAt: string
  duration?: number | null
  movements: WorkoutMovementItem[]
  user?: WorkoutUser | null
  isSaved?: boolean
  isFavorite?: boolean
  tags?: string | null
  _savedSource?: string
  _savedAt?: string
  _lastViewedAt?: string | null
}

const fmtMin = (min: number) => min < 60 ? `~${min}min` : `~${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`

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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 380, padding: '24px 24px 20px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
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
                padding: '10px 4px', borderRadius: 10, border: `2px solid ${selected === i ? 'var(--gold)' : i === todayIdx ? 'rgba(200,169,81,0.3)' : 'var(--border)'}`,
                background: selected === i ? 'rgba(200,169,81,0.15)' : 'var(--bg-elevated)',
                color: selected === i ? 'var(--gold)' : i === todayIdx ? 'rgba(200,169,81,0.8)' : 'var(--text-muted)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
              }}
            >{day}</button>
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={selected === null || saving}
          style={{ width: '100%', padding: '11px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: selected === null || saving ? 'default' : 'pointer', opacity: selected === null ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 420, padding: '24px 24px 20px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Share2 size={16} color="var(--gold,#C9A535)" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Recommander ce workout</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {status === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>
            <CheckCircle2 size={40} color="#22c55e" />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Recommandation envoyée !</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> recevra un email. S'il l'accepte, le workout sera sauvegardé dans ses <em>Sauvegardés</em>.
            </div>
            <button onClick={onClose} style={{ marginTop: 8, padding: '9px 24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fermer</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Recommande ce workout à un autre utilisateur ARETE. S'il accepte, il sera automatiquement ajouté à ses <strong style={{ color: 'var(--text-primary)' }}>Sauvegardés</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setStatus('idle'); setErrorMsg('') }}
                onKeyDown={e => e.key === 'Enter' && handleShare()}
                placeholder="email@exemple.com"
                style={{ flex: 1, background: 'var(--bg-elevated)', border: `1px solid ${status === 'error' ? '#ef4444' : 'var(--border)'}`, borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={handleShare}
                disabled={status === 'sending' || !email.trim()}
                style={{ padding: '9px 16px', background: 'var(--gold,#C9A535)', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: status === 'sending' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!email.trim() || status === 'sending') ? 0.6 : 1 }}
              >
                <Send size={13} />
                {status === 'sending' ? '…' : 'Envoyer'}
              </button>
            </div>
            {status === 'error' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444' }}>
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
  const estMin = Math.round(w.movements.reduce((sum, wm) => sum + (wm.sets ?? 2), 0))
  const initiale = w.user?.email?.[0]?.toUpperCase() ?? '?'

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
    if (!confirm('Supprimer ce workout ?')) return
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
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <Link href={`/workouts/${w.id}`} style={{ textDecoration: 'none', display: 'block', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
              {isFavorite && <Star size={12} fill="var(--gold)" color="var(--gold)" style={{ flexShrink: 0 }} />}
            </div>
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
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(201,165,53,0.12)', color: '#C9A535', border: '1px solid rgba(201,165,53,0.25)', fontWeight: 600 }}>recommandé</span>
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
          {w.movements.length > 3 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>+{w.movements.length - 3} autres</div>}
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
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
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: isFavorite ? 'rgba(200,169,81,0.12)' : 'none', border: `1px solid ${isFavorite ? 'rgba(200,169,81,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 9px', color: isFavorite ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, cursor: toggling ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                <Star size={12} fill={isFavorite ? 'var(--gold)' : 'none'} />
              </button>
            )}
            {context === 'community' && (
              <button onClick={e => { e.preventDefault(); handleToggleSave() }} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: isSaved ? 'rgba(201,165,53,0.1)' : 'none', border: `1px solid ${isSaved ? 'rgba(201,165,53,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 10px', color: isSaved ? '#C9A535' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer', transition: 'all 0.15s' }}>
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
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold,#C9A535)'; e.currentTarget.style.color = 'var(--gold,#C9A535)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                <Share2 size={12} /> Recommander
              </button>
            )}
          </div>

          {/* Droite : Semaine → Dupliquer → Modifier → Supprimer (même ordre que la page détail) */}
          <div style={{ display: 'flex', gap: 4 }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: deleting ? 'var(--text-dim)' : '#ef4444', fontSize: 12, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!deleting) { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = '#ef4444' } }}
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
  const [toast, setToast] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('imported') === '1') {
      setToast('Workout sauvegardé ✓ ✓')
      window.history.replaceState({}, '', '/workouts')
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const loadMine = useCallback(async (tag?: string | null) => {
    setFetchError(null)
    try {
      const tagParam = tag ? `&tag=${encodeURIComponent(tag)}` : ''
      const [rMine, rSaved] = await Promise.all([
        fetch(`/api/workouts?filter=mine${tagParam}`).then(async r => {
          const data = await r.json()
          if (!r.ok) throw new Error(data?.details ?? data?.error ?? `HTTP ${r.status}`)
          return Array.isArray(data) ? data : []
        }),
        fetch(`/api/workouts?filter=saved${tagParam}`).then(async r => {
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

  const loadCommunity = useCallback(async (tag?: string | null) => {
    const tagParam = tag ? `&tag=${encodeURIComponent(tag)}` : ''
    const data = await fetch(`/api/workouts?filter=community${tagParam}`).then(r => r.json())
    setCommunityWorkouts(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = tab === 'mine' ? loadMine(activeTag) : loadCommunity(activeTag)
    p.finally(() => setLoading(false))
  }, [tab, activeTag, loadMine, loadCommunity])

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
        setToast(`${claimed} workout${claimed > 1 ? 's' : ''} récupéré${claimed > 1 ? 's' : ''} ✓`)
        await loadMine()
      } else {
        setToast('Aucun workout orphelin trouvé')
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

  // Sections dérivées
  const allMine = [...myWorkouts, ...savedWorkouts]
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
          <button style={tabStyle('mine')} onClick={() => setTab('mine')}><User size={14} /> Mes workouts</button>
          <button style={tabStyle('community')} onClick={() => setTab('community')}><Users size={14} /> Communauté</button>
        </div>
        {!loading && (
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {tab === 'mine'
              ? `${myWorkouts.length + savedWorkouts.length} entraînement${myWorkouts.length + savedWorkouts.length !== 1 ? 's' : ''}`
              : `${communityWorkouts.length} entraînement${communityWorkouts.length !== 1 ? 's' : ''} dans la communauté`
            }
          </span>
        )}
      </div>

      {/* Filtre tags */}
      {availableTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeTag === tag ? 'rgba(200,169,81,0.18)' : 'var(--bg-card)',
                color: activeTag === tag ? 'var(--gold)' : 'var(--text-muted)',
                border: `1px solid ${activeTag === tag ? 'var(--gold-border)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}
            >#{tag}</button>
          ))}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            ><X size={11} /> Tout</button>
          )}
        </div>
      )}

      {/* Erreur de chargement */}
      {fetchError && (
        <div style={{ padding: '12px 16px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 10, fontSize: 13, color: '#ef4444', marginBottom: 16 }}>
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
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucun workout</div>
              <div style={{ fontSize: 13, marginBottom: 24 }}>Génère et sauvegarde ton premier workout</div>
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
                  {claiming ? '…' : '↩ Récupérer mes anciens workouts'}
                </button>
              </div>
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

          {myWorkouts.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SectionLabel icon={<Zap size={13} />} label="Mes créations" count={myWorkouts.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myWorkouts.map(w => (
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

          {savedWorkouts.length > 0 && (
            <div>
              <SectionLabel icon={<Layers size={13} />} label="Sauvegardés" count={savedWorkouts.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {savedWorkouts.map(w => (
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
          {communityWorkouts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>👥</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucun workout</div>
              <div style={{ fontSize: 13 }}>Les workouts de tes coéquipiers apparaîtront ici</div>
            </div>
          )}
          {communityWorkouts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {communityWorkouts.map(w => (
                <WorkoutCard
                  key={w.id}
                  w={w}
                  context="community"
                  onToggleSave={saved => {
                    setCommunityWorkouts(prev => prev.map(x => x.id === w.id ? { ...x, isSaved: saved } : x))
                    if (saved) setToast('Workout sauvegardé ✓ ✓')
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

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 22px', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 2000, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </>
  )
}
