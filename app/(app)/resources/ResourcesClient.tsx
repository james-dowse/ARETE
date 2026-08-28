'use client'
import { useState } from 'react'
import { Plus, ExternalLink, MoreVertical, X, Link2 } from 'lucide-react'

interface Resource {
  id: string
  title: string
  url: string
  source: string
  category: string
  order: number
  createdAt: string
}

const CATEGORIES: { value: string; label: string; color: string; border: string; bg: string }[] = [
  { value: 'sport', label: 'Sport', color: '#C96538', border: 'rgba(201,101,56,0.4)', bg: 'rgba(201,101,56,0.14)' },
  { value: 'sante', label: 'Santé', color: '#7BA88C', border: 'rgba(123,168,140,0.4)', bg: 'rgba(123,168,140,0.14)' },
  { value: 'nutrition', label: 'Nutrition', color: '#C9A535', border: 'rgba(201,165,53,0.4)', bg: 'rgba(201,165,53,0.14)' },
]

function catMeta(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[0]
}

function ResourceModal({ resource, onClose, onSaved }: { resource: Resource | null; onClose: () => void; onSaved: (r: Resource) => void }) {
  const [title, setTitle] = useState(resource?.title ?? '')
  const [url, setUrl] = useState(resource?.url ?? '')
  const [source, setSource] = useState(resource?.source ?? '')
  const [category, setCategory] = useState(resource?.category ?? 'sport')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim() || !url.trim() || !source.trim()) { setError('Titre, lien et source requis'); return }
    setSaving(true); setError(null)
    const res = await fetch(resource ? `/api/resources/${resource.id}` : '/api/resources', {
      method: resource ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, source, category }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erreur'); return }
    onSaved(data)
    onClose()
  }

  return (
    <div onClick={onClose} className="overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 420, padding: 24, boxShadow: 'var(--elev-3)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={16} color="var(--gold)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>{resource ? 'Modifier le lien' : 'Ajouter un lien'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Titre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '9px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13.5 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Lien (URL)</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={{ width: '100%', marginTop: 6, padding: '9px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13.5 }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Source</label>
            <input value={source} onChange={e => setSource(e.target.value)} placeholder="Nom du site" style={{ width: '100%', marginTop: 6, padding: '9px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13.5 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Catégorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '9px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13.5 }}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--crimson-bright)' }}>{error}</div>}

        <button onClick={save} disabled={saving} style={{ padding: '11px', background: 'var(--accent)', color: '#F8F4EC', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement…' : resource ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

export default function ResourcesClient({ initialResources, isAdmin }: { initialResources: Resource[]; isAdmin: boolean }) {
  const [resources, setResources] = useState(initialResources)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [modalResource, setModalResource] = useState<Resource | null | undefined>(undefined)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const filtered = catFilter ? resources.filter(r => r.category === catFilter) : resources

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce lien ?')) return
    setOpenMenuId(null)
    const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' })
    if (res.ok) setResources(rs => rs.filter(r => r.id !== id))
  }

  function handleSaved(r: Resource) {
    setResources(rs => rs.some(x => x.id === r.id) ? rs.map(x => x.id === r.id ? r : x) : [r, ...rs])
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="r-h1">Ressources utiles</h1>
          <p className="r-subtitle">Articles sport, santé et nutrition sélectionnés pour toi</p>
        </div>
        {isAdmin && (
          <button onClick={() => setModalResource(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: 'var(--accent)', color: '#F8F4EC', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={14} /> Ajouter un lien
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setCatFilter(null)}
          style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${catFilter === null ? 'var(--gold-border)' : 'var(--border)'}`, background: catFilter === null ? 'var(--gold-ghost)' : 'transparent', color: catFilter === null ? 'var(--gold)' : 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Tout
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCatFilter(catFilter === c.value ? null : c.value)}
            style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${catFilter === c.value ? c.border : 'var(--border)'}`, background: catFilter === c.value ? c.bg : 'transparent', color: catFilter === c.value ? c.color : 'var(--text-muted)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          Aucune ressource {catFilter ? `dans « ${catMeta(catFilter).label} »` : 'pour le moment'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((r, i) => {
            const cat = catMeta(r.category)
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--bg-card)', borderTop: i > 0 ? '1px solid var(--border)' : 'none', position: 'relative' }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: cat.bg, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Link2 size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', border: `1px solid ${cat.border}`, color: cat.color, borderRadius: 20, flexShrink: 0 }}>{cat.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.source}</span>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--border-plus)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none', flexShrink: 0 }}>
                  Ouvrir <ExternalLink size={11} />
                </a>
                {isAdmin && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', cursor: 'pointer' }}>
                      <MoreVertical size={15} />
                    </button>
                    {openMenuId === r.id && (
                      <div style={{ position: 'absolute', right: 0, top: 34, background: 'var(--bg-elevated)', border: '1px solid var(--border-plus)', borderRadius: 8, boxShadow: 'var(--elev-2)', zIndex: 10, minWidth: 120 }}>
                        <button onClick={() => { setModalResource(r); setOpenMenuId(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12.5, cursor: 'pointer' }}>Modifier</button>
                        <button onClick={() => handleDelete(r.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: 'var(--crimson-bright)', fontSize: 12.5, cursor: 'pointer' }}>Supprimer</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalResource !== undefined && (
        <ResourceModal resource={modalResource} onClose={() => setModalResource(undefined)} onSaved={handleSaved} />
      )}
    </div>
  )
}
