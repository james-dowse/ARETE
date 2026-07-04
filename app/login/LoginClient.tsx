'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginClient() {
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error') === 'invalid_link'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<null | { relayed: boolean }>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (res.ok) {
        setSent({ relayed: !!d.relayed })
      } else {
        setError(d.error || 'Erreur inconnue')
      }
    } catch {
      setError('Erreur réseau — réessaie.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / titre */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>ARETE</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
            {sent ? 'Un lien de connexion vient de partir.' : 'Entre ton adresse email : tu recevras un lien de connexion.'}
          </p>
        </div>

        {sent ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 28,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>📩</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
              {sent.relayed ? 'Lien transmis à l\'administrateur' : 'Vérifie ta boîte mail'}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              {sent.relayed
                ? 'Ton lien de connexion a été envoyé à l\'administrateur, qui va te le transmettre. Il est valable 15 minutes.'
                : <>Un lien de connexion a été envoyé à <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Il est valable 15 minutes.</>}
            </p>
            <button
              onClick={() => setSent(null)}
              style={{ marginTop: 20, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
            >
              ← Renvoyer un lien
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {linkError && !error && (
              <div style={{
                background: 'rgba(196,120,120,0.12)',
                border: '1px solid rgba(196,120,120,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#c47878',
              }}>
                ⏱ Ce lien de connexion est invalide ou expiré. Demande-en un nouveau.
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                ADRESSE EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                autoFocus
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${error ? '#c47878' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(196,120,120,0.12)',
                border: '1px solid rgba(196,120,120,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#c47878',
              }}>
                {error === 'Adresse non reconnue'
                  ? '❌ Cette adresse n\'est pas encore enregistrée. Contacte l\'administrateur.'
                  : `❌ ${error}`}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                padding: '13px',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? 'wait' : 'pointer',
                opacity: !email.trim() ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Envoi…' : 'Recevoir mon lien de connexion'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
