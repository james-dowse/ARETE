'use client'
import RichEditor from '@/components/RichEditor'
import LibraryPicker from '@/components/LibraryPicker'
import {
  BIO_TYPE_COLORS, BIO_TYPE_ICONS,
  COMPLEXITY_COLORS, EQUIPMENT_ICONS,
} from '@/lib/types'
import { useState, useRef } from 'react'
import {
  RefreshCw, Search, X, Save, Undo2, Minus, Plus,
  AlignLeft, ImageIcon, Trash2, ChevronDown, ChevronUp, CalendarPlus, GripVertical,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Movement {
  id: string; name: string; bioType: string; complexity: string
  equipment?: string | null; description?: string | null; videoUrl?: string | null
}
export interface WorkoutMovement {
  id: string; movementId: string; order: number
  sets?: number | null; reps?: string | null; rest?: number | null; duration?: number | null; movement: Movement
  blockId?: string | null
}
export interface WorkoutBlock {
  id: string; order: number; bioType?: string | null; instructions?: string | null; restAfter?: number | null; superset?: boolean
}
export interface Workout {
  id: string; name: string; createdAt: string
  duration?: number | null
  notes?: string | null; description?: string | null; imageUrl?: string | null
  blockRest?: number | null
  tags?: string | null
  movements: WorkoutMovement[]
  blocks: WorkoutBlock[]
}
export interface EditState { movementId: string; movement: Movement; sets: number; reps: string; duration: number | null }

// ─── Image zone (view) ────────────────────────────────────────────────────────
export function WorkoutImage({ src }: { src: string }) {
  return (
    <div style={{ marginBottom: 22, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
      <img src={src} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

// ─── Image zone (edit) ────────────────────────────────────────────────────────
export function ImageEditZone({ current, file, preview, onChange, onRemove }: {
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
export function MovementRowView({ wm, index, onMovementClick }: { wm: WorkoutMovement; index: number; onMovementClick: (id: string) => void }) {
  const m = wm.movement
  const hasSetsReps = wm.sets || wm.reps || wm.duration != null
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
            {m.equipment && (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{EQUIPMENT_ICONS[m.equipment] || '🔧'} {m.equipment}</span>
              </>
            )}
            {hasSetsReps && (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: wm.duration != null ? 'var(--blue)' : 'var(--text-primary)', background: 'var(--bg-elevated)', border: `1px solid ${wm.duration != null ? 'rgba(99,179,237,0.3)' : 'var(--border)'}`, borderRadius: 6, padding: '1px 8px' }}>
                  {wm.sets ?? '—'} × {wm.duration != null ? `${wm.duration}s` : (wm.reps ?? '—')}
                </span>
                {wm.rest != null && (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {wm.rest} min repos entre chaque série</span>
                  </>
                )}
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
export function MovementRowEdit({ es, original, index, displayNumber, allMovementIds, onUpdate, onRevert, onMovementClick, onRemove, onDragStart, onDragOver, onDrop, onDragEnd, isDragging }: {
  es: EditState; original: WorkoutMovement; index: number; displayNumber: number; allMovementIds: string[]
  onUpdate: (idx: number, patch: Partial<EditState>) => void; onRevert: (idx: number) => void
  onMovementClick: (id: string) => void; onRemove: () => void
  onDragStart: () => void; onDragOver: () => void; onDrop: () => void; onDragEnd: () => void
  isDragging: boolean
}) {
  const [loadingRandom, setLoadingRandom] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const m = es.movement
  const isDirtyMovement = es.movementId !== original.movementId
  const isDirtySets = es.sets !== (original.sets ?? 2)
  const isDirtyReps = es.reps !== (original.reps ?? '10')
  const isDirtyDuration = es.duration !== (original.duration ?? null)
  const isDirty = isDirtyMovement || isDirtySets || isDirtyReps || isDirtyDuration

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
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={e => { e.preventDefault(); onDragOver() }}
        onDrop={e => { e.preventDefault(); onDrop() }}
        onDragEnd={onDragEnd}
        style={{ background: isDirty ? 'var(--dirty)' : 'var(--bg-card)', border: `1px solid ${isDirty ? 'var(--dirty-border)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', transition: 'all 0.2s', opacity: isDragging ? 0.4 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: 'grab', flexShrink: 0 }} title="Glisser pour réordonner">
            <GripVertical size={14} />
          </div>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', flexShrink: 0 }}>{displayNumber}</div>
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
            <button onClick={onRemove} title="Supprimer ce mouvement"
              style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <Trash2 size={11} />
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
            <button
              onClick={() => onUpdate(index, es.duration != null ? { duration: null } : { duration: 45, reps: '' })}
              style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: es.duration != null ? 'rgba(99,179,237,0.12)' : 'var(--bg-elevated)', border: `1px solid ${(es.duration != null ? isDirtyDuration : isDirtyReps) ? 'var(--dirty-border)' : (es.duration != null ? 'rgba(99,179,237,0.4)' : 'var(--border)')}`, color: es.duration != null ? 'var(--blue)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
            >
              {es.duration != null ? '⏱ Durée' : '🔢 Reps'}
            </button>
            {es.duration != null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" min={5} max={600} value={es.duration ?? 45}
                    onChange={e => onUpdate(index, { duration: Number(e.target.value) })}
                    style={{ width: 60, background: isDirtyDuration ? 'var(--dirty)' : 'var(--bg-elevated)', border: `1px solid ${isDirtyDuration ? 'var(--dirty-border)' : 'rgba(99,179,237,0.4)'}`, borderRadius: 8, padding: '5px 8px', color: isDirtyDuration ? 'var(--dirty-text)' : 'var(--blue)', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>s</span>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[15, 20, 30, 45, 60, 90, 120].map(s => (
                    <button key={s} onClick={() => onUpdate(index, { duration: s })}
                      style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: es.duration === s ? 'rgba(99,179,237,0.2)' : 'var(--bg-elevated)', border: `1px solid ${es.duration === s ? 'rgba(99,179,237,0.5)' : 'var(--border)'}`, color: es.duration === s ? 'var(--blue)' : 'var(--text-dim)', cursor: 'pointer' }}>
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <input value={es.reps} onChange={e => onUpdate(index, { reps: e.target.value })}
                style={{ width: 80, background: isDirtyReps ? 'var(--dirty)' : 'var(--bg-elevated)', border: `1px solid ${isDirtyReps ? 'var(--dirty-border)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', color: isDirtyReps ? 'var(--dirty-text)' : 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center', transition: 'all 0.2s' }} />
            )}
          </div>
        </div>
      </div>
      {showPicker && (
        <LibraryPicker
          currentName={m.name}
          currentId={m.id}
          onPick={newM => { setShowPicker(false); onUpdate(index, { movementId: newM.id, movement: newM }) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ─── Block Header (view) ──────────────────────────────────────────────────────
export function BlockHeaderView({ block, index, movements, collapsed, onToggle }: {
  block: WorkoutBlock; index: number; movements: WorkoutMovement[]
  collapsed: boolean; onToggle: () => void
}) {
  const color = block.bioType ? BIO_TYPE_COLORS[block.bioType] : 'var(--text-muted)'
  const estMin = movements.reduce((sum, wm) => sum + (wm.sets ?? 2) * 1, 0)
  return (
    <div style={{ marginTop: index === 0 ? 0 : 10, marginBottom: collapsed ? 0 : 8 }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (!collapsed && block.instructions) ? 8 : 0, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {index + 1}</span>
          {block.bioType && (
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${color}14`, color, border: `1px solid ${color}30`, fontWeight: 600 }}>
              {BIO_TYPE_ICONS[block.bioType]} {block.bioType}
            </span>
          )}
          {block.superset && (
            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: 'var(--gold-ghost)', color: 'var(--gold)', border: '1px solid var(--gold-border)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ⚡ Superset
            </span>
          )}
          {movements.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtMin(estMin)}</span>
          )}
          <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </span>
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {!collapsed && block.instructions && (
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
export function BlockHeaderEdit({ block, index, instructions, onChange, superset, canSuperset, onToggleSuperset, isDirty, onRemove }: {
  block: WorkoutBlock; index: number; instructions: string; onChange: (v: string) => void
  superset: boolean; canSuperset: boolean; onToggleSuperset: () => void; isDirty: boolean; onRemove: () => void
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
        {canSuperset && (
          <button onClick={onToggleSuperset}
            title={superset ? 'Bloc en superset : enchaîner les mouvements sans repos entre eux' : 'Passer ce bloc en superset'}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, cursor: 'pointer',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              border: `1px solid ${superset ? 'var(--gold)' : 'var(--border)'}`,
              background: superset ? 'var(--gold-ghost)' : 'transparent',
              color: superset ? 'var(--gold)' : 'var(--text-dim)',
            }}>
            ⚡ Superset
          </button>
        )}
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <button onClick={onRemove} title="Supprimer ce bloc"
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <Trash2 size={13} />
        </button>
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
export function EditBar({ count, onSave, onCancel, saving }: {
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

// ─── Stepper ──────────────────────────────────────────────────────────────────
export function Stepper({ value, min, max, onChange, highlight }: { value: number; min: number; max: number; onChange: (v: number) => void; highlight?: boolean }) {
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

// ─── Add to week modal ────────────────────────────────────────────────────────
const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function getMonday(d: Date): Date {
  const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0, 0, 0, 0); return mon
}

export function AddToWeekModal({ workoutId, onClose, onAdded }: { workoutId: string; onClose: () => void; onAdded: () => void }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const weekStart = getMonday(new Date())
  const weekStartStr = weekStart.toISOString().split('T')[0]

  async function handleAdd() {
    if (selectedDay === null) return
    setSaving(true)
    await fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId, dayOfWeek: selectedDay, weekStart: weekStartStr }),
    })
    setSaving(false)
    onAdded()
    onClose()
  }

  const today = new Date().getDay() // 0=Sun, 1=Mon…
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div onClick={onClose} className="overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 380, padding: '24px', boxShadow: 'var(--elev-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarPlus size={16} color="var(--gold)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Ajouter à cette semaine</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {DAYS_FR.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, border: `1px solid ${selectedDay === i ? 'var(--gold)' : i === todayIdx ? 'var(--gold-border)' : 'var(--border)'}`, background: selectedDay === i ? 'var(--gold-ghost)' : 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}
            >
              <span style={{ fontWeight: 600, fontSize: 14, color: selectedDay === i ? 'var(--gold)' : 'var(--text-primary)', flex: 1 }}>{day}</span>
              {i === todayIdx && <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600 }}>Aujourd'hui</span>}
            </button>
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={selectedDay === null || saving}
          style={{ width: '100%', padding: '11px', background: selectedDay !== null ? 'var(--accent)' : 'var(--bg-elevated)', color: selectedDay !== null ? 'var(--on-accent)' : 'var(--text-dim)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: selectedDay !== null ? 'pointer' : 'default', transition: 'all 0.15s' }}
        >
          {saving ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

// ─── Stat ─────────────────────────────────────────────────────────────────────
export function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function toEditState(wm: WorkoutMovement): EditState {
  return { movementId: wm.movementId, movement: wm.movement, sets: wm.sets ?? 2, reps: wm.reps ?? '10', duration: wm.duration ?? null }
}
export function stripHtml(html: string) { return html.replace(/<[^>]*>/g, '').trim() }
export function fmtMin(min: number) {
  const r = Math.round(min)
  if (r < 60) return `~${r}min`
  const h = Math.floor(r / 60); const m = r % 60
  return m > 0 ? `~${h}h${m}min` : `~${h}h`
}
