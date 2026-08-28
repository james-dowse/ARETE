'use client'
import { useState, useEffect } from 'react'
import { Save, Check } from 'lucide-react'

interface SiteContent {
  id: string
  key: string
  title: string | null
  body: string
  active: boolean
}

const LABELS: Record<string, { label: string; bodyMax: number; hint: string; noText?: boolean }> = {
  app_info: { label: 'App & méthode', bodyMax: 500, hint: "Description de l'appli / consignes générales (ex: variations force/endurance/pliométrie)." },
  announcement: { label: 'Annonces', bodyMax: 280, hint: 'Annonce courte — publier une nouvelle valeur crée une notification pour tous les utilisateurs.' },
  resources: { label: 'Ressources utiles', bodyMax: 0, noText: true, hint: "Widget de liens vers des articles sport/santé/nutrition sur le tableau de bord. Le contenu des liens se gère depuis la page Ressources — ce réglage n'affecte que sa visibilité sur l'accueil." },
}

function ContentForm({ content, onSaved }: { content: SiteContent; onSaved: (c: SiteContent) => void }) {
  const meta = LABELS[content.key] ?? { label: content.key, bodyMax: 500, hint: '' }
  const [title, setTitle] = useState(content.title ?? '')
  const [body, setBody] = useState(content.body)
  const [active, setActive] = useState(content.active)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    const res = await fetch(`/api/admin/content/${content.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, active }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erreur'); return }
    onSaved(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          Affiché sur la page d&apos;accueil
        </label>
      </div>
      {meta.hint && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>{meta.hint}</p>}

      {meta.noText && (
        <a href="/resources" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>Gérer les liens →</a>
      )}

      {!meta.noText && (
        <>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Titre</label>
            <input
              value={title}
              maxLength={60}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13.5 }}
            />
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4, textAlign: 'right' }}>{title.length}/60</div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Texte</label>
            <textarea
              value={body}
              maxLength={meta.bodyMax}
              onChange={e => setBody(e.target.value)}
              rows={5}
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ fontSize: 10.5, color: body.length > meta.bodyMax * 0.9 ? 'var(--gold)' : 'var(--text-dim)', marginTop: 4, textAlign: 'right' }}>{body.length}/{meta.bodyMax}</div>
          </div>
        </>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--crimson-bright, #c44)' }}>{error}</div>}

      <button
        onClick={save}
        disabled={saving}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: saved ? 'var(--green, #3a7)' : 'var(--gold)', color: '#1D1813', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saved ? <Check size={14} /> : <Save size={14} />}
        {saved ? 'Enregistré' : 'Enregistrer'}
      </button>
    </div>
  )
}

export default function ContentClient() {
  const [contents, setContents] = useState<SiteContent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/content').then(r => r.json()).then(data => { setContents(data); setLoading(false) })
  }, [])

  const onSaved = (updated: SiteContent) => {
    setContents(cs => cs.map(c => c.key === updated.key ? updated : c))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Contenus de la page d&apos;accueil</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          Ces encarts s&apos;affichent sur le tableau de bord, entre la séance du jour et les prochaines séances. Décochez « Affiché » pour les retirer sans perdre le texte.
        </p>
      </div>
      {contents.map(c => <ContentForm key={c.key} content={c} onSaved={onSaved} />)}
    </div>
  )
}
