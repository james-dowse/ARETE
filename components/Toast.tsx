'use client'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; variant: ToastVariant }

const VARIANT_STYLE: Record<ToastVariant, { bg: string; color: string; border: string }> = {
  success: { bg: 'var(--green)', color: 'var(--ink, #0E0C08)', border: 'transparent' },
  error:   { bg: 'var(--bg-elevated)', color: 'var(--red)', border: 'var(--red)' },
  info:    { bg: 'var(--bg-elevated)', color: 'var(--accent)', border: 'var(--accent)' },
}

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null)

// Toast global unique pour toute l'app — remplace les implémentations ad-hoc
// dupliquées (WorkoutsTabs, planner, AdminClient×2). Empilable, auto-dismiss.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++
    setItems(prev => [...prev, { id, message, variant }])
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), variant === 'error' ? 4500 : 3200)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
        pointerEvents: 'none', width: 'max-content', maxWidth: 'calc(100vw - 32px)',
      }}>
        {items.map(t => {
          const s = VARIANT_STYLE[t.variant]
          return (
            <div key={t.id} className="toast-in" style={{
              background: s.bg, color: s.color, fontWeight: 700, fontSize: 13,
              padding: '10px 22px', borderRadius: 10, border: `1px solid ${s.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', maxWidth: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .toast-in { animation: toastIn 0.2s ease; }
      `}</style>
    </ToastContext.Provider>
  )
}

// useToast()('Message') ; useToast()('Erreur', 'error')
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
