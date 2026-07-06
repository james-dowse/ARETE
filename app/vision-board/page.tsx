'use client'
import AppShell from '@/components/AppShell'
import BoardCanvas from '@/components/BoardCanvas'
import ExportMenu from '@/components/ExportMenu'
import { Card, Button, Modal, Input, Skeleton } from '@/components/ui'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Printer, Presentation, Trash2 } from 'lucide-react'
import { VisionBoard, LAYOUT_PRESETS, PAGE_SIZE_LABELS, boardRatio } from '@/lib/visionBoard'

export default function VisionBoardListPage() {
  const router = useRouter()
  const [boards, setBoards] = useState<VisionBoard[] | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = () => fetch('/api/vision-boards').then(r => r.json()).then(setBoards)
  useEffect(() => { load() }, [])

  const removeBoard = async (id: string) => {
    if (!confirm('Supprimer ce vision board ?')) return
    await fetch(`/api/vision-boards/${id}`, { method: 'DELETE' })
    setBoards(prev => prev?.filter(b => b.id !== id) ?? null)
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Vision Board</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 15 }}>
              Construisez votre tableau de vision — à imprimer, afficher ou emporter.
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowNew(true)}><Plus size={16} /> Nouveau tableau</Button>
        </div>

        {boards === null && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {[0, 1, 2].map(i => <Skeleton key={i} height={220} style={{ borderRadius: 'var(--r-lg)' }} />)}
          </div>
        )}

        {boards?.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 16 }}>Aucun vision board pour l&apos;instant.</div>
            <Button variant="primary" onClick={() => setShowNew(true)}><Plus size={16} /> Créer mon premier tableau</Button>
          </Card>
        )}

        {boards && boards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {boards.map(b => (
              <Card key={b.id} style={{ padding: 0, overflow: 'hidden' }}>
                <div onClick={() => router.push(`/vision-board/${b.id}`)} style={{ cursor: 'pointer' }}>
                  <BoardCanvas slots={b.slots} bgColor={b.bgColor} ratio={boardRatio(b.pageSize, b.orientation)} mode="display" />
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
                      <ExportMenu board={b} compact />
                      <button onClick={() => removeBoard(b.id)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                    {PAGE_SIZE_LABELS[b.pageSize]} · {b.orientation === 'portrait' ? 'Portrait' : 'Paysage'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="sm" variant="secondary" style={{ flex: 1 }} onClick={() => window.open(`/vision-board/${b.id}/print`, '_blank')}><Printer size={13} /> Imprimer</Button>
                    <Button size="sm" variant="secondary" style={{ flex: 1 }} onClick={() => window.open(`/vision-board/${b.id}/present`, '_blank')}><Presentation size={13} /> Afficher</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showNew && <NewBoardModal onClose={() => setShowNew(false)} onCreated={id => router.push(`/vision-board/${id}`)} />}
    </AppShell>
  )
}

function NewBoardModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [preset, setPreset] = useState(LAYOUT_PRESETS[1].id)
  const [pageSize, setPageSize] = useState('A4')
  const [orientation, setOrientation] = useState('landscape')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const slots = LAYOUT_PRESETS.find(p => p.id === preset)?.slots ?? []
    const res = await fetch('/api/vision-boards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pageSize, orientation, slots }),
    })
    const data = await res.json()
    setSaving(false)
    onCreated(data.id)
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <div style={{ padding: 'var(--sp-6)' }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 18, fontFamily: 'var(--font-display)' }}>Nouveau vision board</div>

        <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Nom</label>
        <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Mes objectifs 2027" style={{ marginBottom: 18, width: '100%' }} />

        <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Format</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {Object.entries(PAGE_SIZE_LABELS).map(([id, label]) => (
            <button key={id} onClick={() => setPageSize(id)} style={{
              padding: '7px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: `1px solid ${pageSize === id ? 'var(--gold)' : 'var(--border)'}`,
              background: pageSize === id ? 'var(--gold-ghost)' : 'var(--bg-elevated)',
              color: pageSize === id ? 'var(--gold)' : 'var(--text-muted)',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{ id: 'landscape', label: 'Paysage' }, { id: 'portrait', label: 'Portrait' }].map(o => (
            <button key={o.id} onClick={() => setOrientation(o.id)} style={{
              padding: '7px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: `1px solid ${orientation === o.id ? 'var(--gold)' : 'var(--border)'}`,
              background: orientation === o.id ? 'var(--gold-ghost)' : 'var(--bg-elevated)',
              color: orientation === o.id ? 'var(--gold)' : 'var(--text-muted)',
            }}>{o.label}</button>
          ))}
        </div>

        <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Disposition de départ</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {LAYOUT_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              title={p.label}
              style={{
                border: `1.5px solid ${preset === p.id ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)', padding: 6, cursor: 'pointer', background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ position: 'relative', width: '100%', aspectRatio: boardRatio(pageSize, orientation), background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
                {p.slots.map((s, i) => (
                  <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%`, background: preset === p.id ? 'var(--gold)' : 'var(--border-plus)', borderRadius: 2 }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={saving} onClick={create} disabled={!name.trim()}>Créer</Button>
        </div>
      </div>
    </Modal>
  )
}
