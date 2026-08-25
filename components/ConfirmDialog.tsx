'use client'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  danger?: boolean          // rouge pour une action destructrice (suppression), or sinon
  confirmLabel?: string
  cancelLabel?: string
}
interface ConfirmState extends ConfirmOptions {
  message: string
  resolve: (ok: boolean) => void
}

const ConfirmContext = createContext<((message: string, options?: ConfirmOptions) => Promise<boolean>) | null>(null)

// Remplace window.confirm() par une modale au thème de l'app — la boîte
// système (grise, hors-charte) casse l'identité ambre/basalte à chaque
// suppression. Usage : const confirm = useConfirm(); if (await confirm('…')) { ... }
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirmFn = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
      setState({ message, resolve, ...options })
    })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      {state && (
        <div onClick={() => close(false)} className="overlay-in" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,6,2,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: 'var(--bg-card)', border: `1px solid ${state.danger ? 'rgba(192,57,43,0.35)' : 'var(--gold-border)'}`, borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 400, padding: '24px 24px 20px', boxShadow: 'var(--elev-3)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: state.danger ? 'rgba(192,57,43,0.12)' : 'var(--gold-ghost)' }}>
                <AlertTriangle size={16} color={state.danger ? 'var(--red)' : 'var(--gold)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                {state.title && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{state.title}</div>}
                <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{state.message}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => close(false)} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {state.cancelLabel ?? 'Annuler'}
              </button>
              <button onClick={() => close(true)} style={{
                padding: '9px 16px', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: state.danger ? 'var(--red)' : 'var(--gold)', color: state.danger ? '#fff' : 'var(--ink)',
              }}>
                {state.confirmLabel ?? (state.danger ? 'Supprimer' : 'Confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// await useConfirm()('Supprimer cette séance ?', { danger: true })
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm doit être utilisé dans <ConfirmProvider>')
  return ctx
}
