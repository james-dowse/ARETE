import AppShell from '@/components/AppShell'
import ResumeSessionBanner from '@/components/ResumeSessionBanner'
import { prisma } from '@/lib/prisma'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'
import { syncAttributesFromDb } from '@/lib/attributes-server'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const WEEK_GOAL = 5

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bonjour'
  if (hour >= 12 && hour < 18) return 'Bon après-midi'
  if (hour >= 18 && hour < 22) return 'Bonsoir'
  return 'Bonne nuit'
}

function formatDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).toUpperCase()
}

function getDisplayName(email: string): string {
  return email.split('@')[0].split('.')[0].toUpperCase()
}

// Date du jour et lundi de la semaine côté Europe/Paris (le serveur tourne en UTC).
// Le planner stocke weekStart = date ISO du lundi minuit local → selon le fuseau du
// client au moment de l'enregistrement, ça donne le lundi OU le dimanche en UTC ;
// on interroge donc les deux variantes.
function parisWeekInfo() {
  const parisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const day = parisNow.getDay() // 0=Dim … 6=Sam
  const dayIdx = (day + 6) % 7 // 0=Lun … 6=Dim (convention planner)
  const monday = new Date(parisNow)
  monday.setDate(parisNow.getDate() + (day === 0 ? -6 : 1 - day))
  const iso = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  const mondayUTC = new Date(iso)
  const sundayUTC = new Date(mondayUTC.getTime() - 86400000)
  return { dayIdx, weekStartCandidates: [sundayUTC, mondayUTC], weekBegin: sundayUTC }
}

function parisDateKey(d: Date): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) // YYYY-MM-DD
}

// Nombre de jours consécutifs (jusqu'à aujourd'hui inclus) avec au moins une séance faite.
function computeStreak(doneAtDates: Date[]): number {
  const days = new Set(doneAtDates.map(parisDateKey))
  const todayKey = parisDateKey(new Date())
  let cursor = new Date()
  let streak = 0
  // Si rien fait aujourd'hui, le streak part d'hier (on ne casse pas le streak avant la fin de la journée).
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1)
  }
  for (let i = 0; i < 60; i++) {
    const key = parisDateKey(cursor)
    if (days.has(key)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  margin: 0,
}

const SECTION_LABEL_GOLD: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase' as const,
  color: 'var(--gold-dim)',
  margin: 0,
}

