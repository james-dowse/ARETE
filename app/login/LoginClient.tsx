'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const inputStyle = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--bg-elevated)',
  border: `1px solid ${err ? '#c47878' : 'var(--border)'}`,
  borderRadius: 10,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
})
const errorBox: React.CSSProperties = {
  background: 'rgba(196,120,120,0.12)', border: '1px solid rgba(196,120,120,0.3)',
  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c47878',
}

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error') === 'invalid_link'
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [relayed, setRelayed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (res.ok) { setRelayed(!!d.relayed); setStep('code') }
      else setError(d.error || 'Erreur inconnue')
    } catch { setError('Erreur réseau — réessaie.') }
    setLoading(false)
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const d = await res.json()
      if (res.ok) {
        const redirect = searchParams.get('redirect') || '/'
        router.push(redirect)
      } else setError(d.error || 'Code incorrect')
    } catch { setError('Erreur réseau — réessaie.') }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>ARETE</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
            {step === 'email'
              ? 'Entre ton adresse email : tu recevras un code de connexion.'
              : 'Saisis le code reçu par email.'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={requestCode} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {linkError && !error && (
              <div style={errorBox}>⏱ Ce lien de connexion est invalide ou expiré. Demande un nouveau code.</div>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ADRESSE EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" required autoFocus style={inputStyle(!!error)} />
            </div>
            {error && (
              <div style={errorBox}>
                {error === 'Adresse non reconnue'
                  ? '❌ Cette adresse n\'est pas encore enregistrée. Contacte l\'administrateur.'
                  : `❌ ${error}`}
              </div>
            )}
            <button type="submit" disabled={loading || !email.trim()}
              style={{ padding: '13px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'wait' : 'pointer', opacity: !email.trim() ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Envoi…' : 'Recevoir mon code'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
              {relayed
                ? <>Le code a été envoyé à l&apos;administrateur, qui va te le transmettre.</>
                : <>Code envoyé à <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Valable 15 min.</>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>CODE À 6 CHIFFRES</label>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required autoFocus
                style={{ ...inputStyle(!!error), textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: 10 }}
              />
            </div>
            {error && <div style={errorBox}>❌ {error}</div>}
            <button type="submit" disabled={loading || code.length < 6}
              style={{ padding: '13px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'wait' : 'pointer', opacity: code.length < 6 ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              ← Changer d&apos;email / renvoyer un code
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
