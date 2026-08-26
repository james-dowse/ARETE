'use client'
import { useState, useEffect, useCallback } from 'react'
import { Star, X, Search, Trash2, CheckCircle2, Plus } from 'lucide-react'

interface Assignment {
  id: string
  note: string | null
  scheduledFor: string | null
  createdAt: string
  done: boolean
  workout: { id: string; name: string; duration: number | null }
  assignedTo: { id: string; email: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }
  assignedBy: { firstName: string | null; lastName: string | null; email: string }
}

function displayName(u: { email: string; firstName?: string | null; lastName?: string | null }) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return name || u.email.split('@')[0]
}

export default function ProgramsClient() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/assignments').then(r => r.json()).then(data => {
      setAssignments(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    setAssignments(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' })
  }

  // Groupé par user, chaque groupe trié : à faire d'abord, puis fait, plus récent en tête.
  const byUser = new Map<string, { user: Assignment['assignedTo']; items: Assignment[] }>()
  for (const a of assignments) {
    if (!byUser.has(a.assignedTo.id)) byUser.set(a.assignedTo.id, { user: a.assignedTo, items: [] })
    byUser.get(a.assignedTo.id)!.items.push(a)
  }
  const groups = Array.from(byUser.values()).sort((g1, g2) => {
    const pending1 = g1.items.some(a => !a.done)
    const pending2 = g2.items.some(a => !a.done)
    if (pending1 !== pending2) return pending1 ? -1 : 1
    return displayName(g1.user).localeCompare(displayName(g2.user))
  })

  const totalPending = assignments.filter(a => !a.done).length

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Programmes</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14 }}>
            {assignments.length} WOD assigné{assignments.length !== 1 ? 's' : ''} · {totalPending} en attente
          </p>
        </div>
        <button
          onClick={() => setAssigning(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--gold)', color: 'var(--ink)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <Plus size={14} /> Assigner un WOD
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 68, background: 'var(--bg-card)', borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <div style={{ fontWeight: 600 }}>Aucun WOD assigné pour l&apos;instant</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Assignez une séance à un utilisateur pour la retrouver ici</div>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(({ user, items }) => {
            const pending = items.filter(a => !a.done).length
            return (
              <div key={user.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayName(user)[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{displayName(user)}</span>
                  {pending > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', border: '1px solid var(--gold-border)', borderRadius: 20, padding: '2px 9px' }}>
                      {pending} à faire
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                      {a.done ? (
                        <CheckCircle2 size={14} style={{ color: 'var(--green, #6a9)', flexShrink: 0 }} />
                      ) : (
                        <Star size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.workout.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
                          {a.done ? 'Fait' : 'À faire'}
                          {a.scheduledFor && ` · prévu le ${new Date(a.scheduledFor).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                          {a.note && ` · « ${a.note} »`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(a.id)}
                        title="Retirer cette assignation"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-dim)', borderRadius: 6, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {assigning && (
        <NewAssignmentModal
          onClose={() => setAssigning(false)}
          onAssigned={() => { setAssigning(false); load() }}
        />
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  )
}

interface SearchWorkout { id: string; name: string; duration?: number | null }
interface SearchUser { id: string; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null }

function NewAssignmentModal({ onClose, onAssigned }: { onClose: () => void; onAssigned: () => void }) {
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [wodQuery, setWodQuery] = useState('')
  const [wodResults, setWodResults] = useState<SearchWorkout[]>([])
  const [selectedWod, setSelectedWod] = useState<SearchWorkout | null>(null)
  const [note, setNote] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La recherche users de /api/search exclut les profils sans prénom/nom renseigné
  // (recherche par nom uniquement) — repli sur la liste admin complète, filtrée
  // côté client par email, pour ne rater aucun utilisateur.
  const [allUsers, setAllUsers] = useState<SearchUser[] | null>(null)
  useEffect(() => { fetch('/api/invitations').then(r => r.json()).then(setAllUsers).catch(() => setAllUsers([])) }, [])

  useEffect(() => {
    if (!allUsers) return
    if (!userQuery.trim()) { setUserResults([]); return }
    const q = userQuery.trim().toLowerCase()
    setUserResults(allUsers.filter((u: SearchUser & { status?: string }) =>
      (u as any).status === 'accepted' && (
        u.email?.toLowerCase().includes(q) ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
      )
    ).slice(0, 8))
  }, [userQuery, allUsers])

  useEffect(() => {
    if (wodQuery.trim().length < 2) { setWodResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(wodQuery)}`).then(r => r.json()).then(data => setWodResults(data.workouts ?? []))
    }, 220)
    return () => clearTimeout(t)
  }, [wodQuery])

  async function handleAssign() {
    if (!selectedUser || !selectedWod) return
    setSaving(true); setError(null)
    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId: selectedWod.id, assignedToId: selectedUser.id, note, scheduledFor: scheduledFor || null }),
    })
    setSaving(false)
    if (!res.ok) { setError('Erreur lors de l\'assignation'); return }
    onAssigned()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 460, maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Assigner un WOD</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Utilisateur</label>
        {!selectedUser ? (
          <div style={{ marginTop: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
              <Search size={13} color="var(--text-muted)" />
              <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Nom ou email…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>
            {userResults.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 140, overflowY: 'auto' }}>
                {userResults.map(u => (
                  <button key={u.id} onClick={() => setSelectedUser(u)} style={{ textAlign: 'left', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    {displayName(u)} {u.email && <span style={{ color: 'var(--text-dim)' }}>· {u.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '8px 12px', marginTop: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{displayName(selectedUser)}</span>
            <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--text-dim)' }}>Changer</button>
          </div>
        )}

        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Séance</label>
        {!selectedWod ? (
          <div style={{ marginTop: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
              <Search size={13} color="var(--text-muted)" />
              <input value={wodQuery} onChange={e => setWodQuery(e.target.value)} placeholder="Rechercher une séance…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>
            {wodResults.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 140, overflowY: 'auto' }}>
                {wodResults.map(w => (
                  <button key={w.id} onClick={() => setSelectedWod(w)} style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'left', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <span>{w.name}</span>
                    {w.duration && <span style={{ color: 'var(--text-dim)' }}>{w.duration} min</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '8px 12px', marginTop: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{selectedWod.name}</span>
            <button onClick={() => setSelectedWod(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--text-dim)' }}>Changer</button>
          </div>
        )}

        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Note (optionnel)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={280} style={{ width: '100%', marginTop: 6, marginBottom: 12, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />

        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Date prévue (optionnel)</label>
        <input type="date" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} style={{ width: '100%', marginTop: 6, marginBottom: 16, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13 }} />

        {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{error}</div>}

        <button
          onClick={handleAssign}
          disabled={saving || !selectedUser || !selectedWod}
          style={{ width: '100%', padding: '10px 16px', background: 'var(--gold)', color: '#1D1813', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: (saving || !selectedUser || !selectedWod) ? 0.5 : 1 }}
        >
          {saving ? 'Envoi…' : 'Assigner ce WOD'}
        </button>
      </div>
    </div>
  )
}
