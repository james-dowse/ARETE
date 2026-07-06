'use client'
import { useRef, useState } from 'react'
import { Image as ImageIcon, Type, Palette, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react'
import { Modal, Button } from './ui'
import { VisionSlot, SWATCHES } from '@/lib/visionBoard'

type Tab = 'image' | 'text' | 'color'

export default function VisionSlotModal({ slot, onSave, onClose }: {
  slot: VisionSlot
  onSave: (patch: Partial<VisionSlot>) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>(slot.type === 'empty' ? 'image' : (slot.type as Tab))
  const [image, setImage] = useState<string | null>(slot.type === 'image' ? slot.content ?? null : null)
  const [text, setText] = useState(slot.type === 'text' ? slot.content ?? '' : '')
  const [textColor, setTextColor] = useState(slot.color || '#12100C')
  const [fontSize, setFontSize] = useState(slot.fontSize || 5)
  const [bold, setBold] = useState(slot.fontWeight === 'bold')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>((slot.align as 'left' | 'center' | 'right') || 'center')
  const [color, setColor] = useState(slot.type === 'color' ? slot.content || SWATCHES[0] : SWATCHES[0])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const save = () => {
    if (tab === 'image') {
      if (!image) return
      onSave({ type: 'image', content: image, color: null, fontSize: null, fontWeight: null, align: null })
    } else if (tab === 'text') {
      if (!text.trim()) return
      onSave({ type: 'text', content: text, color: textColor, fontSize, fontWeight: bold ? 'bold' : 'normal', align })
    } else {
      onSave({ type: 'color', content: color, color: null, fontSize: null, fontWeight: null, align: null })
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div style={{ padding: 'var(--sp-6)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, fontFamily: 'var(--font-display)' }}>Contenu de l&apos;emplacement</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: 4 }}>
          {[{ id: 'image', label: 'Image', icon: ImageIcon }, { id: 'text', label: 'Texte', icon: Type }, { id: 'color', label: 'Couleur', icon: Palette }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 'var(--r-xs)', border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--gold)' : 'transparent',
                color: tab === t.id ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: 13,
              }}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'image' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
              style={{
                aspectRatio: '4/3', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--border-plus)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                overflow: 'hidden', background: 'var(--bg-elevated)',
              }}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  <ImageIcon size={22} style={{ marginBottom: 6 }} />
                  <div>Cliquez ou glissez une image</div>
                </div>
              )}
            </div>
            {image && <Button size="sm" variant="ghost" style={{ marginTop: 10 }} onClick={() => setImage(null)}>Retirer l&apos;image</Button>}
          </div>
        )}

        {tab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Votre citation, objectif, mot-clé…"
              rows={3}
              className="input"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ width: 34, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
              <button onClick={() => setBold(b => !b)} title="Gras" style={{
                width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${bold ? 'var(--gold)' : 'var(--border)'}`,
                background: bold ? 'var(--gold-ghost)' : 'var(--bg-elevated)', color: bold ? 'var(--gold)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Bold size={15} /></button>
              {[{ v: 'left', I: AlignLeft }, { v: 'center', I: AlignCenter }, { v: 'right', I: AlignRight }].map(({ v, I }) => (
                <button key={v} onClick={() => setAlign(v as 'left' | 'center' | 'right')} style={{
                  width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${align === v ? 'var(--gold)' : 'var(--border)'}`,
                  background: align === v ? 'var(--gold-ghost)' : 'var(--bg-elevated)', color: align === v ? 'var(--gold)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><I size={15} /></button>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Taille du texte</label>
              <input type="range" min={2} max={16} step={0.5} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {tab === 'color' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
              {SWATCHES.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  aspectRatio: '1', borderRadius: 'var(--r-sm)', background: c, cursor: 'pointer',
                  border: color === c ? '3px solid var(--gold)' : '1px solid rgba(0,0,0,0.15)',
                }} />
              ))}
            </div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>Appliquer</Button>
        </div>
      </div>
    </Modal>
  )
}
