import AppShell from '@/components/AppShell'
import ResumeSessionBanner from '@/components/ResumeSessionBanner'
import { prisma } from '@/lib/prisma'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

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

const COMPLEXITY_COLORS: Record<string, string> = {
  Easy:     '#6BAE7C',
  Common:   '#7CA8D4',
  Hard:     '#D4884A',
  Advanced: '#C47878',
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
  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const dateStr = formatDate()

  const user = await getCurrentUser()
  const displayName = user
    ? (user.firstName?.trim() || getDisplayName(user.email))
    : null

  const [movementCount, workoutCount, templateCount, recentWorkouts, bioStats, complexityStats] = await Promise.all([
    prisma.movement.count(),
    prisma.workout.count(),
    prisma.workoutTemplate.count(),
    prisma.workout.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { movements: { include: { movement: true }, orderBy: { order: 'asc' } } },
    }),
    prisma.movement.groupBy({ by: ['bioType'], _count: true }),
    prisma.movement.groupBy({ by: ['complexity'], _count: true }),
  ])

  const recentSessions = user
    ? await prisma.workoutSession.findMany({
        where: { userId: user.id },
        take: 5,
        orderBy: { doneAt: 'desc' },
        include: { workout: { select: { id: true, name: true, duration: true, movements: { select: { movement: { select: { bioType: true } } } } } } },
      }).catch(() => [])
    : []

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
              include: { workout: { select: { id: true, name: true, duration: true, movements: { select: { id: true } } } } },
            },
          },
        }).catch(() => null),
        prisma.workoutSession.count({ where: { userId: user.id, doneAt: { gte: weekBegin } } }).catch(() => 0),
      ])
    : [null, 0]
  const todayEntries = todayPlan?.entries ?? []

  const complexityOrder = ['Easy', 'Common', 'Hard', 'Advanced']
  const maxBio = Math.max(...bioStats.map(s => s._count), 1)

  return (
    <AppShell>
      <div style={{ maxWidth: 960 }}>

        <ResumeSessionBanner />

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ ...SECTION_LABEL, marginBottom: 16 }}>{dateStr}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <h1 className="r-h1" style={{ margin: 0, fontSize: 60, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text-primary)' }}>
              {greeting}
              {displayName && (
                <span style={{ color: 'var(--gold)', marginLeft: 16 }}>{displayName}</span>
              )}
            </h1>
            {user && (
              <Link href="/profile" title="Mon profil" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--bg-elevated)',
                  border: '2px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'var(--gold)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: '0 0 0 0px var(--gold)',
                }}
                  className="avatar-btn"
                >
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || user.email[0].toUpperCase()
                  }
                </div>
              </Link>
            )}
          </div>
          {/* Ligne séparatrice or */}
          <div style={{ marginTop: 20, height: 1, background: 'linear-gradient(90deg, var(--gold-border) 0%, transparent 70%)' }} />
        </div>

        {/* ── Stats ────────────────────────────────────────────── */}
        <div className="r-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginBottom: 2, background: 'var(--border)' }}>
          {[
            { value: workoutCount,   label: 'Workouts' },
            { value: movementCount,  label: 'Mouvements' },
            { value: user ? weekSessionCount : templateCount, label: user ? 'Séances cette semaine' : 'Templates' },
          ].map(({ value, label }, i) => (
            <div key={label} className="r-stat-cell" style={{
              background: 'var(--bg-card)',
              padding: '28px 32px',
              borderTop: i === 1 ? `2px solid var(--gold)` : '2px solid transparent',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)',
            }}>
              <div className="r-stat-num tnum" style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: i === 1 ? 'var(--gold)' : 'var(--text-primary)' }}>
                {value}
              </div>
              <div style={{ ...SECTION_LABEL, marginTop: 10, color: 'var(--text-muted)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Séance du jour (planner) ─────────────────────────── */}
        {todayEntries.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ ...SECTION_LABEL_GOLD, marginBottom: 12 }}>Séance du jour</p>
            {todayEntries.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'var(--bg-card)',
                border: '1px solid var(--gold-border)',
                borderLeft: '3px solid var(--gold)',
                padding: '18px 24px',
                marginBottom: 8,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/workouts/${entry.workout.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.workout.name}
                    </div>
                  </Link>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {entry.workout.movements.length} mouvements
                    {entry.workout.duration ? ` · ${entry.workout.duration} min` : ''}
                  </div>
                </div>
                <Link href={`/workouts/${entry.workout.id}/active`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <span style={{ display: 'inline-block', background: 'var(--gold)', color: '#080808', fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '10px 20px', cursor: 'pointer' }} className="cta-generate">
                    Démarrer →
                  </span>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* ── CTA principal ────────────────────────────────────── */}
        <Link href="/generator" style={{ textDecoration: 'none', display: 'block', marginTop: 24, marginBottom: 40 }}>
          <div style={{
            background: 'var(--gold)',
            padding: '20px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'filter 0.15s',
          }}
            onMouseEnter={undefined}
            className="cta-generate"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#080808' }}>
                Générer un workout
              </span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </Link>

        {/* ── Distribution ─────────────────────────────────────── */}
        <div className="r-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>

          {/* Bio types */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '24px 28px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
            <p style={{ ...SECTION_LABEL_GOLD, marginBottom: 20 }}>Types biomécaniques</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                      <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '0.02em' }}>
                        {stat._count}
                      </span>
                    </div>
                    <div style={{ height: 2, background: 'var(--border-plus)' }}>
                      <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Complexity */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '24px 28px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
            <p style={{ ...SECTION_LABEL_GOLD, marginBottom: 20 }}>Niveaux de complexité</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {complexityOrder.map(level => {
                const stat = complexityStats.find(s => s.complexity === level)
                const count = stat?._count || 0
                const pct = Math.round((count / movementCount) * 100)
                const color = COMPLEXITY_COLORS[level] || 'var(--text-muted)'
                return (
                  <div key={level}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{level}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '0.02em' }}>
                        {count} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-dim)' }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 2, background: 'var(--border-plus)' }}>
                      <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Derniers workouts ─────────────────────────────────── */}
        {recentWorkouts.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={SECTION_LABEL_GOLD}>Derniers workouts</p>
              <Link href="/workouts" style={{ fontSize: 13, color: 'var(--gold-dim)', textDecoration: 'none', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>
                Voir tout →
              </Link>
            </div>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
              {recentWorkouts.map((w, i) => {
                const bioTypes = Array.from(new Set(w.movements.map(m => m.movement.bioType))).slice(0, 3)
                const dateStr = new Date(w.createdAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <Link key={w.id} href={`/workouts/${w.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '16px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 20,
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.15s',
                      cursor: 'pointer',
                    }}
                      onMouseEnter={undefined}
                      className="workout-row"
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w.name}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{dateStr}</span>
                          <span style={{ color: 'var(--text-muted)' }}>·</span>
                          <span>{w.movements.length} mouvements</span>
                          {w.duration && (
                            <>
                              <span style={{ color: 'var(--text-muted)' }}>·</span>
                              <span>{w.duration} min</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {bioTypes.map(bt => (
                          <span key={bt} style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 8px',
                            letterSpacing: '0.04em',
                            border: `1px solid ${BIO_TYPE_COLORS[bt] || 'var(--border)'}40`,
                            color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)',
                            background: `${BIO_TYPE_COLORS[bt] || 'transparent'}12`,
                          }}>
                            {bt}
                          </span>
                        ))}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Dernières séances ────────────────────────────────── */}
        {recentSessions.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={SECTION_LABEL_GOLD}>Dernières séances</p>
              <Link href="/workouts" style={{ fontSize: 13, color: 'var(--gold-dim)', textDecoration: 'none', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>
                Mes workouts →
              </Link>
            </div>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
              {recentSessions.map((s, i) => {
                const bioTypes = Array.from(new Set(s.workout.movements.map(m => m.movement.bioType))).slice(0, 3)
                const doneStr = new Date(s.doneAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                const timeStr = new Date(s.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                return (
                  <Link key={s.id} href={`/workouts/${s.workout.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '14px 24px',
                      display: 'flex', alignItems: 'center', gap: 16,
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.15s', cursor: 'pointer',
                    }} className="workout-row">
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(200,169,81,0.1)', border: '1px solid rgba(200,169,81,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.workout.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {doneStr} à {timeStr}
                          {s.note && <span style={{ marginLeft: 8, color: 'var(--text-dim)' }}>· {s.note}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {bioTypes.map(bt => (
                          <span key={bt} style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 7px', letterSpacing: '0.04em',
                            border: `1px solid ${BIO_TYPE_COLORS[bt] || 'var(--border)'}40`,
                            color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)',
                            background: `${BIO_TYPE_COLORS[bt] || 'transparent'}12`,
                          }}>
                            {bt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── État vide ─────────────────────────────────────────── */}
        {workoutCount === 0 && (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 24 }}>
              — Aucun workout encore —
            </div>
            <Link href="/generator" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '12px 32px', background: 'var(--gold)', color: '#080808', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Commencer
              </button>
            </Link>
          </div>
        )}

      </div>

      <style>{`
        .cta-generate:hover { filter: brightness(1.12); }
        .workout-row:hover { background: var(--bg-elevated) !important; }
        .avatar-btn:hover { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,169,81,0.18) !important; }
      `}</style>
    </AppShell>
  )
}