export default async function DashboardPage() {
  await syncAttributesFromDb()
  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const dateStr = formatDate()

  const user = await getCurrentUser()
  const displayName = user
    ? (user.firstName?.trim() || getDisplayName(user.email))
    : null

  const [movementCount, workoutCount, templateCount, bioStats] = await Promise.all([
    prisma.movement.count(),
    prisma.workout.count(),
    prisma.workoutTemplate.count(),
    prisma.movement.groupBy({ by: ['bioType'], _count: true }),
  ])

  const monthBegin = new Date()
  monthBegin.setDate(1)
  monthBegin.setHours(0, 0, 0, 0)
  const streakWindowBegin = new Date()
  streakWindowBegin.setDate(streakWindowBegin.getDate() - 60)

  const [recentSessions, streakSessions, monthSessions] = user
    ? await Promise.all([
        prisma.workoutSession.findMany({
          where: { userId: user.id },
          take: 5,
          orderBy: { doneAt: 'desc' },
          include: { workout: { select: { id: true, name: true, duration: true, movements: { select: { movement: { select: { bioType: true } } } } } } },
        }).catch(() => []),
        prisma.workoutSession.findMany({
          where: { userId: user.id, doneAt: { gte: streakWindowBegin } },
          select: { doneAt: true },
        }).catch(() => []),
        prisma.workoutSession.findMany({
          where: { userId: user.id, doneAt: { gte: monthBegin } },
          include: { workout: { select: { duration: true } } },
        }).catch(() => []),
      ])
    : [[], [], []]

  const streak = computeStreak(streakSessions.map(s => s.doneAt))
  const monthMinutes = monthSessions.reduce((sum, s) => sum + (s.workout?.duration || 0), 0)
  const monthHours = Math.round(monthMinutes / 60)

  // Séance(s) prévue(s) aujourd'hui (planner) + nombre de séances cette semaine
  const { dayIdx, weekStartCandidates, weekBegin } = parisWeekInfo()
  const [todayPlan, weekSessionCount] = user
    ? await Promise.all([
        prisma.weekPlan.findFirst({
          where: { userId: user.id, weekStart: { in: weekStartCandidates } },
          include: {
            entries: {
              where: { dayOfWeek: dayIdx },
              orderBy: { order: 'asc' },
              include: { workout: { select: { id: true, name: true, duration: true, movements: { select: { id: true, movement: { select: { bioType: true } } } } } } },
            },
          },
        }).catch(() => null),
        prisma.workoutSession.count({ where: { userId: user.id, doneAt: { gte: weekBegin } } }).catch(() => 0),
      ])
    : [null, 0]
  const todayEntries = todayPlan?.entries ?? []
  const heroEntry = todayEntries[0]

  const maxBio = Math.max(...bioStats.map(s => s._count), 1)

  // Ring hebdo : circonférence r=40 → 2πr ≈ 251.2
  const ringCirc = 251.2
  const ringPct = Math.min(weekSessionCount / WEEK_GOAL, 1)
  const ringDash = `${(ringCirc * ringPct).toFixed(1)} ${ringCirc.toFixed(1)}`

  const heroBioTypes = heroEntry
    ? Array.from(new Set(heroEntry.workout.movements.map(m => m.movement.bioType))).slice(0, 3)
    : []

  return (
    <AppShell>
      <div style={{ maxWidth: 1040 }}>

        <ResumeSessionBanner />

        {/* ── Hero : séance du jour ────────────────────────────────── */}
        <div className="hero-today" style={{
          position: 'relative',
          background: 'linear-gradient(115deg, #0A0908 0%, #1a0708 55%, #9E1316 160%)',
          borderBottom: '1px solid var(--gold-border)',
          padding: '28px 32px 32px 32px',
          marginBottom: 32,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minHeight: 380,
        }}>
          {/* losanges décoratifs */}
          <div style={{ position: 'absolute', top: -80, right: -60, width: 480, height: 480, border: '1px solid rgba(200,165,95,0.10)', transform: 'rotate(45deg)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -40, right: -20, width: 400, height: 400, border: '1px solid rgba(200,165,95,0.07)', transform: 'rotate(45deg)', pointerEvents: 'none' }} />

          {/* ligne du haut : date + salutation / ring */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#BBB093' }}>{dateStr}</span>
              <span className="display" style={{ fontSize: 26, fontWeight: 600, color: '#EFEAD9', textTransform: 'none', letterSpacing: 'normal' }}>
                {greeting}{displayName && <span style={{ color: 'var(--gold)' }}> {displayName}</span>}
              </span>
            </div>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                  <svg width="76" height="76" viewBox="0 0 92 92">
                    <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(223,216,194,0.12)" strokeWidth="5" />
                    <circle cx="46" cy="46" r="40" fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray={ringDash} transform="rotate(-90 46 46)" />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 76, height: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="display tnum" style={{ fontSize: 22, color: '#EFEAD9', lineHeight: 1 }}>
                      {weekSessionCount}<span style={{ color: '#8A8270', fontSize: 14 }}>/{WEEK_GOAL}</span>
                    </span>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB093' }}>semaine</span>
                  </div>
                </div>
                <Link href="/profile" title="Mon profil" style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="avatar-btn" style={{
                    width: 44, height: 44, borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'var(--bg-elevated)',
                    border: '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: 'var(--gold)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || user.email[0].toUpperCase()
                    }
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* corps : eyebrow + titre + meta + CTA */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 2, background: 'var(--crimson-bright)' }} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--red)' }}>
                {heroEntry ? 'Séance du jour · Planifiée' : 'Aucune séance planifiée'}
              </span>
            </div>

            <h1 className="display hero-title" style={{ margin: 0, fontSize: 60, color: '#EFEAD9' }}>
              {heroEntry ? heroEntry.workout.name : 'Forge ta séance'}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              {heroEntry && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BBB093" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#DFD8C2' }}>{heroEntry.workout.duration ? `${heroEntry.workout.duration} min` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BBB093" strokeWidth="2" strokeLinecap="round"><path d="M4 9 v6 M20 9 v6 M7 7 v10 M17 7 v10 M7 12 h10" /></svg>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#DFD8C2' }}>{heroEntry.workout.movements.length} mouvements</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {heroBioTypes.map(bt => (
                      <span key={bt} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', border: `1px solid ${BIO_TYPE_COLORS[bt] || 'rgba(200,165,95,0.4)'}` , color: BIO_TYPE_COLORS[bt] || 'var(--gold)' }}>
                        {bt}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div style={{ flexGrow: 1 }} />
              <Link href={heroEntry ? `/workouts/${heroEntry.workout.id}/active` : '/generator'} style={{ textDecoration: 'none' }}>
                <div className="cta-crimson" style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--crimson)',
                  padding: '16px 36px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 32px rgba(158,19,22,0.4)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#F1EAD8"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  <span className="display" style={{ fontSize: 20, color: '#F1EAD8' }}>
                    {heroEntry ? 'Au combat' : 'Forger une séance'}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────── */}
        <div className="r-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginBottom: 40, background: 'var(--border)' }}>
          {[
            { value: workoutCount, label: 'Séances', gold: false },
            { value: streak, label: "Jours d'affilée", gold: true },
            { value: movementCount, label: 'Mouvements', gold: false },
            { value: user ? monthHours : templateCount, label: user ? 'Heures ce mois-ci' : 'Templates', gold: false },
          ].map(({ value, label, gold }) => (
            <div key={label} className="r-stat-cell" style={{
              background: 'var(--bg-card)',
              padding: '24px 28px',
              borderTop: gold ? `2px solid var(--gold)` : '2px solid transparent',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)',
            }}>
              <div className="display r-stat-num tnum" style={{ fontSize: 44, lineHeight: 1, color: gold ? 'var(--gold)' : 'var(--text-primary)' }}>
                {value}
              </div>
              <div style={{ ...SECTION_LABEL, marginTop: 10, color: 'var(--text-muted)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Corps 2 colonnes ─────────────────────────────────── */}
        <div className="r-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Campagnes récentes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={SECTION_LABEL_GOLD}>Campagnes récentes</p>
              {recentSessions.length > 0 && (
                <Link href="/workouts" style={{ fontSize: 13, color: 'var(--gold-dim)', textDecoration: 'none', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>
                  Tout voir →
                </Link>
              )}
            </div>

            {recentSessions.length > 0 ? (
              <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
                {recentSessions.map((s, i) => {
                  const bioTypes = Array.from(new Set(s.workout.movements.map(m => m.movement.bioType)))
                  const dominant = bioTypes[0]
                  const barColor = BIO_TYPE_COLORS[dominant] || 'var(--gold)'
                  const doneStr = new Date(s.doneAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                  return (
                    <Link key={s.id} href={`/workouts/${s.workout.id}`} style={{ textDecoration: 'none' }}>
                      <div className="workout-row" style={{
                        padding: '14px 20px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        transition: 'background 0.15s', cursor: 'pointer',
                      }}>
                        <div style={{ width: 3, height: 28, background: barColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.workout.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {doneStr}{s.workout.duration ? ` · ${s.workout.duration} min` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 9px', border: '1px solid rgba(187,176,147,0.4)', color: 'var(--cypress-light)', flexShrink: 0 }}>
                          Accomplie
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: '32px 20px', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucune campagne encore menée</span>
              </div>
            )}

            {/* CTA secondaire */}
            <Link href="/generator" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)',
                padding: '16px 20px', cursor: 'pointer',
              }} className="cta-ghost-gold">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  <span className="display" style={{ fontSize: 17, color: 'var(--gold)' }}>Forger une nouvelle séance</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </div>
            </Link>
          </div>

          {/* L'arsenal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={SECTION_LABEL_GOLD}>L'arsenal</p>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '24px 28px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {bioStats.sort((a, b) => b._count - a._count).map(stat => {
                  const pct = Math.round((stat._count / maxBio) * 100)
                  const color = BIO_TYPE_COLORS[stat.bioType] || 'var(--text-muted)'
                  return (
                    <div key={stat.bioType}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ opacity: 0.7 }}>{BIO_TYPE_ICONS[stat.bioType]}</span>
                          {stat.bioType}
                        </span>
                        <span className="display tnum" style={{ fontSize: 16, color }}>
                          {stat._count}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border-plus)' }}>
                        <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── État vide ─────────────────────────────────────────── */}
        {workoutCount === 0 && (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 24 }}>
              — Aucune séance encore —
            </div>
            <Link href="/generator" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '12px 32px', background: 'var(--crimson)', color: '#F1EAD8', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Commencer
              </button>
            </Link>
          </div>
        )}

      </div>

      <style>{`
        .cta-crimson:hover { filter: brightness(1.12); transform: translateY(-2px) scale(1.005); box-shadow: 0 10px 40px rgba(158,19,22,0.5); }
        .cta-ghost-gold:hover { background: rgba(200,165,95,0.16) !important; }
        .workout-row:hover { background: var(--bg-elevated) !important; }
        .avatar-btn:hover { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,165,95,0.18) !important; }
        @media (max-width: 720px) {
          .hero-today { min-height: 460px; padding: 24px 20px 28px 20px !important; }
          .hero-title { font-size: 48px !important; }
          .r-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .r-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppShell>
  )
}
