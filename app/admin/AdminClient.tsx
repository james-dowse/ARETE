'use client'
import { BIO_TYPES, COMPLEXITIES, EQUIPMENT_TYPES, EQUIPMENT_ICONS, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS } from '@/lib/types'
import { useAttributes, invalidateAttributesCache, type AttributeOption } from '@/lib/useAttributes'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search, Trash2, Pencil, X, Check, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown, Upload, Download, CheckSquare, Copy, BarChart2 } from 'lucide-react'

interface Movement {
  id: string; name: string; bioType: string; complexity: string; equipment?: string | null
  description?: string | null; imageUrl?: string | null; videoUrl?: string | null
}

interface UsageWorkout {
  id: string; name: string; createdAt: string; duration?: number | null
  user?: { firstName: string | null; lastName: string | null; email: string } | null
  _count: { movements: number }
}

type SortKey = 'id' | 'name' | 'bioType' | 'complexity'
type SortDir = 'asc' | 'desc'

// ─── Inline cell editor ───────────────────────────────────────────────────────
function EditableCell({
  value, type = 'text', options, autoFocus = false,
  onChange, onKeyDown,
}: {
  value: string; type?: string; options?: string[]; autoFocus?: boolean
  onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  if (options) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
        style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    )
  }
  return (
    <input autoFocus={autoFocus} value={value} type={type} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
      style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
  )
}

