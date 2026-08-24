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

// Libellés de section — capitales réservées au seul cadre héros (séance du jour) ;
// partout ailleurs dans la page, casse normale pour rester lisible sans crier.
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.02em',
  color: 'var(--text-muted)',
  margin: 0,
}

const SECTION_LABEL_GOLD: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.02em',
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

  const monthBegin = new Date()
  monthBegin.setDate(1)
  monthBegin.setHours(0, 0, 0, 0)
  const streakWindowBegin = new Date()
  streakWindowBegin.setDate(streakWindowBegin.getDate() - 60)
  const { dayIdx, weekStartCandidates, weekBegin } = parisWeekInfo()

  // Un seul aller-retour : ces neuf requêtes sont indépendantes entre elles et
  // ne dépendent que de `user`. Les enchaîner en quatre vagues successives
  // multipliait la latence réseau par quatre sur la page d'accueil.
  const [
    movementCount, workoutCount, templateCount, bioStats,
    recentSessions, streakSessions, monthSessions,
    weekPlan, weekSessionCount,
  ] = await Promise.all([
    prisma.movement.count(),
    prisma.workout.count(),
    prisma.workoutTemplate.count(),
    prisma.movement.groupBy({ by: ['bioType'], _count: true }),
    user ? prisma.workoutSession.findMany({
      where: { userId: user.id },
      take: 5,
      orderBy: { doneAt: 'desc' },
      include: { workout: { select: { id: true, name: true, duration: true, movements: { select: { movement: { select: { bioType: true } } } } } } },
    }).catch(() => []) : Promise.resolve([]),
    user ? prisma.workoutSession.findMany({
      where: { userId: user.id, doneAt: { gte: streakWindowBegin } },
      select: { doneAt: true },
    }).catch(() => []) : Promise.resolve([]),
    user ? prisma.workoutSession.findMany({
      where: { userId: user.id, doneAt: { gte: monthBegin } },
      include: { workout: { select: { duration: true } } },
    }).catch(() => []) : Promise.resolve([]),
    user ? prisma.weekPlan.findFirst({
      where: { userId: user.id, weekStart: { in: weekStartCandidates } },
      include: {
        entries: {
          orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
          include: { workout: { select: { id: true, name: true, duration: true, movements: { select: { id: true, movement: { select: { bioType: true } } } } } } },
        },
      },
    }).catch(() => null) : Promise.resolve(null),
    user ? prisma.workoutSession.count({ where: { userId: user.id, doneAt: { gte: weekBegin } } }).catch(() => 0) : Promise.resolve(0),
  ])

  const streak = computeStreak(streakSessions.map(s => s.doneAt))
  const monthMinutes = monthSessions.reduce((sum, s) => sum + (s.workout?.duration || 0), 0)
  const monthHours = Math.round(monthMinutes / 60)
  const weekEntries = weekPlan?.entries ?? []
  const todayEntries = weekEntries.filter(e => e.dayOfWeek === dayIdx)
  const heroEntry = todayEntries[0]

  // « Prochaines séances » : le reste d'aujourd'hui, puis les jours suivants de la semaine —
  // jamais le passé (dayOfWeek < dayIdx).
  const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const upcomingEntries = weekEntries
    .filter(e => e.dayOfWeek >= dayIdx && e.id !== heroEntry?.id)
    .slice(0, 4)

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
      <div style={{ maxWidth: 1240, margin: '0 auto', width: '100%' }}>

        <ResumeSessionBanner />

        {/* ── Hero : séance du jour ────────────────────────────────── */}
        <div className="hero-today" style={{
          position: 'relative',
          background: 'radial-gradient(120% 100% at 10% -10%, rgba(201,165,53,0.16), transparent 55%), radial-gradient(100% 95% at 95% 118%, rgba(180,85,45,0.42), transparent 62%), linear-gradient(150deg, #2A231B 0%, #1D1813 62%, #17130F 100%)',
          padding: '28px 32px 32px 32px',
          marginBottom: 32,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minHeight: 380,
        }}>
          {/* logo en filigrane */}
          <svg style={{ position: 'absolute', right: -78, bottom: -104, pointerEvents: 'none' }} width="392" height="392" viewBox="0 0 100 100" fill="none" opacity={0.075}>
            <circle cx="50" cy="50" r="40" stroke="#C9A535" strokeWidth="4.5" />
            <line x1="50" y1="14" x2="19" y2="74" stroke="#C9A535" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="50" y1="14" x2="81" y2="74" stroke="#C9A535" strokeWidth="4.5" strokeLinecap="round" />
          </svg>
          {/* fondu vers le fond de page */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: 'linear-gradient(180deg, rgba(23,19,15,0) 0%, rgba(23,19,15,0.85) 100%)', pointerEvents: 'none' }} />

          {/* ligne du haut : date + salutation / ring */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,235,225,0.45)' }}>{dateStr}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#F0EBE1' }}>
                {greeting}{displayName && <span style={{ color: 'var(--gold)' }}> {displayName}</span>}
              </span>
            </div>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                  <svg width="76" height="76" viewBox="0 0 92 92">
                    <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(240,235,225,0.13)" strokeWidth="5" />
                    <circle cx="46" cy="46" r="40" fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray={ringDash} transform="rotate(-90 46 46)" />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 76, height: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="display tnum" style={{ fontSize: 22, color: '#F0EBE1', lineHeight: 1 }}>
                      {weekSessionCount}<span style={{ color: 'rgba(240,235,225,0.40)', fontSize: 14 }}>/{WEEK_GOAL}</span>
                    </span>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,235,225,0.45)' }}>semaine</span>
                  </div>
                </div>
                <Link href="/profile" title="Mon profil" style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="avatar-btn" style={{
                    width: 44, height: 44, borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'var(--bg-elevated)',
                    border: '2px solid var(--gold-border)',
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
              <div style={{ width: 24, height: 2, background: '#D2794A' }} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#D2794A' }}>
                {heroEntry ? 'Séance du jour' : 'Aucune séance planifiée'}
              </span>
            </div>

            <h1 className="display hero-title" style={{ margin: 0, fontSize: 38, color: '#F0EBE1', textTransform: 'uppercase' }}>
              {heroEntry ? heroEntry.workout.name : 'Forge ta séance'}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              {heroEntry && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,225,0.60)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(240,235,225,0.78)' }}>{heroEntry.workout.duration ? `${heroEntry.workout.duration} min` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,225,0.60)" strokeWidth="2" strokeLinecap="round"><path d="M4 9 v6 M20 9 v6 M7 7 v10 M17 7 v10 M7 12 h10" /></svg>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(240,235,225,0.78)' }}>{heroEntry.workout.movements.length} mouvements</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {heroBioTypes.map(bt => (
                      <span key={bt} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', border: `1px solid ${BIO_TYPE_COLORS[bt] || 'rgba(201,165,53,0.4)'}` , color: BIO_TYPE_COLORS[bt] || 'var(--gold)' }}>
                        {bt}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div style={{ flexGrow: 1 }} />
              {heroEntry ? (
                <Link href={`/workouts/${heroEntry.workout.id}/active`} style={{ textDecoration: 'none' }}>
                  <div className="cta-crimson" style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--crimson)',
                    padding: '16px 36px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 32px rgba(180,85,45,0.4)',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#F8F4EC"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                    <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#F8F4EC' }}>
                      Démarrer
                    </span>
                  </div>
                </Link>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link href="/library" style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      border: '1px solid rgba(240,235,225,0.30)',
                      padding: '15px 28px',
                      cursor: 'pointer',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,225,0.80)" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
                      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,235,225,0.85)' }}>
                        Explorer
                      </span>
                    </div>
                  </Link>
                  <Link href="/generator" style={{ textDecoration: 'none' }}>
                    <div className="cta-crimson" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--crimson)',
                      padding: '16px 36px',
                      cursor: 'pointer',
                      boxShadow: '0 8px 32px rgba(180,85,45,0.4)',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#F8F4EC"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#F8F4EC' }}>
                        Forger
                      </span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Prochaines séances (seulement si quelque chose est planifié) ── */}
        {heroEntry && upcomingEntries.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <p style={SECTION_LABEL_GOLD}>Prochaines séances</p>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {upcomingEntries.map((entry, i) => (
                <Link key={entry.id} href={`/workouts/${entry.workout.id}`} style={{ textDecoration: 'none' }}>
                  <div className="workout-row" style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 20px',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--gold)', width: 76, flexShrink: 0 }}>
                      {entry.dayOfWeek === dayIdx ? "Aujourd'hui" : DAY_LABELS[entry.dayOfWeek]}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.workout.name}
                    </span>
                    {entry.workout.duration && (
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>{entry.workout.duration} min</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

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
                <Link href="/workouts" style={{ fontSize: 13, color: 'var(--gold-dim)', textDecoration: 'none', letterSpacing: '0.02em', fontWeight: 600 }}>
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
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', padding: '2px 9px', border: '1px solid rgba(187,176,147,0.4)', color: 'var(--cypress-light)', flexShrink: 0 }}>
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
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-dim)', marginBottom: 24 }}>
              Aucune séance encore
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
          .hero-title { font-size: 30px !important; }
          .r-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .r-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppShell>
  )
}
