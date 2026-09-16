'use client'
import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

// Menu « … » pour les actions secondaires.
//
// Les cartouches de séance alignaient sept actions de même poids visuel
// (favori, recommander, démarrer, planning, dupliquer, modifier, supprimer) :
// sur 375 px la rangée débordait et l'action principale était indiscernable
// des autres. Une seule action primaire reste en clair, le reste passe ici.

export interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  /** Rend l'entrée en rouge (suppression). */
  danger?: boolean
  disabled?: boolean
}

export default function OverflowMenu({ items, label = 'Plus d’actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        title={label}
        aria-label={label}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 'var(--r-sm)',
          background: open ? 'var(--bg-elevated)' : 'none',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)', cursor: 'pointer',
          transition: 'background var(--t-fast) var(--ease)',
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 40,
            minWidth: 186, padding: 5,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-plus)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--elev-3)',
            display: 'flex', flexDirection: 'column', gap: 1,
          }}
        >
          {items.map(item => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); item.onClick() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 'var(--r-xs)',
                background: 'none', border: 'none', textAlign: 'left',
                fontSize: 13, fontWeight: 500,
                color: item.danger ? 'var(--red)' : 'var(--text-primary)',
                cursor: item.disabled ? 'default' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                transition: 'background var(--t-fast) var(--ease)',
              }}
              onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = item.danger ? 'var(--red-ghost)' : 'var(--bg-card)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ display: 'flex', width: 15, color: item.danger ? 'var(--red)' : 'var(--text-muted)' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
