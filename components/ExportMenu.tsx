'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Monitor, Smartphone, Printer, FileText } from 'lucide-react'
import { VisionBoard } from '@/lib/visionBoard'
import { renderBoardToCanvas, canvasToPngDownload, downloadBoardAsPdf, printResolutionPx } from '@/lib/exportBoard'

function slugify(name: string) {
  return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'vision-board'
}

export default function ExportMenu({ board, compact = false }: { board: VisionBoard; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const slug = slugify(board.name)

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    try { await fn() } catch (err) { console.error('[export]', err) } finally { setBusy(null); setOpen(false) }
  }

  const exportPng = (widthPx: number, key: string, suffix: string) => run(key, async () => {
    const canvas = await renderBoardToCanvas(board, widthPx)
    canvasToPngDownload(canvas, `${slug}-${suffix}.png`)
  })

  const options = [
    { key: 'screen', icon: Monitor, label: 'Image écran (1920 px)', run: () => exportPng(1920, 'screen', 'ecran') },
    { key: 'wallpaper', icon: Smartphone, label: "Fond d'écran (2160 px)", run: () => exportPng(2160, 'wallpaper', 'fond-ecran') },
    { key: 'hires', icon: Printer, label: 'Image haute résolution (300 dpi)', run: () => exportPng(printResolutionPx(board), 'hires', 'hd') },
    { key: 'pdf', icon: FileText, label: 'PDF (format papier)', run: () => run('pdf', () => downloadBoardAsPdf(board, `${slug}.pdf`)) },
  ]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Télécharger"
        style={compact ? {
          width: 28, height: 28, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        } : {
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}
      >
        <Download size={compact ? 14 : 14} /> {!compact && 'Télécharger'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, zIndex: 100, minWidth: 250,
          background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-md)',
          boxShadow: 'var(--elev-3)', overflow: 'hidden', padding: 6,
        }}>
          {options.map(opt => (
            <button
              key={opt.key}
              onClick={() => opt.run()}
              disabled={!!busy}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                borderRadius: 'var(--r-xs)', border: 'none', background: 'none', cursor: busy ? 'default' : 'pointer',
                color: 'var(--text-primary)', fontSize: 13, textAlign: 'left',
              }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--gold-ghost)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              {busy === opt.key ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <opt.icon size={14} style={{ color: 'var(--gold)' }} />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
