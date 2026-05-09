'use client'
import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { Mail, Trash2, RefreshCw, UserPlus, CheckCircle, Clock } from 'lucide-react'

interface InvitedUser {
  id: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
  acceptedAt?: string | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<InvitedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    const res = await fetch('/api/invitations')
    setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const invite = async () => {
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur inconnue')
      } else {
        setSuccess(data.resent
          ? `Invitation renvoyée à ${email}`
          : `Invitation envoyée à ${email}`)
        setEmail('')
        fetchUsers()
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setInviting(false)
    }
  }

  const revoke = async (id: string, userEmail: string) => {
    if (!confirm(`Révoquer l'invitation de ${userEmail} ?`)) return
    await fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const pending = users.filter(u => u.status === 'pending')
  const accepted = users.filter(u => u.status === 'accepted')

  return (
    <AppShell>
      <div style={{ maxWidth: 680 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Utilisateurs invités</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14 }}>
            Accès sur invitation uniquement · {users.length} utilisateur{users.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Invite form */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 28, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 14 }}>
            INVITER UN UTILISATEUR
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
              <Mail size={15} color="var(--text-muted)" />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); setSuccess(null) }}
                onKeyDown={e => e.key === 'Enter' && invite()}
                placeholder="prenom@exemple.com"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', flex: 1 }}
              />
            </div>
            <button
              onClick={invite}
              disabled={inviting || !email.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', background: 'var(--accent)', color: 'var(--on-accent)',
                border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13,
                cursor: inviting || !email.trim() ? 'not-allowed' : 'pointer',
                opacity: inviting || !email.trim() ? 0.6 : 1,
              }}
            >
              {inviting
                ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Envoi…</>
                : <><UserPlus size={14} /> Inviter</>}
            </button>
          </div>

          {/* Feedback */}
          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> {success}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 60, background: 'var(--bg-card)', borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        )}

        {!loading && users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600 }}>Aucune invitation envoyée</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Invitez votre premier utilisateur ci-dessus</div>
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Clock size={14} color="var(--orange)" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-muted)' }}>
                EN ATTENTE ({pending.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(u => <UserRow key={u.id} user={u} onRevoke={revoke} />)}
            </div>
          </div>
        )}

        {/* Accepted */}
        {accepted.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircle size={14} color="var(--green)" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-muted)' }}>
                ACCEPTÉES ({accepted.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accepted.map(u => <UserRow key={u.id} user={u} onRevoke={revoke} />)}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </AppShell>
  )
}

function UserRow({ user, onRevoke }: { user: InvitedUser; onRevoke: (id: string, email: string) => void }) {
  const accepted = user.status === 'accepted'
  const date = new Date(accepted && user.acceptedAt ? user.acceptedAt : user.invitedAt)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Avatar initiale */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: accepted ? 'rgba(21,128,61,0.1)' : 'rgba(194,65,12,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700,
        color: accepted ? 'var(--green)' : 'var(--orange)',
      }}>
        {user.email[0].toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.email}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {accepted ? `Accepté le ${date}` : `Invité le ${date}`}
        </div>
      </div>

      {/* Badge statut */}
      <span style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, flexShrink: 0,
        background: accepted ? 'rgba(21,128,61,0.1)' : 'rgba(194,65,12,0.1)',
        color: accepted ? 'var(--green)' : 'var(--orange)',
        border: `1px solid ${accepted ? 'rgba(21,128,61,0.25)' : 'rgba(194,65,12,0.25)'}`,
      }}>
        {accepted ? 'Accepté' : 'En attente'}
      </span>

      <button
        onClick={() => onRevoke(user.id, user.email)}
        title="Révoquer"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-dim)', borderRadius: 6, flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
