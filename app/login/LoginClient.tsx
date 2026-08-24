'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

const inputStyle = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--bg-elevated)',
  border: `1px solid ${err ? 'var(--crimson)' : 'var(--border)'}`,
  padding: '13px 14px',
  color: 'var(--text-primary)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
})
const errorBox: React.CSSProperties = {
  background: 'var(--crimson-ghost)', border: '1px solid var(--crimson-border)',
  padding: '10px 14px', fontSize: 13, color: 'var(--crimson-bright)',
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
    <div style={{
      position: 'relative', width: '100vw', minHeight: '100dvh', flexGrow: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', padding: '24px 16px', boxSizing: 'border-box',
      background: 'radial-gradient(120% 90% at 50% -10%, rgba(201,165,53,0.10), transparent 55%), radial-gradient(100% 80% at 50% 118%, rgba(180,85,45,0.16), transparent 62%), var(--bg-primary)',
    }}>
      {/* Logo en filigrane, très grand, débordant en bas */}
      <svg style={{ position: 'absolute', left: '50%', bottom: -220, transform: 'translateX(-50%)', pointerEvents: 'none' }} width="560" height="560" viewBox="0 0 100 100" fill="none" opacity={0.05}>
        <circle cx="50" cy="50" r="40" stroke="var(--gold)" strokeWidth="4.5" />
        <line x1="50" y1="14" x2="19" y2="74" stroke="var(--gold)" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="50" y1="14" x2="81" y2="74" stroke="var(--gold)" strokeWidth="4.5" strokeLinecap="round" />
      </svg>

      <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Image src="/logo.svg" alt="" width={52} height={52} priority style={{ opacity: 0.95 }} />
          <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: '0.30em', color: 'var(--gold)' }}>ARETE</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13.5, lineHeight: 1.5, maxWidth: 280 }}>
            {step === 'email'
              ? 'Entre ton adresse email : tu recevras un code de connexion.'
              : 'Saisis le code reçu par email.'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={requestCode} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {linkError && !error && (
              <div style={errorBox}>⏱ Ce lien de connexion est invalide ou expiré. Demande un nouveau code.</div>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.03em', display: 'block', marginBottom: 8 }}>Adresse email</label>
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px', background: 'var(--crimson)', color: '#F8F4EC', border: 'none', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'wait' : 'pointer', opacity: !email.trim() ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Envoi…' : 'Recevoir mon code'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
              {relayed
                ? <>Le code a été envoyé à l&apos;administrateur, qui va te le transmettre.</>
                : <>Code envoyé à <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Valable 15 min.</>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.03em', display: 'block', marginBottom: 8, textAlign: 'center' }}>Code à 6 chiffres</label>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required autoFocus
                style={{ ...inputStyle(!!error), textAlign: 'center', fontSize: 26, fontWeight: 800, letterSpacing: 10, fontFamily: 'var(--font-display), Georgia, serif' }}
              />
            </div>
            {error && <div style={errorBox}>❌ {error}</div>}
            <button type="submit" disabled={loading || code.length < 6}
              style={{ padding: '15px', background: 'var(--crimson)', color: '#F8F4EC', border: 'none', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'wait' : 'pointer', opacity: code.length < 6 ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer' }}>
              ← Changer d&apos;email / renvoyer un code
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
