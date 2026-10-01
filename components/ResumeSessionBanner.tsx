'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MAX_AGE_MS = 24 * 60 * 60 * 1000

// ── File d'attente des séances terminées ───────────────────────────────────
// Clé distincte de `arete_active_*`, qui expire au bout de 24 h : une séance
// abandonnée n'a plus d'intérêt le lendemain, mais une séance *terminée* ne doit
// jamais expirer. C'est la seule donnée de l'application que l'utilisateur ne
// peut pas refaire de mémoire, et le moment où le réseau tombe — sous-sol de
// salle de sport — est exactement celui où il appuie sur « Enregistrer ».
export const PENDING_KEY = 'arete_pending_sessions'

export interface PendingSession {
  key: string
  workoutId: string
  workoutName: string | null
  note?: string
  sets: unknown[]
  finishedAt: number
}

// Tout passe par try/catch : en navigation privée iOS, localStorage lève au lieu
// de renvoyer null, et une exception ici ferait tomber tout l'écran.
export function listPendingSessions(): PendingSession[] {
  try {
    const arr = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    if (!Array.isArray(arr)) return []
    return arr.filter((p: PendingSession) => p && typeof p.key === 'string' && typeof p.workoutId === 'string')
  } catch { return [] }
}

function writePending(list: PendingSession[]) {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_KEY)
    else localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  } catch {}
}

// Appelée AVANT le POST : si l'onglet meurt pendant la requête — iOS suspend une
// PWA en arrière-plan sans prévenir — la séance est déjà sur l'appareil.
export function enqueuePendingSession(p: PendingSession) {
  writePending([...listPendingSessions().filter(e => e.key !== p.key), p])
}

export function dequeuePendingSession(key: string) {
  writePending(listPendingSessions().filter(e => e.key !== key))
}

// Rejeu strictement sérialisé, pour deux raisons distinctes :
// — le POST n'est pas idempotent (`workoutSession.create` sec, aucune contrainte
//   d'unicité) et l'application n'offre aucun écran pour supprimer une séance :
//   un doublon se répare à la main dans la base ;
// — l'événement `online` réveille tous les montages du composant d'un coup.
// Le drapeau de module couvre l'onglet courant ; il ne traverse pas les onglets,
// d'où le verrou en localStorage. Un horodatage et non un booléen : un onglet tué
// en pleine requête laisserait sinon la file bloquée définitivement.
let flushing = false
const LOCK_KEY = 'arete_pending_flush_lock'
const LOCK_TTL_MS = 60_000

