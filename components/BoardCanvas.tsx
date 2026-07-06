'use client'
import { useRef, useState, useCallback } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import { VisionSlot } from '@/lib/visionBoard'

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface Props {
  slots: VisionSlot[]
  bgColor: string
  ratio: number // largeur / hauteur
  mode?: 'edit' | 'display'
  selectedId?: string | null
  gridStep?: number | null
  onChange?: (slots: VisionSlot[]) => void
  onSelect?: (id: string | null) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  style?: React.CSSProperties
  className?: string
}

const MIN_SIZE = 4

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
function snap(v: number, step: number | null | undefined) { return step ? Math.round(v / step) * step : Math.round(v * 10) / 10 }

export default function BoardCanvas({
  slots, bgColor, ratio, mode = 'display', selectedId, gridStep,
  onChange, onSelect, onEdit, onDelete, style, className,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const dragState = useRef<{
    id: string; handle: Handle; startX: number; startY: number
    rect: { x: number; y: number; w: number; h: number }
    canvasW: number; canvasH: number
  } | null>(null)
  const drawState = useRef<{ startX: number; startY: number; canvasW: number; canvasH: number } | null>(null)

  const editable = mode === 'edit'

  const pctFromEvent = useCallback((e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, w: r.width, h: r.height }
  }, [])

  const startDrag = (e: React.PointerEvent, slot: VisionSlot, handle: Handle) => {
    if (!editable) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const r = canvasRef.current!.getBoundingClientRect()
    dragState.current = {
      id: slot.id, handle, startX: e.clientX, startY: e.clientY,
      rect: { x: slot.x, y: slot.y, w: slot.w, h: slot.h },
      canvasW: r.width, canvasH: r.height,
    }
    onSelect?.(slot.id)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragState.current) {
      const d = dragState.current
      const dxPct = ((e.clientX - d.startX) / d.canvasW) * 100
      const dyPct = ((e.clientY - d.startY) / d.canvasH) * 100
      let { x, y, w, h } = d.rect

      if (d.handle === 'move') {
        x = clamp(d.rect.x + dxPct, 0, 100 - w)
        y = clamp(d.rect.y + dyPct, 0, 100 - h)
      } else {
        if (d.handle.includes('e')) w = clamp(d.rect.w + dxPct, MIN_SIZE, 100 - d.rect.x)
        if (d.handle.includes('s')) h = clamp(d.rect.h + dyPct, MIN_SIZE, 100 - d.rect.y)
        if (d.handle.includes('w')) {
          const newX = clamp(d.rect.x + dxPct, 0, d.rect.x + d.rect.w - MIN_SIZE)
          w = d.rect.w + (d.rect.x - newX)
          x = newX
        }
        if (d.handle.includes('n')) {
          const newY = clamp(d.rect.y + dyPct, 0, d.rect.y + d.rect.h - MIN_SIZE)
          h = d.rect.h + (d.rect.y - newY)
          y = newY
        }
      }
      x = snap(x, gridStep); y = snap(y, gridStep); w = snap(w, gridStep); h = snap(h, gridStep)
      onChange?.(slots.map(s => (s.id === d.id ? { ...s, x, y, w, h } : s)))
      return
    }
    if (drawState.current) {
      const p = pctFromEvent(e)
      const d = drawState.current
      const x0 = (d.startX / d.canvasW) * 100, y0 = (d.startY / d.canvasH) * 100
      setDraft({
        x: Math.min(x0, p.x), y: Math.min(y0, p.y),
        w: Math.abs(p.x - x0), h: Math.abs(p.y - y0),
      })
    }
  }

  const endDrag = () => {
    dragState.current = null
    if (drawState.current) {
      drawState.current = null
      if (draft && draft.w >= 3 && draft.h >= 3) {
        const newSlot: VisionSlot = {
          id: `tmp_${Date.now()}`, x: draft.x, y: draft.y, w: draft.w, h: draft.h,
          z: slots.length, type: 'empty',
        }
        onChange?.([...slots, newSlot])
        onSelect?.(newSlot.id)
      }
      setDraft(null)
    }
  }

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!editable || e.target !== canvasRef.current) return
    onSelect?.(null)
    const r = canvasRef.current!.getBoundingClientRect()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drawState.current = { startX: e.clientX - r.left, startY: e.clientY - r.top, canvasW: r.width, canvasH: r.height }
  }

  const handles: Handle[] = ['nw', 'ne', 'sw', 'se']
  const cursorFor: Record<Handle, string> = { move: 'move', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }

  return (
    <div
      ref={canvasRef}
      className={className}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerDown={onCanvasPointerDown}
      style={{
        position: 'relative', width: '100%', aspectRatio: String(ratio),
        background: bgColor, overflow: 'hidden', userSelect: 'none',
        containerType: 'inline-size', containerName: 'board',
        touchAction: editable ? 'none' : 'auto',
        cursor: editable ? 'crosshair' : 'default',
        ...style,
      } as React.CSSProperties}
    >
      {slots.map(slot => {
        const selected = editable && selectedId === slot.id
        return (
          <div
            key={slot.id}
            onPointerDown={e => startDrag(e, slot, 'move')}
            onDoubleClick={() => editable && onEdit?.(slot.id)}
            onClick={e => { if (editable) { e.stopPropagation(); onSelect?.(slot.id) } }}
            style={{
              position: 'absolute',
              left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%`,
              zIndex: slot.z,
              cursor: editable ? 'move' : 'default',
              boxShadow: selected ? '0 0 0 2px var(--gold, #C8A55F)' : editable && slot.type === 'empty' ? 'inset 0 0 0 1.5px rgba(0,0,0,0.18)' : 'none',
              outline: selected ? 'none' : editable && slot.type === 'empty' ? '1.5px dashed rgba(0,0,0,0.25)' : 'none',
              outlineOffset: -1.5,
              borderRadius: 4,
              overflow: 'hidden',
              background: slot.type === 'empty' && editable ? 'rgba(0,0,0,0.04)' : 'transparent',
            }}
          >
            <SlotContent slot={slot} />

            {editable && slot.type === 'empty' && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onEdit?.(slot.id) }}
                title="Ajouter un contenu"
                style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, color: 'inherit',
                }}
              >
                <Plus size={24} strokeWidth={1.5} />
              </button>
            )}

            {selected && (
              <>
                {slot.type !== 'empty' && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onEdit?.(slot.id) }}
                    title="Modifier le contenu"
                    style={{
                      position: 'absolute', top: 4, right: 28, width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(20,16,10,0.75)', color: '#fff', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    }}
                  >
                    <Pencil size={11} />
                  </button>
                )}
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onDelete?.(slot.id) }}
                  title="Supprimer l'emplacement"
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(20,16,10,0.75)', color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                  }}
                >
                  <X size={12} />
                </button>
                {handles.map(h => (
                  <div
                    key={h}
                    onPointerDown={e => startDrag(e, slot, h)}
                    style={{
                      position: 'absolute', width: 12, height: 12, borderRadius: '50%',
                      background: 'var(--gold, #C8A55F)', border: '2px solid #fff', zIndex: 1000,
                      cursor: cursorFor[h],
                      top: h.includes('n') ? -6 : undefined, bottom: h.includes('s') ? -6 : undefined,
                      left: h.includes('w') ? -6 : undefined, right: h.includes('e') ? -6 : undefined,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )
      })}

      {draft && (
        <div style={{
          position: 'absolute', left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%`,
          border: '1.5px dashed var(--gold, #C8A55F)', background: 'rgba(200,165,95,0.12)', pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

function SlotContent({ slot }: { slot: VisionSlot }) {
  if (slot.type === 'image' && slot.content) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={slot.content} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
  }
  if (slot.type === 'color' && slot.content) {
    return <div style={{ width: '100%', height: '100%', background: slot.content }} />
  }
  if (slot.type === 'text') {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: slot.align === 'left' ? 'flex-start' : slot.align === 'right' ? 'flex-end' : 'center',
        textAlign: (slot.align as 'left' | 'center' | 'right') || 'center',
        padding: '3cqw', overflow: 'hidden',
      }}>
        <div style={{
          color: slot.color || '#12100C',
          fontSize: `${slot.fontSize || 5}cqw`,
          fontWeight: slot.fontWeight === 'bold' ? 800 : 400,
          fontFamily: 'var(--font-display, serif)',
          lineHeight: 1.15,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          pointerEvents: 'none',
        }}>
          {slot.content}
        </div>
      </div>
    )
  }
  return null
}
