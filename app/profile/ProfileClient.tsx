'use client'
import { useState, useRef, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { Camera, Trash2, Save, Check } from 'lucide-react'

interface Profile {
  id: string; email: string
  firstName: string | null; lastName: string | null
  bio: string | null; avatarUrl: string | null
}

export default function ProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then((d: Profile) => {
      setProfile(d)
      setFirstName(d.firstName ?? '')
      setLastName(d.lastName ?? '')
      setBio(d.bio ?? '')
      setAvatarUrl(d.avatarUrl)
    })
  }, [])

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const resized = await resizeImage(file, 400)
    const fd = new FormData()
    fd.append('file', resized, file.name)
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
    const data = await res.json()
    setAvatarUrl(data.avatarUrl)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleRemoveAvatar() {
    await fetch('/api/profile/avatar', { method: 'DELETE' })
    setAvatarUrl(null)
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, bio }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!profile) {
    return (
      <AppShell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
          {[1, 2].map(i => <div key={i} style={{ height: 140, background: 'var(--bg-card)', borderRadius: 14, opacity: 0.5 }} />)}
        </div>
      </AppShell>
    )
  }

  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase()
    || profile.email[0].toUpperCase()

  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : profile.email

  return (
    <AppShell>
      <div style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="r-h1" style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Mon profil</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 15 }}>Informations personnelles</p>
        </div>

        {/* ── Avatar ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Photo */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 84, height: 84, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--bg-elevated)', border: '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 700, color: 'var(--accent)',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 22, height: 22, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{profile.email}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Camera size={13} /> {avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
          </div>
        </div>

        {/* ── Champs ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>PRÉNOM</label>
              <input
                value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="Jean"
                style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>NOM</label>
              <input
                value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Dupont"
                style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              value={profile.email} disabled
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-dim)', fontSize: 14, outline: 'none', cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>DESCRIPTION</label>
            <textarea
              value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Quelques mots sur ta pratique, tes objectifs…"
              rows={4}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* ── Sauvegarder ── */}
        <button
          onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: saved ? 'var(--green,#22c55e)' : 'var(--accent)', color: saved ? '#fff' : 'var(--on-accent)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer', transition: 'background 0.2s' }}
        >
          {saved
            ? <><Check size={15} /> Enregistré</>
            : <><Save size={15} /> {saving ? 'Sauvegarde…' : 'Enregistrer'}</>}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
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
