'use client'
import AppShell from '@/components/AppShell'
import { useState, useEffect, useRef } from 'react'
import { Mail, Trash2, RefreshCw, UserPlus, CheckCircle, Clock, Copy, Check, Link2, AlertTriangle, Pencil, X, Save, Camera } from 'lucide-react'

interface InvitedUser {
  id: string
  email: string
  status: 'pending' | 'accepted'
  invitedAt: string
  acceptedAt?: string | null
  token: string
}

interface UserProfile {
  id: string; email: string; status: string
  firstName: string | null; lastName: string | null
  bio: string | null; avatarUrl: string | null
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'

function inviteLink(token: string) {
  return `${APP_URL}/api/invite/accept?token=${token}`
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(inviteLink(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      title="Copier le lien d'invitation"
      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: copied ? 'var(--green)' : 'var(--text-dim)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copié !' : 'Copier le lien'}
    </button>
  )
}

export default function UsersClient({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<InvitedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; msg: string; inviteUrl?: string } | null>(null)
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)

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
    setFeedback(null)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setFeedback({ type: 'error', msg: data.error ?? 'Erreur inconnue' })
      } else if (data.emailRelayed) {
        // Email relay envoyé à l'admin
        setFeedback({
          type: 'warning',
          msg: `Utilisateur ajouté. L'email direct vers ${email} est bloqué (domaine non vérifié) — un email de relay t'a été envoyé à jimmy.dowse@gmail.com avec le lien à transmettre. Tu peux aussi le copier ici :`,
          inviteUrl: data.inviteUrl,
        })
        setEmail('')
        fetchUsers()
      } else if (!data.emailOk) {
        // Aucun email envoyé → lien manuel
        setFeedback({
          type: 'warning',
          msg: `Utilisateur ajouté mais aucun email envoyé. Partage ce lien manuellement :`,
          inviteUrl: data.inviteUrl,
        })
        setEmail('')
        fetchUsers()
      } else {
        setFeedback({
          type: 'success',
          msg: data.resent ? `Invitation renvoyée à ${email}` : `Invitation envoyée à ${email}`,
        })
        setEmail('')
        fetchUsers()
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur réseau' })
    } finally {
      setInviting(false)
    }
  }

  const revoke = async (id: string, userEmail: string) => {
    if (!confirm(`Révoquer l'accès de ${userEmail} ?`)) return
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
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Utilisateurs</h1>
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
                onChange={e => { setEmail(e.target.value); setFeedback(null) }}
                onKeyDown={e => e.key === 'Enter' && invite()}
                placeholder="prenom@exemple.com"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', flex: 1 }}
              />
            </div>
            <button
              onClick={invite}
              disabled={inviting || !email.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: inviting || !email.trim() ? 'not-allowed' : 'pointer', opacity: inviting || !email.trim() ? 0.6 : 1 }}
            >
              {inviting
                ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Envoi…</>
                : <><UserPlus size={14} /> Inviter</>}
            </button>
          </div>

          {/* Feedback */}
          {feedback?.type === 'error' && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠ {feedback.msg}
            </div>
          )}
          {feedback?.type === 'success' && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> {feedback.msg}
            </div>
          )}
          {feedback?.type === 'warning' && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--orange)', marginBottom: feedback.inviteUrl ? 10 : 0 }}>
                <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                {feedback.msg}
              </div>
              {feedback.inviteUrl && <InviteLinkBox url={feedback.inviteUrl} />}
            </div>
          )}
        </div>

        {/* Note config email si pas de clé */}
        <div style={{ marginBottom: 24, padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={13} style={{ flexShrink: 0 }} />
          Pour activer l'envoi d'emails, renseigne <code style={{ color: 'var(--text-primary)', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4 }}>RESEND_API_KEY</code> dans le fichier <code style={{ color: 'var(--text-primary)', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4 }}>.env</code>.
          En attendant, copie le lien manuellement après chaque invitation.
        </div>

        {/* Liste skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 68, background: 'var(--bg-card)', borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        )}

        {!loading && users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600 }}>Aucun utilisateur invité</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Invitez votre premier utilisateur ci-dessus</div>
          </div>
        )}

        {/* En attente */}
        {!loading && pending.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel icon={<Clock size={13} />} label={`En attente · ${pending.length}`} color="var(--orange)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(u => <UserRow key={u.id} user={u} onRevoke={revoke} isProtected={u.email === adminEmail} onEditProfile={async () => {
                const res = await fetch(`/api/admin/users/${u.id}`)
                setEditingProfile(await res.json())
              }} />)}
            </div>
          </div>
        )}

        {/* Acceptés */}
        {!loading && accepted.length > 0 && (
          <div>
            <SectionLabel icon={<CheckCircle size={13} />} label={`Accès actif · ${accepted.length}`} color="var(--green)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accepted.map(u => <UserRow key={u.id} user={u} onRevoke={revoke} isProtected={u.email === adminEmail} onEditProfile={async () => {
                const res = await fetch(`/api/admin/users/${u.id}`)
                setEditingProfile(await res.json())
              }} />)}
            </div>
          </div>
        )}
      </div>

      {/* ── Modale édition profil (admin) ── */}
      {editingProfile && (
        <AdminProfileModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSaved={updated => setEditingProfile(updated)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </AppShell>
  )
}

function SectionLabel({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

function InviteLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
      <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
      <button
        onClick={copy}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? 'rgba(34,197,94,0.15)' : 'var(--bg-card)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 10px', color: copied ? 'var(--green)' : 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copié !' : 'Copier'}
      </button>
    </div>
  )
}

function AdminProfileModal({ profile, onClose, onSaved }: { profile: UserProfile; onClose: () => void; onSaved: (updated: UserProfile) => void }) {
  const [firstName, setFirstName] = useState(profile.firstName ?? '')
  const [lastName, setLastName] = useState(profile.lastName ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || profile.email[0].toUpperCase()

  async function handleSave() {
    setSaving(true); setSaved(false)
    const res = await fetch(`/api/admin/users/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, bio }),
    })
    const updated = await res.json()
    setSaving(false); setSaved(true)
    onSaved({ ...profile, ...updated })
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const resized = await resizeImage(file, 400)
    // Convert to base64 data URL
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(resized)
    })
    await fetch(`/api/admin/users/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: dataUrl }),
    })
    setAvatarUrl(dataUrl)
    onSaved({ ...profile, avatarUrl: dataUrl })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleRemoveAvatar() {
    await fetch(`/api/admin/users/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: null }),
    })
    setAvatarUrl(null)
    onSaved({ ...profile, avatarUrl: null })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Profil utilisateur</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{profile.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)', borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 18, height: 18, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{(firstName || lastName) ? `${firstName} ${lastName}`.trim() : profile.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Camera size={11} /> {avatarUrl ? 'Changer' : 'Ajouter une photo'}
              </button>
              {avatarUrl && (
                <button onClick={handleRemoveAvatar} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                  <Trash2 size={10} /> Supprimer
                </button>
              )}
              <span style={{ padding: '2px 8px', borderRadius: 20, background: profile.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: profile.status === 'accepted' ? 'var(--green)' : 'var(--orange)', fontWeight: 600, fontSize: 11 }}>
                {profile.status === 'accepted' ? 'Actif' : 'En attente'}
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>PRÉNOM</label>
            <input
              value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="Jean"
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>NOM</label>
            <input
              value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Dupont"
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>DESCRIPTION</label>
          <textarea
            value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Quelques mots sur la pratique, les objectifs…"
            rows={3}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: saved ? 'var(--green)' : 'var(--accent)', color: saved ? '#fff' : 'var(--on-accent)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', transition: 'background 0.2s' }}
          >
            {saved ? <><Check size={13} /> Enregistré</> : <><Save size={13} /> {saving ? 'Sauvegarde…' : 'Enregistrer'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function UserRow({ user, onRevoke, isProtected, onEditProfile }: { user: InvitedUser; onRevoke: (id: string, email: string) => void; isProtected?: boolean; onEditProfile?: () => void }) {
  const accepted = user.status === 'accepted'
  const date = new Date(accepted && user.acceptedAt ? user.acceptedAt : user.invitedAt)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: accepted ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: accepted ? 'var(--green)' : 'var(--orange)' }}>
          {user.email[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {accepted ? `Actif depuis le ${date}` : `Invité le ${date}`}
          </div>
        </div>

        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: accepted ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: accepted ? 'var(--green)' : 'var(--orange)', border: `1px solid ${accepted ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
          {accepted ? 'Actif' : 'En attente'}
        </span>

        <button
          onClick={onEditProfile}
          title="Éditer le profil"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-dim)', borderRadius: 6, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <Pencil size={14} />
        </button>

        {!isProtected && (
          <button
            onClick={() => onRevoke(user.id, user.email)}
            title="Révoquer l'accès"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-dim)', borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Lien d'invitation pour les pending */}
      {!accepted && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <CopyLinkButton token={user.token} />
        </div>
      )}
    </div>
  )
}

async function resizeImage(file: File, maxSize: number): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg', 0.85
      )
    }
    img.src = URL.createObjectURL(file)
  })
}
