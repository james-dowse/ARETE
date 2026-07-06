'use client'
import AppShell from '@/components/AppShell'
import BoardCanvas from '@/components/BoardCanvas'
import VisionSlotModal from '@/components/VisionSlotModal'
import ExportMenu from '@/components/ExportMenu'
import { Button } from '@/components/ui'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Printer, Presentation, Grid3x3, Check, Loader2 } from 'lucide-react'
import { VisionBoard, VisionSlot, PAGE_SIZE_LABELS, boardRatio } from '@/lib/visionBoard'

export default function VisionBoardEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [board, setBoard] = useState<VisionBoard | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [snapGrid, setSnapGrid] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editingName, setEditingName] = useState(false)
  const skipNextSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/vision-boards/${id}`).then(r => {
      if (!r.ok) { router.replace('/vision-board'); return null }
      return r.json()
    }).then(data => { if (data) { skipNextSave.current = true; setBoard(data) } })
  }, [id, router])

  const save = useCallback((b: VisionBoard) => {
    setSaveState('saving')
    fetch(`/api/vision-boards/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: b.name, pageSize: b.pageSize, orientation: b.orientation, bgColor: b.bgColor,
        slots: b.slots.map(s => ({ x: s.x, y: s.y, w: s.w, h: s.h, z: s.z, type: s.type, content: s.content, color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, align: s.align })),
      }),
    }).then(() => setSaveState('saved'))
  }, [id])

  useEffect(() => {
    if (!board) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(board), 700)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [board, save])

  if (!board) return <AppShell><div style={{ color: 'var(--text-muted)' }}>Chargement…</div></AppShell>

  const update = (patch: Partial<VisionBoard>) => setBoard(b => b && { ...b, ...patch })
  const setSlots = (slots: VisionSlot[]) => setBoard(b => b && { ...b, slots })

  const addSlot = () => {
    const n = board.slots.length
    const offset = (n % 5) * 3
    const newSlot: VisionSlot = { id: `tmp_${Date.now()}`, x: 20 + offset, y: 20 + offset, w: 30, h: 30, z: n, type: 'empty' }
    setSlots([...board.slots, newSlot])
    setSelectedId(newSlot.id)
  }

  const deleteSlot = (slotId: string) => {
    setSlots(board.slots.filter(s => s.id !== slotId))
    if (selectedId === slotId) setSelectedId(null)
  }

  const editingSlot = board.slots.find(s => s.id === editingId) || null

  return (
    <AppShell>
      <div style={{ maxWidth: 1200 }}>
        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Link href="/vision-board" style={{ color: 'var(--text-dim)', display: 'flex' }}><ArrowLeft size={20} /></Link>
            {editingName ? (
              <input
                autoFocus
                value={board.name}
                onChange={e => update({ name: e.target.value })}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                className="input"
                style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', padding: '4px 8px', maxWidth: 360 }}
              />
            ) : (
              <h1 onClick={() => setEditingName(true)} title="Renommer" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', cursor: 'text' }}>
                {board.name}
              </h1>
            )}
            <SaveIndicator state={saveState} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant={snapGrid ? 'primary' : 'secondary'} onClick={() => setSnapGrid(s => !s)} title="Aligner sur une grille de 5%">
              <Grid3x3 size={14} /> Grille
            </Button>
            <Button size="sm" variant="secondary" onClick={addSlot}><Plus size={14} /> Emplacement</Button>
            <Button size="sm" variant="secondary" onClick={() => window.open(`/vision-board/${id}/print`, '_blank')}><Printer size={14} /> Imprimer</Button>
            <Button size="sm" variant="secondary" onClick={() => window.open(`/vision-board/${id}/present`, '_blank')}><Presentation size={14} /> Afficher</Button>
            <ExportMenu board={board} />
          </div>
        </div>

        {/* ── Réglages format ── */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>Format</span>
            {Object.entries(PAGE_SIZE_LABELS).map(([pid, label]) => (
              <button key={pid} onClick={() => update({ pageSize: pid })} style={{
                padding: '5px 11px', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${board.pageSize === pid ? 'var(--gold)' : 'var(--border)'}`,
                background: board.pageSize === pid ? 'var(--gold-ghost)' : 'var(--bg-elevated)',
                color: board.pageSize === pid ? 'var(--gold)' : 'var(--text-muted)',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[{ v: 'landscape', l: 'Paysage' }, { v: 'portrait', l: 'Portrait' }].map(o => (
              <button key={o.v} onClick={() => update({ orientation: o.v })} style={{
                padding: '5px 11px', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${board.orientation === o.v ? 'var(--gold)' : 'var(--border)'}`,
                background: board.orientation === o.v ? 'var(--gold-ghost)' : 'var(--bg-elevated)',
                color: board.orientation === o.v ? 'var(--gold)' : 'var(--text-muted)',
              }}>{o.l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>Fond</span>
            <input type="color" value={board.bgColor} onChange={e => update({ bgColor: e.target.value })} style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
          </div>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Cliquez un emplacement vide pour y insérer un contenu · glissez pour créer un nouvel emplacement</span>
        </div>

        {/* ── Canvas ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
          <BoardCanvas
            slots={board.slots}
            bgColor={board.bgColor}
            ratio={boardRatio(board.pageSize, board.orientation)}
            mode="edit"
            selectedId={selectedId}
            gridStep={snapGrid ? 5 : null}
            onChange={setSlots}
            onSelect={setSelectedId}
            onEdit={setEditingId}
            onDelete={deleteSlot}
            style={{ borderRadius: 8, boxShadow: '0 2px 24px rgba(0,0,0,0.25)' }}
          />
        </div>
      </div>

      {editingSlot && (
        <VisionSlotModal
          slot={editingSlot}
          onClose={() => setEditingId(null)}
          onSave={patch => setSlots(board.slots.map(s => s.id === editingSlot.id ? { ...s, ...patch } : s))}
        />
      )}
    </AppShell>
  )
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)' }}>
      {state === 'saving' ? <><Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> Enregistrement…</> : <><Check size={12} color="var(--green)" /> Enregistré</>}
    </span>
  )
}
