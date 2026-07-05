'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const MAX_AGE_MS = 24 * 60 * 60 * 1000

interface ActiveSession { id: string; name: string | null; startedAt: number; doneSets: number }

// Bannière "Séance en cours — reprendre" basée sur l'état persisté en localStorage.
// Sans workoutId : scanne toutes les séances (dashboard). Avec workoutId : seulement celle-là.
export default function ResumeSessionBanner({ workoutId }: { workoutId?: string }) {
  const [session, setSession] = useState<ActiveSession | null>(null)

  useEffect(() => {
    const found: { id: string; startedAt: number; doneSets: number }[] = []
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('arete_active_')) continue
      const id = key.slice('arete_active_'.length)
      if (workoutId && id !== workoutId) continue
      try {
        const s = JSON.parse(localStorage.getItem(key) ?? '')
        if (s?.startedAt && Date.now() - s.startedAt < MAX_AGE_MS) {
          const doneSets = Object.values((s.done ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0)
          found.push({ id, startedAt: s.startedAt, doneSets })
        } else {
          stale.push(key)
        }
      } catch {}
    }
    stale.forEach(k => localStorage.removeItem(k))
    if (found.length === 0) return
    const latest = found.sort((a, b) => b.startedAt - a.startedAt)[0]
    setSession({ ...latest, name: null })
    fetch(`/api/workouts/${latest.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(w => { if (w?.name) setSession(s => (s && s.id === latest.id ? { ...s, name: w.name } : s)) })
      .catch(() => {})
  }, [workoutId])

  if (!session) return null
  const min = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000))

  return (
    <Link href={`/workouts/${session.id}/active`} style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
      <div className="panel-ivory" style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        cursor: 'pointer',
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }} className="resume-pulse">⏱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            Séance en cours{session.name ? ` — ${session.name}` : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
            Démarrée il y a {min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`} · {session.doneSets} série{session.doneSets > 1 ? 's' : ''} faite{session.doneSets > 1 ? 's' : ''}
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#0E0C08', background: 'linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 100%)', borderRadius: 'var(--r-sm)', padding: '9px 16px', letterSpacing: 0.3, boxShadow: '0 2px 0 rgba(14,12,8,0.25)' }}>
          Reprendre →
        </span>
      </div>
      <style>{`
        @keyframes resumePulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
        .resume-pulse { animation: resumePulse 1.6s ease-in-out infinite; }
      `}</style>
    </Link>
  )
}
