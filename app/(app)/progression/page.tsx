import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'
import { syncAttributesFromDb } from '@/lib/attributes-server'
import { CheckCircle2, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Le libelle de section a rejoint .t-micro (globals.css) : memes capitales, meme
// interlettrage que partout ailleurs, au lieu d'un objet de style redessine ici
// pour quatre appels. Seule la teinte or reste posee au point d'appel, parce que
// la charte l'attribue a la progression — le sujet meme de cet ecran.

// Lundi (Europe/Paris) de la semaine contenant `d`, retourné en UTC minuit.
function parisMonday(d: Date): Date {
  const parisD = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const day = parisD.getDay()
  const monday = new Date(parisD)
  monday.setDate(parisD.getDate() + (day === 0 ? -6 : 1 - day))
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate())
}

const WEEKS_SHOWN = 12

export default async function ProgressionPage() {
  // Un echec de lecture ne doit pas se deguiser en « aucune seance » : un
  // utilisateur qui en a 200 verrait son historique disparaitre sans un mot.
  let chargementEchoue = false
  await syncAttributesFromDb()
  const user = await getCurrentUser()

  type ProgressionSession = { id: string; doneAt: Date; note: string | null; workout: { id: string; name: string; movements: { movement: { bioType: string } }[] } }

  // Cast du ternary entier plutôt que branche par branche : TS abandonnait
  // l'inférence sur ce `findMany` à includes imbriqués et retombait sur `any`
  // pour toute l'expression, quelle que soit la branche.
  const sessions = (user
    ? await prisma.workoutSession.findMany({
        where: { userId: user.id },
        orderBy: { doneAt: 'desc' },
        take: 200,
        include: {
          workout: {
            select: { id: true, name: true, movements: { select: { movement: { select: { bioType: true } } } } },
          },
        },
      }).catch(() => { chargementEchoue = true; return [] })
    : []) as ProgressionSession[]

  const totalSessions = sessions.length

  // ── Répartition hebdomadaire (12 dernières semaines) ──
  const thisMonday = parisMonday(new Date())
  const weekBuckets: { weekStart: Date; count: number }[] = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const ws = new Date(thisMonday)
    ws.setDate(thisMonday.getDate() - (WEEKS_SHOWN - 1 - i) * 7)
    return { weekStart: ws, count: 0 }
  })
  sessions.forEach(s => {
    const wm = parisMonday(new Date(s.doneAt)).getTime()
    const bucket = weekBuckets.find(b => b.weekStart.getTime() === wm)
    if (bucket) bucket.count++
  })
  const maxWeekCount = Math.max(...weekBuckets.map(b => b.count), 1)

  // Semaines travaillées, et non semaines de suite : une série interrompue
  // retombe a zero et transforme un retour en échec affiché.
  const weeksWorked = weekBuckets.filter(b => b.count > 0).length

  // ── Répartition par type biomécanique (sur toutes les séances chargées) ──
  const bioCounts: Record<string, number> = {}
  sessions.forEach(s => {
    const types = new Set(s.workout.movements.map(m => m.movement.bioType))
    types.forEach(t => { bioCounts[t] = (bioCounts[t] ?? 0) + 1 })
  })
  const bioStats = Object.entries(bioCounts).sort((a, b) => b[1] - a[1])
  const maxBio = Math.max(...bioStats.map(([, c]) => c), 1)

  const weekSessionCount = weekBuckets[weekBuckets.length - 1]?.count ?? 0

  return (
    <>
      <div className="page">
        <header style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="t-micro" style={{ marginBottom: 6 }}>SUIVI</div>
          <h1 className="r-h1">Progression</h1>
          <p className="r-subtitle">
            {totalSessions} séance{totalSessions !== 1 ? 's' : ''} enregistrée{totalSessions !== 1 ? 's' : ''}
          </p>
        </header>

        {!user ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Connecte-toi pour voir ta progression.
          </div>
        ) : chargementEchoue ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div className="t-micro" style={{ color: 'var(--red)', marginBottom: 'var(--sp-3)' }}>
              — Historique indisponible —
            </div>
            <div className="t-body" style={{ color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' }}>
              Tes séances n&apos;ont pas pu être lues. Elles sont intactes : recharge la page
              dans un instant.
            </div>
          </div>
        ) : totalSessions === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div className="t-micro" style={{ marginBottom: 'var(--sp-6)' }}>
              — Aucune séance enregistrée encore —
            </div>
            <Link href="/workouts" style={{ textDecoration: 'none' }}>
              {/* .btn porte la geometrie et le survol, pas la teinte : .btn-primary est
                  or, et la charte reserve l'or a la progression — l'action est
                  terracotta. */}
              <button className="btn btn-md" style={{ background: 'var(--accent)', color: 'var(--on-accent)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>
                Voir mes séances
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginBottom: 32, background: 'var(--border)' }}>
              {[
                { value: totalSessions, label: 'Séances au total', icon: CheckCircle2 },
                { value: weekSessionCount, label: 'Cette semaine', icon: TrendingUp },
                { value: weeksWorked, label: `Semaine${weeksWorked !== 1 ? 's' : ''} travaillée${weeksWorked !== 1 ? 's' : ''}`, icon: CheckCircle2 },
              ].map(({ value, label, icon: Icon }, i) => (
                <div key={label} style={{
                  background: 'var(--bg-card)', padding: '24px 28px',
                  borderTop: '2px solid transparent',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)',
                }}>
                  <Icon size={16} style={{ color: 'var(--text-dim)', marginBottom: 10 }} />
                  {/* Un grand chiffre : le seul emploi legitime de la serif, avec les
                      titres. .tnum les aligne d'une tuile a l'autre. */}
                  <div className="display tnum" style={{ fontSize: 44, color: 'var(--text-primary)' }}>
                    {value}
                  </div>
                  <div className="t-micro" style={{ color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── Barres hebdomadaires ── */}
            <div className="card" style={{ padding: '24px 28px', marginBottom: 'var(--sp-6)' }}>
              <p className="t-micro" style={{ color: 'var(--gold-dim)', marginBottom: 'var(--sp-5)' }}>{WEEKS_SHOWN} dernières semaines</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {weekBuckets.map((b, i) => {
                  const h = Math.max((b.count / maxWeekCount) * 100, b.count > 0 ? 8 : 2)
                  const isCurrent = i === weekBuckets.length - 1
                  return (
                    <div key={b.weekStart.toISOString()} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}
                      title={`${b.weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${b.count} séance${b.count !== 1 ? 's' : ''}`}>
                      <div style={{
                        width: '100%', height: `${h}%`, minHeight: 2, borderRadius: 3,
                        background: isCurrent ? 'var(--gold)' : b.count > 0 ? 'rgba(200,165,95,0.4)' : 'var(--border-plus)',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {weekBuckets.map((b, i) => (
                  <div key={b.weekStart.toISOString()} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>
                    {i % 2 === 0 ? b.weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Répartition par type ── */}
            {bioStats.length > 0 && (
              <div className="card" style={{ padding: '24px 28px', marginBottom: 'var(--sp-7)' }}>
                <p className="t-micro" style={{ color: 'var(--gold-dim)', marginBottom: 'var(--sp-5)' }}>Types biomécaniques travaillés</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {bioStats.map(([bioType, count]) => {
                    const pct = Math.round((count / maxBio) * 100)
                    const color = BIO_TYPE_COLORS[bioType] || 'var(--text-muted)'
                    return (
                      <div key={bioType}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                          <span className="t-body" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ opacity: 0.7 }}>{BIO_TYPE_ICONS[bioType]}</span>
                            {bioType}
                          </span>
                          <span className="t-body tnum" style={{ fontWeight: 700, color }}>{count}</span>
                        </div>
                        <div style={{ height: 2, background: 'var(--border-plus)' }}>
                          <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Historique ── */}
            <div>
              <p className="t-micro" style={{ color: 'var(--gold-dim)', marginBottom: 'var(--sp-4)' }}>Historique</p>
              {/* .card pose un rayon que cette liste n'avait pas : sans overflow, le
                  survol d'une ligne redessine des coins carres aux extremites. */}
              <div className="card" style={{ overflow: 'hidden' }}>
                {sessions.map((s, i) => {
                  const bioTypes = Array.from(new Set(s.workout.movements.map(m => m.movement.bioType))).slice(0, 3)
                  const doneStr = new Date(s.doneAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                  const timeStr = new Date(s.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <Link key={s.id} href={`/workouts/${s.workout.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16,
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        transition: 'background 0.15s', cursor: 'pointer',
                      }} className="workout-row">
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(200,165,95,0.1)', border: '1px solid rgba(200,165,95,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CheckCircle2 size={14} color="var(--gold)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="t-body" style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.workout.name}
                          </div>
                          <div className="t-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
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
          </>
        )}
      </div>

      <style>{`.workout-row:hover { background: var(--bg-elevated) !important; }`}</style>
    </>
  )
}
