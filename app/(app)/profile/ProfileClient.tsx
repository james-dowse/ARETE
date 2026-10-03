'use client'
import { useState, useRef, useEffect } from 'react'
import { Camera, Trash2, Save, Check } from 'lucide-react'
import { useToast } from '@/components/Toast'

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
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [notLoggedIn, setNotLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(async r => {
      if (!r.ok) { setNotLoggedIn(true); return }
      const d: Profile = await r.json()
      if (!d?.id) { setNotLoggedIn(true); return }
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
    // La mousse dit l’accompli : ne la montrer que si le serveur a confirme.
    // Sans ce controle, un 500 ou une coupure reseau affichait « enregistre »
    // et la modification etait perdue en silence.
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, bio }),
    }).catch(() => null)
    setSaving(false)
    if (!res || !res.ok) { toast('Enregistrement impossible — reessaie.', 'error'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (notLoggedIn) {
    return (
      <>
        <div className="page-reading" style={{ textAlign: 'center', paddingTop: 64 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 className="r-h2" style={{ marginBottom: 8 }}>Connexion requise</h2>
          <p className="r-subtitle" style={{ marginBottom: 24 }}>
            Tu dois être connecté pour accéder à ton profil.
          </p>
          <a
            href="/login?redirect=/profile"
            className="btn btn-md"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', textDecoration: 'none' }}
          >
            Se connecter
          </a>
        </div>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <div className="page-reading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2].map(i => <div key={i} className="card" style={{ height: 140, opacity: 0.5 }} />)}
        </div>
      </>
    )
  }

  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase()
    || profile.email[0].toUpperCase()

  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : profile.email

  return (
    <>
      <div className="page-reading">
        <header style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="t-micro" style={{ marginBottom: 6 }}>COMPTE</div>
          <h1 className="r-h1">Mon profil</h1>
          <p className="r-subtitle">Informations personnelles</p>
        </header>

        {/* ── Avatar ── */}
        <div className="card" style={{ padding: 'var(--sp-6)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
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
            <div className="t-lg" style={{ marginBottom: 4 }}>{displayName}</div>
            <div className="t-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{profile.email}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn btn-sm"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                <Camera size={13} /> {avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="btn btn-sm btn-ghost"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
          </div>
        </div>

        {/* ── Champs ── */}
        <div className="card" style={{ padding: 'var(--sp-6)', marginBottom: 'var(--sp-5)' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>PRÉNOM</label>
              <input
                className="input" value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="Jean"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="t-micro" style={{ display: 'block', marginBottom: 6 }}>NOM</label>
              <input
                className="input" value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Dupont"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="t-micro" style={{ display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              className="input" value={profile.email} disabled
              style={{ width: '100%', color: 'var(--text-dim)', cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label className="t-micro" style={{ display: 'block', marginBottom: 6 }}>DESCRIPTION</label>
            <textarea
              className="input" value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Quelques mots sur ta pratique, tes objectifs…"
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* ── Sauvegarder ── */}
        {/* Les trois boutons d'action de cet ecran (se connecter, photo, enregistrer)
            prennent de .btn la structure — hauteur, rayon, graisse, transitions — et
            gardent leur fond en ligne : .btn-primary est or, et la charte reserve l'or
            a la marque et a la progression, jamais a une action. Ici la couleur dit
            aussi un etat : terracotta pour agir, mousse pour l'accompli. */}
        <button
          onClick={handleSave} disabled={saving}
          className="btn btn-md"
          style={{ background: saved ? 'var(--green)' : 'var(--accent)', color: saved ? '#fff' : 'var(--on-accent)', cursor: saving ? 'wait' : 'pointer' }}
        >
          {saved
            ? <><Check size={15} /> Enregistré</>
            : <><Save size={15} /> {saving ? 'Sauvegarde…' : 'Enregistrer'}</>}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
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
