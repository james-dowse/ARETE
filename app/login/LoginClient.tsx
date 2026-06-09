'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (res.ok) {
      router.push(redirect || '/')
    } else {
      const d = await res.json()
      setError(d.error || 'Erreur inconnue')
      setLoading(false)
    }
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
            Entre ton adresse email pour accéder à ton espace.
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
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
            {loading ? 'Connexion…' : 'Accéder à mon espace'}
          </button>
        </form>
      </div>
    </div>
  )
}