export async function flushPendingSessions(): Promise<{ pending: PendingSession[]; sent: number }> {
  if (flushing) return { pending: listPendingSessions(), sent: 0 }
  try {
    const held = Number(localStorage.getItem(LOCK_KEY) ?? 0)
    if (held && Date.now() - held < LOCK_TTL_MS) return { pending: listPendingSessions(), sent: 0 }
    localStorage.setItem(LOCK_KEY, String(Date.now()))
  } catch {}
  flushing = true
  let sent = 0
  try {
    for (const p of listPendingSessions()) {
      let res: Response | null = null
      try {
        res = await fetch(`/api/workouts/${p.workoutId}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: p.note || undefined, sets: p.sets }),
        })
      } catch { res = null }
      // 201 et rien d'autre. Un `res.ok` large accepterait le 200 d'un portail
      // Wi-Fi captif, et on effacerait la seule copie de la séance.
      if (res?.status === 201) { dequeuePendingSession(p.key); sent++; continue }
      // Refus définitif — séance supprimée entre-temps, charge utile invalide :
      // la garder afficherait une bannière « à synchroniser » perpétuelle, donc
      // on la jette, mais on la trace d'abord. 401 excepté, il suffit de se
      // reconnecter pour que le rejeu suivant aboutisse.
      if (res && res.status >= 400 && res.status < 500 && res.status !== 401) {
        console.warn('[arete] séance refusée par le serveur, abandonnée', res.status, p)
        dequeuePendingSession(p.key)
        continue
      }
      // Réseau coupé ou 5xx : on s'arrête net. La suivante échouerait pareil, et
      // empiler des requêtes quand le réseau est déjà mauvais ne fait que vider
      // la batterie.
      break
    }
  } finally {
    flushing = false
    try { localStorage.removeItem(LOCK_KEY) } catch {}
  }
  return { pending: listPendingSessions(), sent }
}

interface ActiveSession { id: string; name: string | null; startedAt: number; doneSets: number }

// Bannière "Séance en cours — reprendre" basée sur l'état persisté en localStorage.
// Sans workoutId : scanne toutes les séances (dashboard). Avec workoutId : seulement celle-là.
export default function ResumeSessionBanner({ workoutId }: { workoutId?: string }) {
  const [session, setSession] = useState<ActiveSession | null>(null)
  // Rafraîchi toutes les minutes : le libellé « démarrée il y a … » se figeait
  // sur la valeur du premier rendu tant que la page restait ouverte.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const router = useRouter()
  const [pending, setPending] = useState<PendingSession[]>([])
  // Rejeu en JavaScript de page, sans Background Sync : l'API est absente de
  // WebKit et l'application est installée en PWA sur iOS.
  useEffect(() => {
    let alive = true
    const run = () => flushPendingSessions().then(r => {
      if (!alive) return
      setPending(r.pending)
      // La page affiche encore un historique sans la séance qui vient de partir.
      if (r.sent > 0) router.refresh()
    })
    run()
    // `visibilitychange` en plus de `online` : `online` n'est pas émis quand
    // l'appareil retrouve le réseau pendant que l'onglet dort — c'est le cas
    // normal sur iOS, où l'on sort du vestiaire écran éteint.
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const found: ActiveSession[] = []
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
          found.push({ id, startedAt: s.startedAt, doneSets, name: typeof s.name === 'string' ? s.name : null })
        } else {
          stale.push(key)
        }
      } catch {}
    }
    stale.forEach(k => localStorage.removeItem(k))
    if (found.length === 0) return
    const latest = found.sort((a, b) => b.startedAt - a.startedAt)[0]
    setSession(latest)

    // Le nom est normalement déjà dans l'état persisté (la page de séance
    // l'écrit) : on ne recharge la séance que pour les sessions démarrées avant
    // cette version, sinon on tirait tout le workout — blocs et mouvements
    // compris — pour un simple libellé.
    if (latest.name) return
    fetch(`/api/workouts/${latest.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(w => { if (w?.name) setSession(s => (s && s.id === latest.id ? { ...s, name: w.name } : s)) })
      .catch(() => {})
  }, [workoutId])

  // `now` figé au montage plutôt que `Date.now()` en plein rendu : la durée
  // affichée reste stable entre deux rendus et le composant redevient pur.
  const min = session ? Math.max(1, Math.round((now - session.startedAt) / 60000)) : 0
  // La bannière de synchronisation s'affiche même quand le composant est filtré
  // sur un autre `workoutId` : une séance qui attend d'être envoyée est un
  // problème global, et la masquer sur une page de séance est précisément la
  // manière dont on finit par l'oublier.
  if (!session && pending.length === 0) return null

  return (
    <>
      {pending.length > 0 && (
        // Terracotta : il reste un geste à faire. Ni mousse — l'accompli, or la
        // séance n'est pas encore en base — ni or, réservé à la marque et à la
        // progression. Et une bannière, pas un toast : la perte d'une séance se
        // joue sur des heures, pas sur les 4,5 s d'un message qui s'efface.
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
          padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-5)',
          borderRadius: 'var(--r-md)', background: 'var(--crimson-ghost)',
          border: '1px solid var(--crimson-border)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {pending.length} séance{pending.length > 1 ? 's' : ''} à synchroniser
              {pending.length === 1 && pending[0].workoutName ? ` — ${pending[0].workoutName}` : ''}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)', marginTop: 2 }}>
              Enregistrée{pending.length > 1 ? 's' : ''}{' '}sur l&apos;appareil · envoi dès le retour du réseau
            </div>
          </div>
          <button onClick={() => { flushPendingSessions().then(r => { setPending(r.pending); if (r.sent > 0) router.refresh() }) }}
            style={{
              flexShrink: 0, minHeight: 44, padding: 'var(--sp-2) var(--sp-4)',
              borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--crimson-border)', color: 'var(--crimson-bright)',
            }}>
            Réessayer
          </button>
        </div>
      )}
      {session && (
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
      )}
    </>
  )
}