// ─── New Movement Form (modal) ────────────────────────────────────────────────
function NewMovementModal({
  onSave, onClose,
}: {
  onSave: (m: Movement) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ id: '', name: '', bioType: BIO_TYPES[0], complexity: COMPLEXITIES[0], equipment: '', description: '', videoUrl: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.id.trim() || !form.name.trim()) { setError('ID et Nom sont obligatoires'); return }
    setSaving(true)
    const res = await fetch('/api/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Erreur inconnue')
      setSaving(false)
      return
    }
    const created = await res.json()
    onSave(created)
    onClose()
  }

  const fieldStyle = {
    width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  }
  const labelStyle = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)' }} />
      <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', width: 500, maxWidth: 'calc(100vw - 32px)', padding: '24px', boxShadow: 'var(--elev-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nouveau mouvement</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>ID *</label>
            <input value={form.id} onChange={e => set('id', e.target.value)} placeholder="ex: 99.1" required style={fieldStyle} />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>Format : numéro.variante</div>
          </div>
          <div>
            <label style={labelStyle}>NOM *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Bulgarian Split Squat" required style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>TYPE BIOMÉCANIQUE *</label>
            <select value={form.bioType} onChange={e => set('bioType', e.target.value)} style={fieldStyle}>
              {BIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>COMPLEXITÉ *</label>
            <select value={form.complexity} onChange={e => set('complexity', e.target.value)} style={fieldStyle}>
              {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>ÉQUIPEMENT</label>
            <select value={form.equipment} onChange={e => set('equipment', e.target.value)} style={fieldStyle}>
              <option value="">—</option>
              {EQUIPMENT_TYPES.map(eq => <option key={eq} value={eq}>{EQUIPMENT_ICONS[eq]} {eq}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>DESCRIPTION</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Description optionnelle..." style={{ ...fieldStyle, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>URL VIDÉO</label>
          <input value={form.videoUrl} onChange={e => set('videoUrl', e.target.value)} placeholder="https://..." type="url" style={fieldStyle} />
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: 'var(--red)' }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          <button type="submit" disabled={saving} style={{ padding: '9px 22px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--on-accent)', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────
function DeleteConfirm({ movement, onConfirm, onCancel }: { movement: Movement; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px 28px', width: 380, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--elev-3)', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Supprimer ce mouvement ?</div>
        <div style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 4 }}>{movement.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>Cette action est irréversible.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: '8px 20px', background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Supprimer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Sort header ──────────────────────────────────────────────────────────────
function SortTh({ label, field, sort, onSort }: { label: string; field: SortKey; sort: { key: SortKey; dir: SortDir }; onSort: (k: SortKey) => void }) {
  const active = sort.key === field
  return (
    <th onClick={() => onSort(field)} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active ? (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  )
}

// ─── Référentiels — one category section ──────────────────────────────────────
function AttributeSection({
  title, category, items, hasIcon, hasColor, onReload,
}: {
  title: string
  category: string
  items: AttributeOption[]
  hasIcon?: boolean
  hasColor?: boolean
  onReload: () => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBuf, setEditBuf] = useState<{ value: string; icon: string; color: string }>({ value: '', icon: '', color: '' })
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState({ value: '', icon: '', color: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const startEdit = (o: AttributeOption) => {
    setEditingId(o.id)
    setEditBuf({ value: o.value, icon: o.icon ?? '', color: o.color ?? '' })
    setError('')
  }
  const cancelEdit = () => { setEditingId(null); setEditBuf({ value: '', icon: '', color: '' }) }

  const commitEdit = async (id: string) => {
    setSaving(true)
    const body: Record<string, string | null> = { value: editBuf.value.trim() }
    if (hasIcon) body.icon = editBuf.icon.trim() || null
    if (hasColor) body.color = editBuf.color.trim() || null
    const res = await fetch(`/api/attributes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { setEditingId(null); await onReload() } else { const d = await res.json(); setError(d.error || 'Erreur') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette valeur ?')) return
    const res = await fetch(`/api/attributes/${id}`, { method: 'DELETE' })
    if (res.ok) { await onReload() } else { const d = await res.json(); setError(d.error || 'Erreur') }
  }

  const handleMove = async (opt: AttributeOption, idx: number, dir: 'up' | 'down') => {
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= items.length) return
    const swap = items[swapIdx]
    await Promise.all([
      fetch(`/api/attributes/${opt.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: swap.position }) }),
      fetch(`/api/attributes/${swap.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: opt.position }) }),
    ])
    await onReload()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.value.trim()) return
    setAdding(true)
    const body: Record<string, string | null> = { category, value: addForm.value.trim() }
    if (hasIcon) body.icon = addForm.icon.trim() || null
    if (hasColor) body.color = addForm.color.trim() || null
    const res = await fetch('/api/attributes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setAdding(false)
    if (res.ok) { setAddForm({ value: '', icon: '', color: '' }); await onReload() } else { const d = await res.json(); setError(d.error || 'Erreur') }
  }

  const inp = (v: string, onChange: (x: string) => void, placeholder: string, width?: number) => (
    <input value={v} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: width ?? 'auto', minWidth: 0 }} />
  )

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>{items.length}</span>
      </div>

      {error && (
        <div style={{ margin: '8px 12px 0', padding: '6px 10px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 7, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={12} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={11} /></button>
        </div>
      )}

      <div>
        {items.map((opt, idx) => (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', minHeight: 42 }}>
            {editingId === opt.id ? (
              <>
                {inp(editBuf.value, v => setEditBuf(b => ({ ...b, value: v })), 'Valeur', 120)}
                {hasIcon && inp(editBuf.icon, v => setEditBuf(b => ({ ...b, icon: v })), 'Icône', 56)}
                {hasColor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="color" value={editBuf.color || '#888888'} onChange={e => setEditBuf(b => ({ ...b, color: e.target.value }))}
                      style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', background: 'none' }} />
                    <button onClick={() => setEditBuf(b => ({ ...b, color: '' }))} title="Effacer couleur"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}><X size={10} /></button>
                  </div>
                )}
                <button onClick={() => commitEdit(opt.id)} disabled={saving} title="Sauvegarder"
                  style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 6, background: 'var(--dirty,rgba(200,169,81,0.15))', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} />
                </button>
                <button onClick={cancelEdit} title="Annuler"
                  style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                {opt.icon && <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>}
                {opt.color && <span style={{ width: 10, height: 10, borderRadius: '50%', background: opt.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }} />}
                <span style={{ fontSize: 13, flex: 1, color: opt.color || 'var(--text-primary)' }}>{opt.value}</span>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => handleMove(opt, idx, 'up')} disabled={idx === 0} title="Monter"
                    style={{ width: 22, height: 22, borderRadius: 5, background: 'none', border: 'none', color: idx === 0 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}>
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => handleMove(opt, idx, 'down')} disabled={idx === items.length - 1} title="Descendre"
                    style={{ width: 22, height: 22, borderRadius: 5, background: 'none', border: 'none', color: idx === items.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: idx === items.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === items.length - 1 ? 0.3 : 1 }}>
                    <ChevronDown size={12} />
                  </button>
                </div>
                <div className="attr-row-actions" style={{ display: 'flex', gap: 4, opacity: 0 }}>
                  <button onClick={() => startEdit(opt)} title="Modifier"
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => handleDelete(opt.id)} title="Supprimer"
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.04)', alignItems: 'center', flexWrap: 'wrap' }}>
        {inp(addForm.value, v => setAddForm(f => ({ ...f, value: v })), 'Nouvelle valeur…', 120)}
        {hasIcon && inp(addForm.icon, v => setAddForm(f => ({ ...f, icon: v })), 'Icône', 56)}
        {hasColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="color" value={addForm.color || '#888888'} onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
              style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', background: 'none' }} />
            <button type="button" onClick={() => setAddForm(f => ({ ...f, color: '' }))} title="Pas de couleur"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}><X size={10} /></button>
          </div>
        )}
        <button type="submit" disabled={adding || !addForm.value.trim()}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'var(--on-accent)', fontSize: 12, fontWeight: 700, cursor: adding ? 'wait' : 'pointer', opacity: adding ? 0.7 : 1, flexShrink: 0 }}>
          <Plus size={12} /> Ajouter
        </button>
      </form>
    </div>
  )
}

// ─── Référentiels tab ─────────────────────────────────────────────────────────
function AttributesTab() {
  const { bioTypes, complexities, equipments, loading, error, reload } = useAttributes()

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: 200, background: 'var(--bg-card)', borderRadius: 12, opacity: 0.5 }} />)}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Référentiels</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
          Valeurs possibles pour les types biomécaniques, complexités et équipements.
        </p>
      </div>
      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <AttributeSection
          title="Types Biomécaniques"
          category="bioType"
          items={bioTypes}
          hasIcon
          hasColor
          onReload={reload}
        />
        <AttributeSection
          title="Complexités"
          category="complexity"
          items={complexities}
          hasColor
          onReload={reload}
        />
        <AttributeSection
          title="Équipements"
          category="equipment"
          items={equipments}
          hasIcon
          onReload={reload}
        />
      </div>
      <style>{`
        div:hover .attr-row-actions { opacity: 1 !important; }
        .attr-row-actions { transition: opacity 0.15s; }
      `}</style>
    </div>
  )
}

// ─── Doublons tab ────────────────────────────────────────────────────────────
function DuplicatesTab() {
  const [data, setData] = useState<{ key: string; group: { id: string; name: string; bioType: string }[] }[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/duplicates')
      .then(r => r.json())
      .then(d => { setData(d.duplicates ?? []); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Doublons</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
          Mouvements dont le nom normalisé est identique (casse, accents, ponctuation ignorés).
        </p>
      </div>
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 80, background: 'var(--bg-card)', borderRadius: 10, opacity: 0.5 }} />)}
        </div>
      )}
      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
      {data && data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <Copy size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>Aucun doublon détecté</div>
          <div style={{ fontSize: 13 }}>Tous les mouvements ont un nom unique.</div>
        </div>
      )}
      {data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map(({ key, group }) => (
            <div key={key} style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Copy size={12} color="var(--red)" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {group.length} entrées · clé : «{key}»
                </span>
              </div>
              {group.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', gap: 12, padding: '9px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)', minWidth: 48 }}>{m.id}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)', padding: '2px 8px', borderRadius: 10, background: `${BIO_TYPE_COLORS[m.bioType]}15` }}>{BIO_TYPE_ICONS[m.bioType]} {m.bioType}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Admin Workouts tab ───────────────────────────────────────────────────────
interface AdminWorkout {
  id: string
  name: string
  createdAt: string
  duration?: number | null
  tags?: string | null
  isPublic?: boolean
  user?: { id: string; email: string; firstName: string | null; lastName: string | null } | null
  _count: { movements: number; savedBy: number }
}

function WorkoutsAdminTab() {
  const [workouts, setWorkouts] = useState<AdminWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/workouts')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) { setFetchError(d.error ?? `HTTP ${r.status}`); setLoading(false); return }
        setWorkouts(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(e => { setFetchError(String(e)); setLoading(false) })
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800) }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/workouts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setWorkouts(prev => prev.filter(w => w.id !== id))
      showToast('Workout supprimé ✓')
    }
    setDeletingId(null)
  }

  const filtered = workouts.filter(w =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.email.toLowerCase().includes(search.toLowerCase()) ||
    `${w.user?.firstName ?? ''} ${w.user?.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const deletingWorkout = workouts.find(w => w.id === deletingId)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Workouts communauté</h2>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
            {loading ? '…' : `${filtered.length} / ${workouts.length} workouts`} — tous utilisateurs confondus.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 12px', width: 280, flexShrink: 0 }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou utilisateur…"
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} color="var(--text-muted)" /></button>}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: 58, background: 'var(--bg-card)', borderRadius: 10, opacity: 0.4 }} />)}
        </div>
      )}

      {fetchError && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 10, fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
          <AlertTriangle size={15} />
          <span style={{ flex: 1 }}><b>Erreur :</b> {fetchError}</span>
        </div>
      )}

      {!loading && !fetchError && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>Aucun workout trouvé</div>
      )}

      {!loading && !fetchError && filtered.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-muted)' }}>NOM</th>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-muted)' }}>AUTEUR</th>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-muted)' }}>DATE</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-muted)' }}>MOUV.</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-muted)' }}>SAUV.</th>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-muted)' }}>TAGS</th>
                <th style={{ padding: '9px 12px', width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const author = w.user
                  ? ((w.user.firstName || w.user.lastName)
                    ? `${w.user.firstName ?? ''} ${w.user.lastName ?? ''}`.trim()
                    : w.user.email.split('@')[0])
                  : '—'
                const dateStr = new Date(w.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
                const tags = w.tags ? w.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                return (
                  <tr key={w.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }} className="admin-wod-row">
                    <td style={{ padding: '11px 14px' }}>
                      <a href={`/workouts/${w.id}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)' }}>
                        {w.name}
                      </a>
                      {w.duration && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>{w.duration} min</span>}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{author}</td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{w._count.movements}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                      {w._count.savedBy > 0 ? <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{w._count.savedBy}</span> : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', maxWidth: 180 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(200,169,81,0.1)', color: 'var(--gold)', border: '1px solid rgba(200,169,81,0.2)' }}>#{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '11px 10px', textAlign: 'right' }}>
                      <button
                        onClick={() => setDeletingId(w.id)}
                        title="Supprimer ce workout"
                        style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
                        className="admin-wod-del"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}>
            {filtered.length} workout{filtered.length > 1 ? 's' : ''} — cliquer le nom pour ouvrir dans un nouvel onglet
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingWorkout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeletingId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px 28px', width: 400, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--elev-3)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Supprimer ce workout ?</div>
            <div style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 4, fontWeight: 600 }}>{deletingWorkout.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              par {deletingWorkout.user?.email ?? '—'} · {deletingWorkout._count.movements} mouvements
            </div>
            {deletingWorkout._count.savedBy > 0 && (
              <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 4 }}>
                ⚠ Sauvegardé par {deletingWorkout._count.savedBy} utilisateur{deletingWorkout._count.savedBy > 1 ? 's' : ''}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 22 }}>Cette action est irréversible.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeletingId(null)} style={{ padding: '8px 20px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => handleDelete(deletingWorkout.id)} style={{ padding: '8px 20px', background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      <style>{`
        .admin-wod-row:hover .admin-wod-del { opacity: 1 !important; transition: opacity 0.15s; }
        .admin-wod-del { transition: opacity 0.15s; }
        .admin-wod-del:hover { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.3) !important; color: var(--red) !important; }
      `}</style>
    </div>
  )
}

// ─── Stats tab ────────────────────────────────────────────────────────────────
interface StatsData {
  totals: { users: number; workouts: number; movements: number; saved: number; favorites: number }
  topMovements: { movement: { id: string; name: string; bioType: string }; count: number }[]
  workoutsByUser: { email: string; count: number }[]
}

function StatsTab() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1,2,3].map(i => <div key={i} style={{ height: 120, background: 'var(--bg-card)', borderRadius: 12, opacity: 0.5 }} />)}
    </div>
  )
  if (error) return <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>
  if (!data) return null

  const { totals, topMovements, workoutsByUser } = data
  const maxMov = topMovements[0]?.count ?? 1
  const maxUser = workoutsByUser[0]?.count ?? 1

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Statistiques</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>Données agrégées tous utilisateurs confondus.</p>
      </div>

      {/* Totaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Utilisateurs', value: totals.users },
          { label: 'Workouts', value: totals.workouts },
          { label: 'Mouvements', value: totals.movements },
          { label: 'Sauvegardés', value: totals.saved },
          { label: 'Favoris', value: totals.favorites },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top mouvements */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Top 10 mouvements</span>
          </div>
          <div>
            {topMovements.map((m, i) => (
              <div key={m.movement.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 18, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.movement.name}</div>
                  <div style={{ fontSize: 10, color: BIO_TYPE_COLORS[m.movement.bioType] || 'var(--text-dim)' }}>{m.movement.bioType}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--gold)', width: `${Math.round((m.count / maxMov) * 60)}px`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', minWidth: 20 }}>{m.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workouts par user */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Workouts par utilisateur</span>
          </div>
          <div>
            {workoutsByUser.map((u, i) => (
              <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 18, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--accent)', width: `${Math.round((u.count / maxUser) * 60)}px`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20 }}>{u.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminClient({
  initialMovements, usageMap,
}: {
  initialMovements: Movement[]
  usageMap: Record<string, number>
}) {
  const [activeTab, setActiveTab] = useState<'mouvements' | 'referentiels' | 'doublons' | 'stats' | 'workouts'>('mouvements')
  const [movements, setMovements] = useState<Movement[]>(initialMovements)
  const [search, setSearch] = useState('')
  const [bioFilter, setBioFilter] = useState('')
  const [complexityFilter, setComplexityFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBuf, setEditBuf] = useState<Partial<Movement>>({})
  const [saving, setSaving] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // ── Usage panel ──
  const [usagePanel, setUsagePanel] = useState<{ id: string; name: string; workouts: UsageWorkout[] } | null>(null)
  const [usagePanelLoading, setUsagePanelLoading] = useState(false)

  const openUsagePanel = async (m: Movement) => {
    setUsagePanel({ id: m.id, name: m.name, workouts: [] })
    setUsagePanelLoading(true)
    const res = await fetch(`/api/movements/${encodeURIComponent(m.id)}/workouts`)
    const data = await res.json()
    setUsagePanel({ id: m.id, name: m.name, workouts: data })
    setUsagePanelLoading(false)
  }

  // ── Bulk selection state ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [pendingBulkUpdate, setPendingBulkUpdate] = useState<{ bioType?: string; complexity?: string; equipment?: string } | null>(null)
  const [stagedBioType, setStagedBioType] = useState('')
  const [stagedComplexity, setStagedComplexity] = useState('')
  const [stagedEquipment, setStagedEquipment] = useState('')
  const selectAllRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800) }

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    let list = movements
    if (search) list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    if (bioFilter) list = list.filter(m => m.bioType === bioFilter)
    if (complexityFilter) list = list.filter(m => m.complexity === complexityFilter)
    if (equipmentFilter) list = list.filter(m => m.equipment === equipmentFilter)
    return [...list].sort((a: Movement, b: Movement) => {
      const va = a[sort.key] ?? ''; const vb = b[sort.key] ?? ''
      return sort.dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }, [movements, search, bioFilter, complexityFilter, equipmentFilter, sort])

  const toggleSort = (key: SortKey) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  // ── Bulk selection helpers ──
  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id))
  const someSelected = filtered.some(m => selected.has(m.id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allFilteredSelected
    }
  }, [someSelected, allFilteredSelected])

  const toggleOne = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(m => n.delete(m.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(m => n.add(m.id)); return n })
    }
  }
  const clearSelection = () => setSelected(new Set())

  const handleBulkUpdate = async (patch: { bioType?: string; complexity?: string; equipment?: string }) => {
    if (selected.size === 0) return
    setBulkWorking(true)
    const ids = [...selected]
    const res = await fetch('/api/movements/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...patch }),
    })
    const data = await res.json()
    if (res.ok && data.updated) {
      const updMap: Record<string, Movement> = {}
      data.updated.forEach((m: Movement) => { updMap[m.id] = m })
      setMovements(prev => prev.map(m => updMap[m.id] ?? m))
      showToast(`${ids.length} mouvement${ids.length > 1 ? 's' : ''} mis à jour ✓`)
      clearSelection()
    }
    setBulkWorking(false)
  }

  const handleBulkDelete = async () => {
    setBulkWorking(true)
    const ids = [...selected]
    const res = await fetch('/api/movements/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json()
    if (res.ok) {
      const deletedSet = new Set(ids.filter((id: string) => !data.skippedIds?.includes(id)))
      setMovements(prev => prev.filter(m => !deletedSet.has(m.id)))
      const msg = data.skipped > 0
        ? `${data.deleted} supprimé${data.deleted > 1 ? 's' : ''} · ${data.skipped} ignoré${data.skipped > 1 ? 's' : ''} (utilisés dans des workouts)`
        : `${data.deleted} mouvement${data.deleted > 1 ? 's' : ''} supprimé${data.deleted > 1 ? 's' : ''} ✓`
      showToast(msg)
      clearSelection()
    }
    setBulkWorking(false)
    setShowBulkDeleteConfirm(false)
  }

  // ── Edit ──
  const startEdit = (m: Movement) => { setEditingId(m.id); setEditBuf({ name: m.name, bioType: m.bioType, complexity: m.complexity, equipment: m.equipment ?? '', description: m.description ?? '', videoUrl: m.videoUrl ?? '' }) }
  const cancelEdit = () => { setEditingId(null); setEditBuf({}) }

  const commitEdit = async (id: string) => {
    setSaving(true)
    const res = await fetch(`/api/movements/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editBuf),
    })
    if (res.ok) {
      const updated = await res.json()
      setMovements(prev => prev.map(m => m.id === id ? updated : m))
      showToast('Mouvement mis à jour ✓')
    }
    setSaving(false)
    setEditingId(null)
    setEditBuf({})
  }

  const handleEditKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') commitEdit(id)
    if (e.key === 'Escape') cancelEdit()
  }

  // ── Delete ──
  const confirmDelete = async (id: string) => {
    setDeleteError(null)
    const res = await fetch(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      setMovements(prev => prev.filter(m => m.id !== id))
      showToast('Mouvement supprimé')
    } else {
      const d = await res.json()
      setDeleteError(d.error)
    }
    setDeletingId(null)
  }

  // ── Import XLS ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/movements/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { showToast(`Erreur : ${data.error}`); return }
      const freshRes = await fetch('/api/movements')
      const freshData = await freshRes.json()
      if (Array.isArray(freshData)) setMovements(freshData)
      showToast(`Import terminé — ${data.imported} ajoutés/mis à jour, ${data.skipped} ignorés`)
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  // ── New ──
  const handleCreated = (m: Movement) => {
    setMovements(prev => [...prev, m].sort((a, b) => a.bioType.localeCompare(b.bioType) || a.name.localeCompare(b.name)))
    showToast(`"${m.name}" créé ✓`)
  }

  // Stats
  const bioStats = BIO_TYPES.map(bt => ({ bt, count: movements.filter(m => m.bioType === bt).length }))

  return (
    <div style={{ maxWidth: 1200, paddingRight: activeTab === 'mouvements' && usagePanel ? 364 : 0, transition: 'padding-right 0.2s' }}>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28, gap: 0 }}>
        {([
          { key: 'mouvements' as const, label: 'Mouvements', icon: null },
          { key: 'referentiels' as const, label: 'Référentiels', icon: null },
          { key: 'doublons' as const, label: 'Doublons', icon: <Copy size={13} /> },
          { key: 'stats' as const, label: 'Stats', icon: <BarChart2 size={13} /> },
          { key: 'workouts' as const, label: 'Workouts', icon: null },
        ]).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === key ? 700 : 500,
              fontSize: 14, cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Mouvements tab ── */}
      {activeTab === 'mouvements' && (<>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Administration</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14 }}>
              {movements.length} mouvements · {filtered.length} affichés
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
            <a href="/api/movements/export" download
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
              <Download size={15} /> Exporter XLS
            </a>
            <button onClick={() => importRef.current?.click()} disabled={importing}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.6 : 1 }}>
              <Upload size={15} /> {importing ? 'Import...' : 'Importer XLS'}
            </button>
            <button onClick={() => setShowNew(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              <Plus size={16} /> Nouveau mouvement
            </button>
          </div>
        </div>

        {/* Mini stats bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {bioStats.map(({ bt, count }) => (
            <button key={bt} onClick={() => setBioFilter(bioFilter === bt ? '' : bt)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `1px solid ${bioFilter === bt ? BIO_TYPE_COLORS[bt] : 'var(--border)'}`, background: bioFilter === bt ? `${BIO_TYPE_COLORS[bt]}18` : 'var(--bg-card)', color: bioFilter === bt ? BIO_TYPE_COLORS[bt] : 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              {BIO_TYPE_ICONS[bt]} {bt}
              <span style={{ fontWeight: 700, color: BIO_TYPE_COLORS[bt] }}>{count}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 12px', flex: '0 0 260px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou ID..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} color="var(--text-muted)" /></button>}
          </div>
          <select value={complexityFilter} onChange={e => setComplexityFilter(e.target.value)}
            style={{ padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, color: complexityFilter ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            <option value="">Tous niveaux</option>
            {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={equipmentFilter} onChange={e => setEquipmentFilter(e.target.value)}
            style={{ padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, color: equipmentFilter ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            <option value="">Tout équipement</option>
            {EQUIPMENT_TYPES.map(eq => <option key={eq} value={eq}>{EQUIPMENT_ICONS[eq]} {eq}</option>)}
          </select>
          {(search || bioFilter || complexityFilter || equipmentFilter) && (
            <button onClick={() => { setSearch(''); setBioFilter(''); setComplexityFilter(''); setEquipmentFilter('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>

        {/* ── Bulk action bar ── */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 16px', background: 'rgba(200,169,81,0.08)', border: '1px solid rgba(200,169,81,0.25)', borderRadius: 10, flexWrap: 'wrap' }}>
            <CheckSquare size={15} color="var(--gold)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginRight: 4 }}>
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <button onClick={clearSelection} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              Désélectionner
            </button>

            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

            {/* BioType */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>TYPE</span>
              <select
                value={stagedBioType}
                onChange={e => setStagedBioType(e.target.value)}
                disabled={bulkWorking}
                style={{ padding: '4px 8px', background: 'var(--bg-elevated)', border: `1px solid ${stagedBioType ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 7, color: stagedBioType ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Changer…</option>
                {BIO_TYPES.map(bt => <option key={bt} value={bt}>{BIO_TYPE_ICONS[bt]} {bt}</option>)}
              </select>
            </div>

            {/* Complexity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>COMPLEXITÉ</span>
              <select
                value={stagedComplexity}
                onChange={e => setStagedComplexity(e.target.value)}
                disabled={bulkWorking}
                style={{ padding: '4px 8px', background: 'var(--bg-elevated)', border: `1px solid ${stagedComplexity ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 7, color: stagedComplexity ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Changer…</option>
                {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Equipment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>ÉQUIPEMENT</span>
              <select
                value={stagedEquipment}
                onChange={e => setStagedEquipment(e.target.value)}
                disabled={bulkWorking}
                style={{ padding: '4px 8px', background: 'var(--bg-elevated)', border: `1px solid ${stagedEquipment ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 7, color: stagedEquipment ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Changer…</option>
                <option value="__clear__">— Effacer —</option>
                {EQUIPMENT_TYPES.map(eq => <option key={eq} value={eq}>{EQUIPMENT_ICONS[eq]} {eq}</option>)}
              </select>
            </div>

            {/* Single apply button */}
            {(stagedBioType || stagedComplexity || stagedEquipment) && (
              <button
                onClick={() => setPendingBulkUpdate({ bioType: stagedBioType || undefined, complexity: stagedComplexity || undefined, equipment: stagedEquipment === '__clear__' ? '' : (stagedEquipment || undefined) })}
                style={{ padding: '5px 12px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Appliquer
              </button>
            )}

            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkWorking}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <Trash2 size={12} /> Supprimer
            </button>

            {bulkWorking && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>En cours…</span>}
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  <th style={{ padding: '10px 8px 10px 14px', width: 36 }}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      title={allFilteredSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
                    />
                  </th>
                  <SortTh label="ID" field="id" sort={sort} onSort={toggleSort} />
                  <SortTh label="NOM" field="name" sort={sort} onSort={toggleSort} />
                  <SortTh label="TYPE" field="bioType" sort={sort} onSort={toggleSort} />
                  <SortTh label="COMPLEXITÉ" field="complexity" sort={sort} onSort={toggleSort} />
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--text-muted)' }}>ÉQUIPEMENT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--text-muted)' }}>DESCRIPTION</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--text-muted)' }}>VIDÉO</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--text-muted)' }}>USAGES</th>
                  <th style={{ padding: '10px 12px', width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const isEditing = editingId === m.id
                  const usage = usageMap[m.id] || 0
                  const rowBg = isEditing ? 'var(--dirty)' : idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.025)'
                  return (
                    <tr key={m.id} onDoubleClick={() => { if (!isEditing) startEdit(m) }} style={{ borderBottom: '1px solid var(--border)', background: selected.has(m.id) ? 'rgba(200,169,81,0.06)' : rowBg, transition: 'background 0.1s', cursor: isEditing ? 'default' : 'pointer' }}>
                      {/* Checkbox */}
                      <td style={{ padding: '8px 8px 8px 14px' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggleOne(m.id)}
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
                        />
                      </td>
                      {/* ID */}
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: 12, whiteSpace: 'nowrap' }}>{m.id}</td>

                      {/* Name */}
                      <td style={{ padding: '8px 12px', minWidth: 200 }}>
                        {isEditing
                          ? <EditableCell autoFocus value={editBuf.name ?? ''} onChange={v => setEditBuf(b => ({ ...b, name: v }))} onKeyDown={e => handleEditKey(e, m.id)} />
                          : <span style={{ fontWeight: 600 }}>{m.name}</span>}
                      </td>

                      {/* BioType */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {isEditing
                          ? <EditableCell value={editBuf.bioType ?? ''} options={BIO_TYPES} onChange={v => setEditBuf(b => ({ ...b, bioType: v }))} onKeyDown={e => handleEditKey(e, m.id)} />
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)', fontSize: 12 }}>
                              {BIO_TYPE_ICONS[m.bioType]} {m.bioType}
                            </span>}
                      </td>

                      {/* Complexity */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {isEditing
                          ? <EditableCell value={editBuf.complexity ?? ''} options={COMPLEXITIES} onChange={v => setEditBuf(b => ({ ...b, complexity: v }))} onKeyDown={e => handleEditKey(e, m.id)} />
                          : <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: `${COMPLEXITY_COLORS[m.complexity] || '#fff'}18`, color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>
                              {m.complexity}
                            </span>}
                      </td>

                      {/* Equipment */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {isEditing
                          ? <EditableCell value={editBuf.equipment ?? ''} options={['', ...EQUIPMENT_TYPES]} onChange={v => setEditBuf(b => ({ ...b, equipment: v }))} onKeyDown={e => handleEditKey(e, m.id)} />
                          : m.equipment
                            ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{EQUIPMENT_ICONS[m.equipment] || '🔧'} {m.equipment}</span>
                            : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Description */}
                      <td style={{ padding: '8px 12px', maxWidth: 200 }}>
                        {isEditing
                          ? <EditableCell value={editBuf.description ?? ''} onChange={v => setEditBuf(b => ({ ...b, description: v }))} onKeyDown={e => handleEditKey(e, m.id)} />
                          : <span style={{ color: 'var(--text-muted)', fontSize: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.description || <span style={{ color: 'var(--text-dim)' }}>—</span>}</span>}
                      </td>

                      {/* Video */}
                      <td style={{ padding: '8px 12px', maxWidth: 160 }}>
                        {isEditing
                          ? <EditableCell value={editBuf.videoUrl ?? ''} onChange={v => setEditBuf(b => ({ ...b, videoUrl: v }))} onKeyDown={e => handleEditKey(e, m.id)} />
                          : m.videoUrl
                            ? <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 12 }}>▶ Voir</a>
                            : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Usage */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {usage > 0 ? (
                          <button
                            onClick={() => openUsagePanel(m)}
                            title="Voir les workouts"
                            style={{ fontSize: 12, fontWeight: 700, color: usagePanel?.id === m.id ? 'var(--gold)' : 'var(--blue)', background: usagePanel?.id === m.id ? 'rgba(200,169,81,0.12)' : 'rgba(96,165,250,0.08)', border: `1px solid ${usagePanel?.id === m.id ? 'rgba(200,169,81,0.3)' : 'rgba(96,165,250,0.2)'}`, borderRadius: 6, padding: '2px 9px', cursor: 'pointer', transition: 'all 0.15s' }}
                          >
                            {usage}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '8px 10px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => commitEdit(m.id)} disabled={saving}
                              title="Sauvegarder (Entrée)"
                              style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--dirty)', border: '1px solid var(--dirty-border)', color: 'var(--dirty-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={13} />
                            </button>
                            <button onClick={cancelEdit} title="Annuler (Échap)"
                              style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: 0 }} className="row-actions">
                            <button onClick={() => startEdit(m)} title="Modifier"
                              style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => { setDeleteError(null); setDeletingId(m.id) }} title="Supprimer"
                              style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Aucun mouvement trouvé
            </div>
          )}

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {filtered.length} / {movements.length} mouvements
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Double-clic ou ✏️ pour éditer · Entrée pour valider · Échap pour annuler</span>
          </div>
        </div>

        {/* Delete error banner */}
        {deleteError && (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 10, fontSize: 13, color: 'var(--red)' }}>
            <AlertTriangle size={15} />
            <span style={{ flex: 1 }}>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={14} /></button>
          </div>
        )}

        {/* Modals */}
        {showNew && <NewMovementModal onSave={handleCreated} onClose={() => setShowNew(false)} />}
        {deletingId && (
          <DeleteConfirm
            movement={movements.find(m => m.id === deletingId)!}
            onConfirm={() => confirmDelete(deletingId)}
            onCancel={() => setDeletingId(null)}
          />
        )}
        {pendingBulkUpdate && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => { setPendingBulkUpdate(null); setStagedBioType(''); setStagedComplexity('') }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
            <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px 28px', width: 400, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--elev-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✏️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
                Modifier {selected.size} mouvement{selected.size > 1 ? 's' : ''} ?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, alignItems: 'center' }}>
                {pendingBulkUpdate.bioType && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Type → <span style={{ fontWeight: 700, color: BIO_TYPE_COLORS[pendingBulkUpdate.bioType] }}>{BIO_TYPE_ICONS[pendingBulkUpdate.bioType]} {pendingBulkUpdate.bioType}</span>
                  </div>
                )}
                {pendingBulkUpdate.complexity && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Complexité → <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pendingBulkUpdate.complexity}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 22 }}>Cette action modifiera tous les mouvements sélectionnés.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { setPendingBulkUpdate(null); setStagedBioType(''); setStagedComplexity('') }} style={{ padding: '8px 20px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                <button
                  onClick={async () => {
                    const patch = pendingBulkUpdate
                    setPendingBulkUpdate(null)
                    setStagedBioType('')
                    setStagedComplexity('')
                    await handleBulkUpdate(patch)
                  }}
                  disabled={bulkWorking}
                  style={{ padding: '8px 22px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {showBulkDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setShowBulkDeleteConfirm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
            <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px 28px', width: 400, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--elev-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Supprimer {selected.size} mouvements ?</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Les mouvements utilisés dans des workouts seront ignorés.</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 22 }}>Cette action est irréversible.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setShowBulkDeleteConfirm(false)} style={{ padding: '8px 20px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                <button onClick={handleBulkDelete} disabled={bulkWorking} style={{ padding: '8px 22px', background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: bulkWorking ? 'wait' : 'pointer', opacity: bulkWorking ? 0.7 : 1 }}>
                  {bulkWorking ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </>)}

      {/* ── Référentiels tab ── */}
      {activeTab === 'referentiels' && <AttributesTab />}

      {/* ── Doublons tab ── */}
      {activeTab === 'doublons' && <DuplicatesTab />}

      {/* ── Stats tab ── */}
      {activeTab === 'stats' && <StatsTab />}

      {/* ── Workouts tab ── */}
      {activeTab === 'workouts' && <WorkoutsAdminTab />}

      {/* Toast (global) */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'slideUp 0.2s ease' }}>
          {toast}
        </div>
      )}

      <style>{`
        tr:hover .row-actions { opacity: 1 !important; transition: opacity 0.15s; }
        .row-actions { transition: opacity 0.15s; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .usage-row:hover { background: var(--bg-elevated) !important; }
      `}</style>

      {/* ── Usage panel (fixed right, mouvements tab only) ── */}
      {activeTab === 'mouvements' && usagePanel && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 340, height: '100vh', zIndex: 40, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.25)', animation: 'slideInRight 0.2s ease' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Utilisé dans</div>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usagePanel.name}</div>
              </div>
              <button onClick={() => setUsagePanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
              {usagePanelLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                  {[1,2,3].map(i => <div key={i} style={{ height: 52, background: 'var(--bg-elevated)', borderRadius: 8, opacity: 0.5 }} />)}
                </div>
              ) : usagePanel.workouts.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucun workout trouvé</div>
              ) : (
                <div>
                  {usagePanel.workouts.map((w, i) => {
                    const author = w.user ? ((w.user.firstName || w.user.lastName) ? `${w.user.firstName ?? ''} ${w.user.lastName ?? ''}`.trim() : w.user.email) : null
                    const date = new Date(w.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    return (
                      <a
                        key={w.id}
                        href={`/workouts/${w.id}?from=admin`}
                        className="usage-row"
                        style={{ display: 'block', padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.12s' }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                          <span>{date}</span>
                          <span>·</span>
                          <span>{w._count.movements} mouv.</span>
                          {w.duration && <><span>·</span><span>{w.duration} min</span></>}
                          {author && <><span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</span></>}
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer count */}
            {!usagePanelLoading && usagePanel.workouts.length > 0 && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}>
                {usagePanel.workouts.length} workout{usagePanel.workouts.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
