'use client'
import AppShell from '@/components/AppShell'
import RichEditor from '@/components/RichEditor'
import MovementModal from '@/components/MovementModal'
import {
  BIO_TYPE_COLORS, BIO_TYPE_ICONS, BIO_TYPES,
  COMPLEXITIES, COMPLEXITY_COLORS,
} from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Clock, Copy,
  RefreshCw, Search, X, Save, Undo2, Pencil, Minus, Plus,
  AlignLeft, ImageIcon, Trash2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Movement {
  id: string; name: string; bioType: string; complexity: string
  description?: string | null; videoUrl?: string | null
}
interface WorkoutMovement {
  id: string; movementId: string; order: number
  sets?: number | null; reps?: string | null; movement: Movement
  blockId?: string | null
}
interface WorkoutBlock {
  id: string; order: number; bioType?: string | null; instructions?: string | null
}
interface Workout {
  id: string; name: string; createdAt: string
  duration?: number | null
  notes?: string | null; description?: string | null; imageUrl?: string | null
  movements: WorkoutMovement[]
  blocks: WorkoutBlock[]
}
interface EditState { movementId: string; movement: Movement; sets: number; reps: string }

// ─── Library Picker Modal ─────────────────────────────────────────────────────
function LibraryPicker({ current, onPick, onClose }: {
  current: WorkoutMovement; onPick: (m: Movement) => void; onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [bioFilter, setBioFilter] = useState(current.movement.bioType)
  const [complexityFilter, setComplexityFilter] = useState('')
  const [results, setResults] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const doFetch = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (bioFilter) p.set('bioType', bioFilter)
    if (complexityFilter) p.set('complexity', complexityFilter)
    if (search) p.set('search', search)
    const res = await fetch(`/api/movements?${p}`)
    setResults(await res.json())
    setLoading(false)
  }, [bioFilter, complexityFilter, search])

  useEffect(() => { const t = setTimeout(doFetch, 200); return () => clearTimeout(t) }, [doFetch])
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: 560, maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Choisir un mouvement</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Remplace : <span style={{ color: 'var(--text-primary)' }}>{current.movement.name}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={17} /></button>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={11} color="var(--text-muted)" /></button>}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip active={!bioFilter} color="" onClick={() => setBioFilter('')}>Tous</Chip>
            {BIO_TYPES.map(bt => (
              <Chip key={bt} active={bioFilter === bt} color={BIO_TYPE_COLORS[bt]} onClick={() => setBioFilter(bioFilter === bt ? '' : bt)}>
                {BIO_TYPE_ICONS[bt]} {bt}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip active={!complexityFilter} color="" onClick={() => setComplexityFilter('')}>Tous niveaux</Chip>
            {COMPLEXITIES.map(c => (
              <Chip key={c} active={complexityFilter === c} color={COMPLEXITY_COLORS[c]} onClick={() => setComplexityFilter(complexityFilter === c ? '' : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>}
          {!loading && results.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucun résultat</div>}
          {!loading && results.map(m => {
            const isCurrent = m.id === current.movement.id
            return (
              <button key={m.id} onClick={() => { if (!isCurrent) onPick(m) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: isCurrent ? 'var(--accent-dim)' : 'transparent', border: isCurrent ? '1px solid var(--border)' : '1px solid transparent', cursor: isCurrent ? 'default' : 'pointer', marginBottom: 2, textAlign: 'left' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${BIO_TYPE_COLORS[m.bioType] || '#000'}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {BIO_TYPE_ICONS[m.bioType] || '⚡'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    <span style={{ color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)' }}>{m.bioType}</span>
                    <span style={{ color: 'var(--text-dim)' }}> · </span>
                    <span style={{ color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>{m.complexity}</span>
                  </div>
                </div>
                {isCurrent && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Actuel</span>}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ─── Image zone (view) ────────────────────────────────────────────────────────
function WorkoutImage({ src }: { src: string }) {
  return (
    <div style={{ marginBottom: 22, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
      <img src={src} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

// ─── Image zone (edit) ────────────────────────────────────────────────────────
function ImageEditZone({ current, file, preview, onChange, onRemove }: {
  current: string | null | undefined
  file: File | null
  preview: string | null
  onChange: (f: File, p: string) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displaySrc = preview || current

  const handleFile = (f: File) => {
    const url = URL.createObjectURL(f)
    onChange(f, url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600, letterSpacing: 0.4 }}>
        PHOTO DU WORKOUT
      </label>
      {displaySrc ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={displaySrc} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button onClick={() => inputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#111', backdropFilter: 'blur(4px)' }}>
              <ImageIcon size={12} /> Changer
            </button>
            <button onClick={onRemove}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#b91c1c', backdropFilter: 'blur(4px)' }}>
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
          {file && (
            <div style={{ position: 'absolute', bottom: 8, left: 8, padding: '3px 8px', background: 'rgba(26,26,26,0.75)', borderRadius: 5, fontSize: 11, color: '#fff' }}>
              Non sauvegardé
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{ border: '1.5px dashed var(--border)', borderRadius: 12, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', background: 'var(--bg-elevated)', transition: 'background 0.15s' }}>
          <ImageIcon size={24} color="var(--text-dim)" />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Ajouter une photo</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Cliquez ou glissez une image</div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ─── View Row ─────────────────────────────────────────────────────────────────
function MovementRowView({ wm, index, onMovementClick }: { wm: WorkoutMovement; index: number; onMovementClick: (id: string) => void }) {
  const m = wm.movement
  const hasSetsReps = wm.sets || wm.reps
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', flexShrink: 0 }}>{index + 1}</div>
      <div
        onClick={() => onMovementClick(m.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${BIO_TYPE_COLORS[m.bioType] || '#000'}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{BIO_TYPE_ICONS[m.bioType] || '⚡'}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{m.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)' }}>{m.bioType}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: `${COMPLEXITY_COLORS[m.complexity] || '#000'}12`, color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>{m.complexity}</span>
            {hasSetsReps && (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 8px' }}>
                  {wm.sets ?? '—'} × {wm.reps ?? '—'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {m.videoUrl && <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>▶</span>}
    </div>
  )
}

// ─── Edit Row ─────────────────────────────────────────────────────────────────
function MovementRowEdit({ es, original, index, allMovementIds, onUpdate, onRevert, onMovementClick }: {
  es: EditState; original: WorkoutMovement; index: number; allMovementIds: string[]
  onUpdate: (idx: number, patch: Partial<EditState>) => void; onRevert: (idx: number) => void
  onMovementClick: (id: string) => void
}) {
  const [loadingRandom, setLoadingRandom] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const m = es.movement
  const isDirtyMovement = es.movementId !== original.movementId
  const isDirtySets = es.sets !== (original.sets ?? 2)
  const isDirtyReps = es.reps !== (original.reps ?? '10')
  const isDirty = isDirtyMovement || isDirtySets || isDirtyReps

  const handleRandom = async () => {
    setLoadingRandom(true)
    const exclude = allMovementIds.filter(id => id !== es.movementId).join(',')
    const p = new URLSearchParams({ bioType: m.bioType, complexity: m.complexity, exclude })
    const res = await fetch(`/api/movements/random?${p}`)
    const newM: Movement = await res.json()
    if (newM) onUpdate(index, { movementId: newM.id, movement: newM })
    setLoadingRandom(false)
  }

  return (
    <>
      <div style={{ background: isDirty ? 'var(--dirty)' : 'var(--bg-card)', border: `1px solid ${isDirty ? 'var(--dirty-border)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', flexShrink: 0 }}>{index + 1}</div>
          <div
            onClick={() => onMovementClick(m.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${BIO_TYPE_COLORS[m.bioType] || '#000'}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{BIO_TYPE_ICONS[m.bioType] || '⚡'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{m.name}</span>
                {isDirtyMovement && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', color: 'var(--dirty-text)', fontWeight: 600, flexShrink: 0 }}>modifié</span>}
              </div>
              {isDirtyMovement
                ? <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}><span style={{ textDecoration: 'line-through', marginRight: 4 }}>{original.movement.name}</span><span style={{ color: 'var(--dirty-text)' }}>→ {m.name}</span></div>
                : <div style={{ fontSize: 11, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)', marginTop: 1 }}>{m.bioType}</div>
              }
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
            {isDirty && (
              <button onClick={() => onRevert(index)} title="Rétablir"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'none', border: '1px solid var(--dirty-border)', borderRadius: 7, color: 'var(--dirty-text)', fontSize: 11, cursor: 'pointer' }}>
                <Undo2 size={11} /> Rétablir
              </button>
            )}
            <button onClick={handleRandom} disabled={loadingRandom}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 11, cursor: loadingRandom ? 'wait' : 'pointer', opacity: loadingRandom ? 0.6 : 1 }}>
              <RefreshCw size={11} style={loadingRandom ? { animation: 'spin 0.8s linear infinite' } : {}} /> Aléatoire
            </button>
            <button onClick={() => setShowPicker(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              <Search size={11} /> Biblio
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 11, color: isDirtySets ? 'var(--dirty-text)' : 'var(--text-muted)', width: 46, flexShrink: 0, fontWeight: isDirtySets ? 600 : 400 }}>Séries</span>
            <Stepper value={es.sets} min={1} max={10} onChange={v => onUpdate(index, { sets: v })} highlight={isDirtySets} />
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 700 }}>×</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 11, color: isDirtyReps ? 'var(--dirty-text)' : 'var(--text-muted)', width: 46, flexShrink: 0, fontWeight: isDirtyReps ? 600 : 400 }}>Reps</span>
            <input value={es.reps} onChange={e => onUpdate(index, { reps: e.target.value })}
              style={{ width: 80, background: isDirtyReps ? 'var(--dirty)' : 'var(--bg-elevated)', border: `1px solid ${isDirtyReps ? 'var(--dirty-border)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', color: isDirtyReps ? 'var(--dirty-text)' : 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center', transition: 'all 0.2s' }} />
          </div>
        </div>
      </div>
      {showPicker && (
        <LibraryPicker
          current={{ ...original, movement: m, movementId: es.movementId }}
          onPick={newM => { setShowPicker(false); onUpdate(index, { movementId: newM.id, movement: newM }) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ─── Block Header (view) ──────────────────────────────────────────────────────
function BlockHeaderView({ block, index, movements }: { block: WorkoutBlock; index: number; movements: WorkoutMovement[] }) {
  const color = block.bioType ? BIO_TYPE_COLORS[block.bioType] : 'var(--text-muted)'
  const estMin = movements.reduce((sum, wm) => sum + (wm.sets ?? 2) * 1, 0)
  return (
    <div style={{ marginTop: index === 0 ? 0 : 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: block.instructions ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {index + 1}</span>
          {block.bioType && (
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${color}14`, color, border: `1px solid ${color}30`, fontWeight: 600 }}>
              {BIO_TYPE_ICONS[block.bioType]} {block.bioType}
            </span>
          )}
          {movements.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtMin(estMin)}</span>
          )}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {block.instructions && (
        <div style={{ background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <AlignLeft size={11} color={color} />
            <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.4 }}>INSTRUCTIONS</span>
          </div>
          <div
            className="rich-content"
            style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}
            dangerouslySetInnerHTML={{ __html: block.instructions }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Block Header (edit) ──────────────────────────────────────────────────────
function BlockHeaderEdit({ block, index, instructions, onChange, isDirty }: {
  block: WorkoutBlock; index: number; instructions: string; onChange: (v: string) => void; isDirty: boolean
}) {
  const color = block.bioType ? BIO_TYPE_COLORS[block.bioType] : 'var(--text-muted)'
  return (
    <div style={{ marginTop: index === 0 ? 0 : 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {index + 1}</span>
          {block.bioType && (
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${color}14`, color, border: `1px solid ${color}30`, fontWeight: 600 }}>
              {BIO_TYPE_ICONS[block.bioType]} {block.bioType}
            </span>
          )}
          {isDirty && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', color: 'var(--dirty-text)', fontWeight: 600 }}>modifié</span>}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ marginBottom: 4 }}>
        <label style={{ fontSize: 11, color: isDirty ? 'var(--dirty-text)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, fontWeight: 600, letterSpacing: 0.4 }}>
          <AlignLeft size={11} /> INSTRUCTIONS
        </label>
        <RichEditor
          key={block.id}
          value={instructions}
          onChange={onChange}
          placeholder="Ajouter des instructions pour ce bloc…"
          minHeight={60}
          highlight={isDirty}
        />
      </div>
    </div>
  )
}

// ─── Edit Bar ─────────────────────────────────────────────────────────────────
function EditBar({ count, onSave, onCancel, saving }: {
  count: number; onSave: () => void; onCancel: () => void; saving: boolean
}) {
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 50, minWidth: 340, animation: 'slideUp 0.25s ease' }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{count} modification{count > 1 ? 's' : ''}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>non sauvegardée{count > 1 ? 's' : ''}</span>
      </div>
      <button onClick={onCancel} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <Undo2 size={13} /> Annuler tout
      </button>
      <button onClick={onSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--on-accent)', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        <Save size={13} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
      </button>
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `1px solid ${active ? (color || 'var(--text-primary)') : 'var(--border)'}`, background: active ? (color ? `${color}18` : 'rgba(0,0,0,0.08)') : 'var(--bg-elevated)', color: active ? (color || 'var(--text-primary)') : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange, highlight }: { value: number; min: number; max: number; onChange: (v: number) => void; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: highlight ? 'var(--dirty)' : 'var(--bg-elevated)', border: `1px solid ${highlight ? 'var(--dirty-border)' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', transition: 'all 0.2s' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        style={{ width: 28, height: 30, background: 'none', border: 'none', cursor: value > min ? 'pointer' : 'default', color: value > min ? 'var(--text-primary)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Minus size={11} />
      </button>
      <span style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: highlight ? 'var(--dirty-text)' : 'var(--text-primary)' }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        style={{ width: 28, height: 30, background: 'none', border: 'none', cursor: value < max ? 'pointer' : 'default', color: value < max ? 'var(--text-primary)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Plus size={11} />
      </button>
    </div>
  )
}

// ─── Stat ─────────────────────────────────────────────────────────────────────
function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toEditState(wm: WorkoutMovement): EditState {
  return { movementId: wm.movementId, movement: wm.movement, sets: wm.sets ?? 2, reps: wm.reps ?? '10' }
}
function stripHtml(html: string) { return html.replace(/<[^>]*>/g, '').trim() }
function fmtMin(min: number) {
  const r = Math.round(min)
  if (r < 60) return `~${r}min`
  const h = Math.floor(r / 60); const m = r % 60
  return m > 0 ? `~${h}h${m}min` : `~${h}h`
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkoutDetailClient({ workout: initial }: { workout: Workout }) {
  const router = useRouter()

  const [editMode, setEditMode] = useState(false)
  const [editStates, setEditStates] = useState<EditState[]>([])
  const [blockInstructions, setBlockInstructions] = useState<Record<string, string>>({})
  const [editDescription, setEditDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const originals = initial.movements

  const [duplicating, setDuplicating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)

  // ── Dirty checks ──
  const isDirtyMovements = editMode && editStates.some((es, i) => {
    const orig = originals[i]
    return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10')
  })
  const isDirtyBlocks = editMode && initial.blocks.some(
    b => (blockInstructions[b.id] ?? '') !== (b.instructions ?? '')
  )
  const isDirtyDescription = editMode && stripHtml(editDescription) !== stripHtml(initial.description ?? '')
  const isDirtyImage = editMode && (imageFile !== null || removeImage)
  const isDirty = isDirtyMovements || isDirtyBlocks || isDirtyDescription || isDirtyImage

  const pendingCount = editMode
    ? editStates.filter((es, i) => {
        const orig = originals[i]
        return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10')
      }).length
      + initial.blocks.filter(b => (blockInstructions[b.id] ?? '') !== (b.instructions ?? '')).length
      + (isDirtyDescription ? 1 : 0)
      + (isDirtyImage ? 1 : 0)
    : 0

  const handleEnterEdit = () => {
    setEditStates(initial.movements.map(toEditState))
    const initBI: Record<string, string> = {}
    initial.blocks.forEach(b => { initBI[b.id] = b.instructions ?? '' })
    setBlockInstructions(initBI)
    setEditDescription(initial.description ?? '')
    setImageFile(null); setImagePreview(null); setRemoveImage(false)
    setEditMode(true)
  }

  const handleCancelAll = () => {
    setEditStates(initial.movements.map(toEditState))
    const initBI: Record<string, string> = {}
    initial.blocks.forEach(b => { initBI[b.id] = b.instructions ?? '' })
    setBlockInstructions(initBI)
    setEditDescription(initial.description ?? '')
    setImageFile(null); setImagePreview(null); setRemoveImage(false)
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
    })
    const changedBlocks = initial.blocks.filter(b => (blockInstructions[b.id] ?? '') !== (b.instructions ?? ''))

    await Promise.all([
      ...changedMovements.map(es => {
        const absIdx = editStates.indexOf(es)
        const orig = originals[absIdx]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: Record<string, any> = {}
        if (es.movementId !== orig.movementId) body.newMovementId = es.movementId
        if (es.sets !== (orig.sets ?? 2)) body.sets = es.sets
        if (es.reps !== (orig.reps ?? '10')) body.reps = es.reps
        return fetch(`/api/workouts/${initial.id}/movements/${orig.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      }),
      ...changedBlocks.map(b =>
        fetch(`/api/workouts/${initial.id}/blocks/${b.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions: blockInstructions[b.id] }),
        })
      ),
      ...(isDirtyDescription ? [
        fetch(`/api/workouts/${initial.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: editDescription }),
        })
      ] : []),
      ...(removeImage ? [
        fetch(`/api/workouts/${initial.id}/image`, { method: 'DELETE' })
      ] : (imageFile ? [
        (() => { const fd = new FormData(); fd.append('file', imageFile); return fetch(`/api/workouts/${initial.id}/image`, { method: 'POST', body: fd }) })()
      ] : [])),
    ])

    setSaving(false)
    setEditMode(false)
    router.refresh()
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${initial.id}/duplicate`, { method: 'POST' })
    const copy = await res.json()
    setDuplicating(false)
    router.push(`/workouts/${copy.id}`)
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
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 700, paddingBottom: isDirty ? 100 : 32 }}>
        <Link href="/workouts" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Retour aux workouts
        </Link>

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
                <button onClick={handleDuplicate} disabled={duplicating}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: duplicating ? 'wait' : 'pointer', opacity: duplicating ? 0.7 : 1 }}>
                  <Copy size={14} /> {duplicating ? 'Copie…' : 'Dupliquer'}
                </button>
                <button onClick={handleEnterEdit}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Pencil size={14} /> Modifier
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
              placeholder="Décris ce workout…"
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

        {/* ── MOVEMENTS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasBlocks ? (
            initial.blocks.map((block, bi) => {
              const blockMovements = blockMovementsMap[block.id] || []
              const blockES = blockEditStatesMap[block.id] || []
              return (
                <div key={block.id}>
                  {editMode ? (
                    <BlockHeaderEdit
                      block={block} index={bi}
                      instructions={blockInstructions[block.id] ?? ''}
                      onChange={v => setBlockInstructions(prev => ({ ...prev, [block.id]: v }))}
                      isDirty={(blockInstructions[block.id] ?? '') !== (block.instructions ?? '')}
                    />
                  ) : (
                    <BlockHeaderView block={block} index={bi} movements={blockMovementsMap[block.id] || []} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editMode
                      ? blockES.map(({ es, orig, absIdx }) => (
                          <MovementRowEdit key={orig.id} es={es} original={orig} index={absIdx} allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert} onMovementClick={setSelectedMovementId} />
                        ))
                      : blockMovements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} />)
                    }
                  </div>
                </div>
              )
            })
          ) : (
            editMode
              ? editStates.map((es, i) => (
                  <MovementRowEdit key={originals[i].id} es={es} original={originals[i]} index={i} allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert} onMovementClick={setSelectedMovementId} />
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </AppShell>
  )
}
