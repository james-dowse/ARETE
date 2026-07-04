'use client'
// Composants UI partagés — s'appuient sur les tokens et classes de globals.css.
// Zéro dépendance : styles inline pour les variations, classes pour les états hover/focus.
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, CSSProperties, useEffect } from 'react'

// ─── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'secondary', size = 'md', loading = false, children, className = '', disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span style={{
          width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
          border: '2px solid currentColor', borderTopColor: 'transparent',
          animation: 'spin 0.7s linear infinite',
        }} />
      )}
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  hero = false, interactive = false, children, style, className = '', ...rest
}: {
  hero?: boolean; interactive?: boolean; children: ReactNode
  style?: CSSProperties; className?: string; onClick?: () => void
}) {
  const base = hero ? 'card-hero' : 'card'
  return (
    <div
      className={`${base} ${interactive ? 'card-interactive' : ''} ${className}`}
      style={{ padding: 'var(--sp-5)', ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
// color : couleur de base (hex ou var CSS) — fond fantôme + texte teinté automatiques.
export function Badge({ color = 'var(--text-muted)', children, style }: {
  color?: string; children: ReactNode; style?: CSSProperties
}) {
  const isVar = color.startsWith('var(')
  return (
    <span
      className="badge"
      style={{
        color,
        background: isVar ? 'var(--bg-elevated)' : `${color}14`,
        border: `1px solid ${isVar ? 'var(--border)' : `${color}33`}`,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ onClose, children, maxWidth = 560 }: {
  onClose: () => void; children: ReactNode; maxWidth?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div
      className="overlay-in"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,6,2,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-in"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth, maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--elev-3)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, style }: {
  width?: number | string; height?: number | string; style?: CSSProperties
}) {
  return <div className="skeleton" style={{ width, height, ...style }} />
}

// ─── Anneau de progression SVG (chronos) ──────────────────────────────────────
export function ProgressRing({ progress, size = 120, stroke = 6, color = 'var(--gold)', track = 'var(--border)', children }: {
  progress: number // 0 → 1
  size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}
