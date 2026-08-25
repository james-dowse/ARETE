'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, UserPlus, UserCheck, Bell, BellOff } from 'lucide-react'
import { COMPLEXITY_COLORS, computeWorkoutDifficulty } from '@/lib/types'
import CreatorBadge, { creatorName } from '@/components/CreatorBadge'

interface ProfileUser { id: string; firstName: string | null; lastName: string | null; bio: string | null; avatarUrl: string | null }
interface ProfileWorkout {
  id: string; name: string; createdAt: string; duration: number | null
  imageUrl: string | null; imagePosition: string | null
  movements: { movement: { complexity: string } }[]
}
interface ProfileData {
  user: ProfileUser
  workouts: ProfileWorkout[]
  isFollowing: boolean
  notifyByEmail: boolean
  isSelf: boolean
}

const fmtMin = (min: number) => min < 60 ? `~${min}min` : `~${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`

export default function UserProfileClient({ userId }: { userId: string }) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [following, setFollowing] = useState(false)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(async r => {
      if (!r.ok) { setNotFound(true); return }
      const d: ProfileData = await r.json()
      setData(d)
      setFollowing(d.isFollowing)
      setNotify(d.notifyByEmail)
    })
  }, [userId])

  async function handleToggleFollow() {
    setBusy(true)
    await fetch(`/api/users/${userId}/follow`, { method: following ? 'DELETE' : 'POST' })
    setFollowing(!following)
    setBusy(false)
  }

  async function handleToggleNotify() {
    const next = !notify
    setNotify(next)
    await fetch(`/api/users/${userId}/follow`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyByEmail: next }),
    })
  }

  if (notFound) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Profil introuvable.</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</div>

  const { user, workouts, isSelf } = data
  const name = creatorName(user)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
        <CreatorBadge user={user} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{name}</div>
          {user.bio && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{user.bio}</div>}
        </div>
        {!isSelf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {following && (
              <button onClick={handleToggleNotify} title={notify ? 'Désactiver les notifications' : 'Activer les notifications'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: notify ? 'var(--gold)' : 'var(--text-muted)', cursor: 'pointer' }}>
                {notify ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            )}
            <button onClick={handleToggleFollow} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: following ? 'var(--bg-elevated)' : 'var(--gold)', border: `1px solid ${following ? 'var(--border)' : 'var(--gold)'}`, borderRadius: 9, color: following ? 'var(--text-primary)' : 'var(--ink)', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
              {following ? 'Abonné' : "S'abonner"}
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 0.6, marginBottom: 10 }}>
        WORKOUTS PUBLIÉS ({workouts.length})
      </div>
      {workouts.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun workout publié pour l&apos;instant.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {workouts.map(w => {
            const difficulty = computeWorkoutDifficulty(w.movements.map(m => ({ complexity: m.movement.complexity })))
            return (
              <Link key={w.id} href={`/workouts/${w.id}`} className="card card-interactive"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--r-md)', textDecoration: 'none' }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {w.imageUrl ? (
                    <img src={w.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: w.imagePosition || '50% 50%', display: 'block' }} />
                  ) : (
                    <img src="/logo.svg" alt="" style={{ width: '40%', height: '40%', objectFit: 'contain', opacity: 0.18, display: 'block' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {new Date(w.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    {w.duration && <><Clock size={11} /> {fmtMin(w.duration)}</>}
                  </div>
                </div>
                {difficulty && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: `${COMPLEXITY_COLORS[difficulty]}18`, color: COMPLEXITY_COLORS[difficulty], border: `1px solid ${COMPLEXITY_COLORS[difficulty]}40`, flexShrink: 0 }}>{difficulty}</span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
