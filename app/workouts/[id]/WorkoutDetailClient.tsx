'use client'
import AppShell from '@/components/AppShell'
import RichEditor from '@/components/RichEditor'
import MovementModal from '@/components/MovementModal'
import ResumeSessionBanner from '@/components/ResumeSessionBanner'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Clock, Copy, X, Pencil,
  Trash2, ChevronDown, ChevronUp, CalendarPlus, CheckCircle2, History, FileText, PlayCircle,
} from 'lucide-react'
import {
  Workout, WorkoutMovement, WorkoutBlock, EditState,
  WorkoutImage, ImageEditZone, MovementRowView, MovementRowEdit,
  BlockHeaderView, BlockHeaderEdit, EditBar, AddToWeekModal, Stat,
  toEditState, stripHtml, fmtMin,
} from './parts'

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkoutDetailClient({ workout: initial, backTo }: { workout: Workout; backTo?: string }) {
  const router = useRouter()

  const [editMode, setEditMode] = useState(false)
  const [editStates, setEditStates] = useState<EditState[]>([])
  const [blockInstructions, setBlockInstructions] = useState<Record<string, string>>({})
  const [blockSuperset, setBlockSuperset] = useState<Record<string, boolean>>({})
  const [editDescription, setEditDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const originals = initial.movements

  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showAddToWeek, setShowAddToWeek] = useState(false)
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [sessions, setSessions] = useState<{ id: string; doneAt: string; note?: string | null }[]>([])
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [loggingSession, setLoggingSession] = useState(false)
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)
  const [removedWmIds, setRemovedWmIds] = useState<Set<string>>(new Set())
  const [removedBlockIds, setRemovedBlockIds] = useState<Set<string>>(new Set())
  const [collapsedViewBlocks, setCollapsedViewBlocks] = useState<Record<string, boolean>>({})
  const toggleViewBlock = (id: string) => setCollapsedViewBlocks(prev => ({ ...prev, [id]: !prev[id] }))
  const [editTags, setEditTags] = useState<string[]>(() => initial.tags ? initial.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
  const [tagInput, setTagInput] = useState('')
  const [movementOrder, setMovementOrder] = useState<Record<string, number>>({})
  const [draggedWmId, setDraggedWmId] = useState<string | null>(null)

  const handleReorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setMovementOrder(prev => {
      const ids = Object.keys(prev).sort((a, b) => prev[a] - prev[b])
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      ids.splice(from, 1)
      ids.splice(to, 0, draggedId)
      const next: Record<string, number> = {}
      ids.forEach((id, idx) => { next[id] = idx })
      return next
    })
  }

  // Track last viewed (fire-and-forget)
  useEffect(() => {
    fetch(`/api/workouts/${initial.id}/view`, { method: 'POST' }).catch(() => {})
  }, [initial.id])

  // Load sessions
  useEffect(() => {
    fetch(`/api/workouts/${initial.id}/sessions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSessions(data) })
      .catch(() => {})
  }, [initial.id])

  const handleLogSession = async () => {
    setLoggingSession(true)
    const res = await fetch(`/api/workouts/${initial.id}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => null)
    if (!res || !res.ok) {
      toast('Impossible d\'enregistrer la séance', 'error')
      setLoggingSession(false)
      return
    }
    const s = await res.json()
    setSessions(prev => [s, ...prev])
    setLoggingSession(false)
    toast('Séance enregistrée ✓')
  }

  // Session toast auto-hide already handled above

  // Auto-enter edit mode if navigated with ?edit=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') === '1') {
      handleEnterEdit()
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Dirty checks ──
  const isDirtyMovements = editMode && editStates.some((es, i) => {
    const orig = originals[i]
    return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10') || es.duration !== (orig.duration ?? null)
  })
  const blockChanged = (b: WorkoutBlock) =>
    (blockInstructions[b.id] ?? '') !== (b.instructions ?? '') ||
    (blockSuperset[b.id] ?? false) !== !!b.superset
  const isDirtyBlocks = editMode && initial.blocks.some(blockChanged)
  const isDirtyDescription = editMode && stripHtml(editDescription) !== stripHtml(initial.description ?? '')
  const isDirtyImage = editMode && (imageFile !== null || removeImage)
  const isDirtyTags = editMode && editTags.join(',') !== (initial.tags ?? '')
  const isDirtyOrder = editMode && originals.some(o => (movementOrder[o.id] ?? o.order) !== o.order)
  const isDirty = isDirtyMovements || isDirtyBlocks || isDirtyDescription || isDirtyImage || isDirtyTags || isDirtyOrder || removedWmIds.size > 0 || removedBlockIds.size > 0

  const pendingCount = editMode
    ? editStates.filter((es, i) => {
        const orig = originals[i]
        return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10') || es.duration !== (orig.duration ?? null)
      }).length
      + initial.blocks.filter(blockChanged).length
      + (isDirtyDescription ? 1 : 0)
      + (isDirtyImage ? 1 : 0)
      + (isDirtyOrder ? 1 : 0)
      + removedWmIds.size
      + removedBlockIds.size
    : 0

  const handleEnterEdit = () => {
    setEditStates(initial.movements.map(toEditState))
    const initBI: Record<string, string> = {}
    const initBS: Record<string, boolean> = {}
    initial.blocks.forEach(b => { initBI[b.id] = b.instructions ?? ''; initBS[b.id] = !!b.superset })
    setBlockInstructions(initBI)
    setBlockSuperset(initBS)
    setEditDescription(initial.description ?? '')
    setImageFile(null); setImagePreview(null); setRemoveImage(false)
    setRemovedWmIds(new Set()); setRemovedBlockIds(new Set())
    const initOrder: Record<string, number> = {}
    initial.movements.forEach(wm => { initOrder[wm.id] = wm.order })
    setMovementOrder(initOrder)
    setEditMode(true)
  }

  const handleCancelAll = () => {
    setEditStates(initial.movements.map(toEditState))
    const initBI: Record<string, string> = {}
    const initBS: Record<string, boolean> = {}
    initial.blocks.forEach(b => { initBI[b.id] = b.instructions ?? ''; initBS[b.id] = !!b.superset })
    setBlockInstructions(initBI)
    setBlockSuperset(initBS)
    setEditDescription(initial.description ?? '')
    setImageFile(null); setImagePreview(null); setRemoveImage(false)
    setRemovedWmIds(new Set()); setRemovedBlockIds(new Set())
    const initOrder: Record<string, number> = {}
    initial.movements.forEach(wm => { initOrder[wm.id] = wm.order })
    setMovementOrder(initOrder)
    setEditMode(false)
  }

  const handleUpdate = (idx: number, patch: Partial<EditState>) =>
    setEditStates(prev => prev.map((es, i) => i === idx ? { ...es, ...patch } : es))

  const handleRevert = (idx: number) =>
    setEditStates(prev => prev.map((es, i) => i === idx ? toEditState(originals[i]) : es))

  const handleSave = async () => {
    setSaving(true)

    const changedMovements = editStates.filter((es, i) => {
      const orig = originals[i]
      return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10')
        || (movementOrder[orig.id] ?? orig.order) !== orig.order
    })
    const changedBlocks = initial.blocks.filter(blockChanged)

    const results = await Promise.all([
      ...changedMovements.map(es => {
        const absIdx = editStates.indexOf(es)
        const orig = originals[absIdx]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: Record<string, any> = {}
        if (es.movementId !== orig.movementId) body.newMovementId = es.movementId
        if (es.sets !== (orig.sets ?? 2)) body.sets = es.sets
        if (es.reps !== (orig.reps ?? '10')) body.reps = es.reps
        if (es.duration !== (orig.duration ?? null)) body.duration = es.duration
        if ((movementOrder[orig.id] ?? orig.order) !== orig.order) body.order = movementOrder[orig.id]
        return fetch(`/api/workouts/${initial.id}/movements/${orig.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }).catch(() => null)
      }),
      ...changedBlocks.map(b =>
        fetch(`/api/workouts/${initial.id}/blocks/${b.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions: blockInstructions[b.id], superset: blockSuperset[b.id] ?? false }),
        }).catch(() => null)
      ),
      ...((isDirtyDescription || isDirtyTags) ? [
        fetch(`/api/workouts/${initial.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(isDirtyDescription ? { description: editDescription } : {}),
            ...(isDirtyTags ? { tags: editTags.join(',') || null } : {}),
          }),
        }).catch(() => null)
      ] : []),
      ...(removeImage ? [
        fetch(`/api/workouts/${initial.id}/image`, { method: 'DELETE' }).catch(() => null)
      ] : (imageFile ? [
        (() => { const fd = new FormData(); fd.append('file', imageFile); return fetch(`/api/workouts/${initial.id}/image`, { method: 'POST', body: fd }).catch(() => null) })()
      ] : [])),
      ...[...removedWmIds].map(wmId =>
        fetch(`/api/workouts/${initial.id}/movements/${wmId}`, { method: 'DELETE' }).catch(() => null)
      ),
      ...[...removedBlockIds].map(blockId =>
        fetch(`/api/workouts/${initial.id}/blocks/${blockId}`, { method: 'DELETE' }).catch(() => null)
      ),
    ])

    const failed = results.filter(r => !r || !r.ok).length
    setSaving(false)
    if (failed > 0) {
      toast(`${failed} modification${failed > 1 ? 's' : ''} n'a pas pu être sauvegardée — réessaie.`, 'error')
      return
    }
    setEditMode(false)
    toast('Modifications sauvegardées ✓')
    router.refresh()
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${initial.id}/duplicate`, { method: 'POST' }).catch(() => null)
    setDuplicating(false)
    if (!res || !res.ok) { toast('Échec de la duplication', 'error'); return }
    const copy = await res.json()
    router.push(`/workouts/${copy.id}`)
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement cette séance ?')) return
    setDeleting(true)
    const res = await fetch(`/api/workouts/${initial.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res || !res.ok) {
      toast('Échec de la suppression', 'error')
      setDeleting(false)
      return
    }
    router.push(backTo ?? '/workouts')
  }

  const allMovementIds = editMode
    ? editStates.map(es => es.movementId)
    : initial.movements.map(m => m.movementId)

  const bioTypes = Array.from(new Set(
    (editMode ? editStates.map(es => es.movement.bioType) : initial.movements.map(m => m.movement.bioType))
  ))

  // Estimated duration: 1 min per set across all movements
  const currentSets = editMode
    ? editStates.map(es => es.sets)
    : initial.movements.map(wm => wm.sets ?? 2)
  const estimatedMin = currentSets.reduce((sum, s) => sum + s, 0)

  const hasBlocks = initial.blocks.length > 0
  const blockMovementsMap: Record<string, WorkoutMovement[]> = {}
  if (hasBlocks) {
    initial.blocks.forEach(b => { blockMovementsMap[b.id] = [] })
    initial.movements.forEach(wm => { if (wm.blockId && blockMovementsMap[wm.blockId]) blockMovementsMap[wm.blockId].push(wm) })
  }
  const blockEditStatesMap: Record<string, { es: EditState; orig: WorkoutMovement; absIdx: number }[]> = {}
  if (hasBlocks && editMode) {
    initial.blocks.forEach(b => { blockEditStatesMap[b.id] = [] })
    originals.forEach((orig, absIdx) => {
      if (orig.blockId && blockEditStatesMap[orig.blockId])
        blockEditStatesMap[orig.blockId].push({ es: editStates[absIdx], orig, absIdx })
    })
    Object.values(blockEditStatesMap).forEach(list =>
      list.sort((a, b) => (movementOrder[a.orig.id] ?? a.orig.order) - (movementOrder[b.orig.id] ?? b.orig.order))
    )
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 700, paddingBottom: isDirty ? 100 : 32 }}>
        <Link href={backTo ?? '/workouts'} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, marginBottom: 24 }}>
          <ArrowLeft size={14} /> {backTo === '/admin' ? 'Retour à l\'administration' : 'Retour aux séances'}
        </Link>

        <ResumeSessionBanner workoutId={initial.id} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{initial.name}</h1>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {new Date(initial.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {initial.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}><Clock size={12} /> {initial.duration} min</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!editMode ? (
              <>
                <button onClick={() => router.push(`/workouts/${initial.id}/active`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(200,165,95,0.12)', border: '1px solid rgba(200,165,95,0.35)', borderRadius: 9, color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <PlayCircle size={14} /> Démarrer
                </button>
                <button onClick={handleLogSession} disabled={loggingSession}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(187,176,147,0.1)', border: '1px solid rgba(187,176,147,0.3)', borderRadius: 9, color: 'var(--green)', fontSize: 13, fontWeight: 600, cursor: loggingSession ? 'wait' : 'pointer' }}>
                  <CheckCircle2 size={14} /> {loggingSession ? '…' : 'J\'ai fait'}
                </button>
                <button onClick={() => window.open(`/workouts/${initial.id}/print`, '_blank')}
                  title="Exporter en PDF"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                  <FileText size={14} />
                </button>
                <button onClick={() => setShowAddToWeek(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', borderRadius: 9, color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <CalendarPlus size={14} /> Semaine
                </button>
                <button onClick={handleDuplicate} disabled={duplicating}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: duplicating ? 'wait' : 'pointer', opacity: duplicating ? 0.7 : 1 }}>
                  <Copy size={14} /> {duplicating ? 'Copie…' : 'Dupliquer'}
                </button>
                <button onClick={handleEnterEdit}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Pencil size={14} /> Modifier
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 9, color: deleting ? 'var(--text-dim)' : 'var(--red)', fontSize: 13, fontWeight: 600, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!deleting) { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'var(--red)' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 9 }}>
                <Pencil size={13} color="var(--on-accent)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-accent)' }}>Mode édition</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          <Stat value={initial.movements.length} label="Mouvements" color="var(--accent)" />
          <Stat value={bioTypes.length} label="Types" color="var(--blue)" />
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>{fmtMin(estimatedMin)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {initial.duration ? `${initial.duration}min prévu` : 'Estimé'}
            </div>
          </div>
        </div>

        {/* Bio tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {bioTypes.map(bt => (
            <span key={bt} style={{ padding: '3px 11px', borderRadius: 20, fontSize: 12, background: `${BIO_TYPE_COLORS[bt] || '#000'}10`, color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)', border: `1px solid ${BIO_TYPE_COLORS[bt] || '#000'}20` }}>
              {BIO_TYPE_ICONS[bt]} {bt}
            </span>
          ))}
        </div>

        {/* Edit hint */}
        {editMode && !isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <Pencil size={12} color="var(--text-dim)" />
            <span>Modifie les mouvements, la description, les photos et les instructions des blocs.</span>
          </div>
        )}

        {/* ── IMAGE ── */}
        {editMode ? (
          <ImageEditZone
            current={initial.imageUrl}
            file={imageFile}
            preview={imagePreview}
            onChange={(f, p) => { setImageFile(f); setImagePreview(p); setRemoveImage(false) }}
            onRemove={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true) }}
          />
        ) : (
          (initial.imageUrl && !removeImage) && <WorkoutImage src={initial.imageUrl} />
        )}

        {/* ── DESCRIPTION ── */}
        {editMode ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDirtyDescription ? 'var(--dirty-text)' : 'var(--text-muted)', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              DESCRIPTION {isDirtyDescription && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', fontWeight: 600 }}>modifié</span>}
            </label>
            <RichEditor
              key="description"
              value={editDescription}
              onChange={setEditDescription}
              placeholder="Décris cette séance…"
              minHeight={90}
              highlight={isDirtyDescription}
            />
          </div>
        ) : (
          initial.description && stripHtml(initial.description) && (
            <div style={{ marginBottom: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, marginBottom: 8 }}>DESCRIPTION</div>
              <div
                className="rich-content"
                style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: initial.description }}
              />
            </div>
          )
        )}

        {/* ── TAGS ── */}
        {editMode ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDirtyTags ? 'var(--dirty-text)' : 'var(--text-muted)', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              TAGS {isDirtyTags && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', fontWeight: 600 }}>modifié</span>}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {editTags.map(tag => (
                <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                  #{tag}
                  <button onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gold)', display: 'flex', lineHeight: 1 }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    const t = tagInput.trim()
                    if (!editTags.includes(t)) setEditTags(prev => [...prev, t])
                    setTagInput('')
                  }
                }}
                placeholder="Ajouter un tag…"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', flex: 1 }}
              />
              <button
                onClick={() => { const t = tagInput.trim(); if (t && !editTags.includes(t)) { setEditTags(prev => [...prev, t]); setTagInput('') } }}
                disabled={!tagInput.trim()}
                style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
              >
                + Ajouter
              </button>
            </div>
          </div>
        ) : (
          initial.tags && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {initial.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{ padding: '2px 10px', borderRadius: 20, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                  #{tag}
                </span>
              ))}
            </div>
          )
        )}

        {/* ── MOVEMENTS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasBlocks ? (
            initial.blocks.filter(block => !removedBlockIds.has(block.id)).map((block, bi) => {
              const blockMovements = blockMovementsMap[block.id] || []
              const blockES = (blockEditStatesMap[block.id] || []).filter(({ orig }) => !removedWmIds.has(orig.id))
              const blockCollapsed = !editMode && !!collapsedViewBlocks[block.id]
              return (
                <div key={block.id}>
                  {editMode ? (
                    <BlockHeaderEdit
                      block={block} index={bi}
                      instructions={blockInstructions[block.id] ?? ''}
                      onChange={v => setBlockInstructions(prev => ({ ...prev, [block.id]: v }))}
                      superset={blockSuperset[block.id] ?? false}
                      canSuperset={blockMovements.length > 1}
                      onToggleSuperset={() => setBlockSuperset(prev => ({ ...prev, [block.id]: !(prev[block.id] ?? false) }))}
                      isDirty={blockChanged(block)}
                      onRemove={() => setRemovedBlockIds(prev => new Set([...prev, block.id]))}
                    />
                  ) : (
                    <BlockHeaderView
                      block={block} index={bi} movements={blockMovementsMap[block.id] || []}
                      collapsed={blockCollapsed} onToggle={() => toggleViewBlock(block.id)}
                    />
                  )}
                  {!blockCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {editMode
                        ? blockES.map(({ es, orig, absIdx }, pos) => (
                            <MovementRowEdit key={orig.id} es={es} original={orig} index={absIdx} displayNumber={pos + 1} allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert} onMovementClick={setSelectedMovementId}
                              onRemove={() => setRemovedWmIds(prev => new Set([...prev, orig.id]))}
                              isDragging={draggedWmId === orig.id}
                              onDragStart={() => setDraggedWmId(orig.id)}
                              onDragOver={() => { if (draggedWmId) handleReorder(draggedWmId, orig.id) }}
                              onDrop={() => setDraggedWmId(null)}
                              onDragEnd={() => setDraggedWmId(null)}
                            />
                          ))
                        : blockMovements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} />)
                      }
                    </div>
                  )}
                  {/* Inter-block rest */}
                  {!editMode && !blockCollapsed && bi < initial.blocks.length - 1 && (block.restAfter != null || initial.blockRest != null) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        ⏸ {block.restAfter ?? initial.blockRest} min · repos entre blocs
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            editMode
              ? editStates
                  .map((es, i) => ({ es, orig: originals[i], i }))
                  .filter(({ orig }) => !removedWmIds.has(orig.id))
                  .sort((a, b) => (movementOrder[a.orig.id] ?? a.orig.order) - (movementOrder[b.orig.id] ?? b.orig.order))
                  .map(({ es, orig, i }, pos) => (
                    <MovementRowEdit key={orig.id} es={es} original={orig} index={i} displayNumber={pos + 1} allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert} onMovementClick={setSelectedMovementId}
                      onRemove={() => setRemovedWmIds(prev => new Set([...prev, orig.id]))}
                      isDragging={draggedWmId === orig.id}
                      onDragStart={() => setDraggedWmId(orig.id)}
                      onDragOver={() => { if (draggedWmId) handleReorder(draggedWmId, orig.id) }}
                      onDrop={() => setDraggedWmId(null)}
                      onDragEnd={() => setDraggedWmId(null)}
                    />
                  ))
              : initial.movements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} />)
          )}
        </div>

        {initial.notes && (
          <div style={{ marginTop: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, marginBottom: 6 }}>NOTES</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{initial.notes}</div>
          </div>
        )}
      </div>

      {editMode && isDirty && <EditBar count={pendingCount} onSave={handleSave} onCancel={handleCancelAll} saving={saving} />}

      {editMode && !isDirty && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, animation: 'slideUp 0.25s ease' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune modification</span>
          <button onClick={() => setEditMode(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <X size={13} /> Quitter l'édition
          </button>
        </div>
      )}

      <MovementModal movementId={selectedMovementId} onClose={() => setSelectedMovementId(null)} />

      {showAddToWeek && (
        <AddToWeekModal
          workoutId={initial.id}
          onClose={() => setShowAddToWeek(false)}
          onAdded={() => toast('Ajouté au planner ✓')}
        />
      )}

      {/* Historique des séances */}
      {sessions.length > 0 && !editMode && (
        <div style={{ maxWidth: 700, marginTop: 32 }}>
          <div
            onClick={() => setSessionsOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginBottom: sessionsOpen ? 12 : 0 }}
          >
            <History size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Historique</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sessions.length} séance{sessions.length > 1 ? 's' : ''}</span>
            {sessions[0] && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>
                · dernière {new Date(sessions[0].doneAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', display: 'flex' }}>
              {sessionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
          {sessionsOpen && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {sessions.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <CheckCircle2 size={13} color="var(--green)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date(s.doneAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                    {new Date(s.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </AppShell>
  )
}
