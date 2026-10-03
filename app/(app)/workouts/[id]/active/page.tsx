'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BIO_TYPE_COLORS } from '@/lib/types'
import { ProgressRing } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { getEmbedInfo, extractEmbedVideoId } from '@/lib/video'
import YouTubeLoopEmbed from '@/components/YouTubeLoopEmbed'
// La file d'attente locale vit dans ResumeSessionBanner : c'est lui qui la rejoue
// et qui l'affiche, et il est monté sur le tableau de bord comme sur la page de
// détail — là où l'on retombe juste après avoir terminé une séance.
import { enqueuePendingSession, dequeuePendingSession } from '@/components/ResumeSessionBanner'

interface Movement { id: string; name: string; bioType: string; videoUrl?: string | null }
interface WM { id: string; order: number; sets?: number | null; reps?: string | null; rest?: number | null; duration?: number | null; blockId?: string | null; movement: Movement }
interface Block { id: string; order: number; bioType?: string | null; instructions?: string | null; superset?: boolean }
interface Workout { id: string; name: string; duration?: number | null; movements: WM[]; blocks: Block[] }

const REST_OPTIONS = [30, 60, 90, 120]
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// Delai d'expiration pour les appels reseau de cet ecran. `AbortSignal.timeout`
// n'existe pas avant iOS 16 : sur ces telephones on retombe sur l'ancien
// comportement (pas de delai) au lieu de lever au moment de l'appel.
const withTimeout = (ms: number) =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined

// Resume du brouillon local pour l'ecran d'erreur. Meme peremption de 24 h que
// la restauration plus bas : un brouillon trop vieux ne vaut pas la peine d'etre
// promis a l'utilisateur. Lecture defensive — localStorage peut etre bloque
// (navigation privee) ou contenir un reste d'une version anterieure.
const readDraft = (key: string): { name: string | null; doneSets: number } | null => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.startedAt || Date.now() - s.startedAt >= 24 * 60 * 60 * 1000) return null
    const doneSets = Object.values((s.done ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0)
    return { name: typeof s.name === 'string' ? s.name : null, doneSets }
  } catch { return null }
}

// Une saisie = une série. Les champs restent des chaînes tant qu'on tape : un
// nombre forcerait à choisir entre « vide » et 0, or 0 kg n'est pas une absence
// de charge et fausserait moyennes et records.
interface SetEntry { weight: string; reps: string }

// Clavier français : la virgule est ce qui sort du pavé numérique iOS. Illisible
// ou vide → null, jamais 0 : une charge non renseignée doit rester null en base.
const num = (v: string | null | undefined): number | null => {
  if (v == null) return null
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// Le localStorage est une entrée non fiable : JSON tronqué, séance démarrée sur
// une autre version, bricolage manuel. L'écran de séance ne doit jamais planter
// sur ce qu'il y relit — au pire il repart sur une saisie vide.
const normalizePerfLog = (raw: unknown): Record<string, SetEntry[]> => {
  const out: Record<string, SetEntry[]> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [wmId, rows] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue
    out[wmId] = rows.map(r => {
      const o = (r ?? {}) as { weight?: unknown; reps?: unknown }
      return { weight: typeof o.weight === 'string' ? o.weight : '', reps: typeof o.reps === 'string' ? o.reps : '' }
    })
  }
  return out
}

export default function ActivePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [workout, setWorkout] = useState<Workout | null>(null)
  // Trois registres d'echec, parce qu'ils n'appellent pas la meme issue :
  // requireWorkoutReader (lib/authz.ts) repond 401 sans session et 404 pour une
  // seance absente ou privee d'un autre — reessayer donnerait exactement la meme
  // reponse. Seul 'network' (coupure, expiration, 5xx) merite un nouvel essai.
  const [loadError, setLoadError] = useState<'auth' | 'denied' | 'network' | null>(null)
  // Brouillon present au moment de l'echec : de quoi affirmer que les series
  // deja cochees ne sont pas perdues, au lieu d'afficher un echec nu.
  const [draft, setDraft] = useState<{ name: string | null; doneSets: number } | null>(null)

  const [done, setDone] = useState<Record<string, number>>({})
  const [rest, setRest] = useState<{ sec: number; total: number; wmId: string } | null>(null)
  const [defaultRest, setDefaultRest] = useState(60)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const toast = useToast()
  const [note, setNote] = useState('')
  const [showFinish, setShowFinish] = useState(false)
  const [supersetBlocs, setSupersetBlocs] = useState<Set<string>>(new Set())
  const [exerciseTimer, setExerciseTimer] = useState<{ wmId: string; sec: number; total: number } | null>(null)
  // Log de performance : une entrée par SÉRIE (clé = wmId, index = n° de série − 1).
  // Un seul couple par mouvement recopié n fois à l'enregistrement écrivait une
  // charge fausse dès qu'on montait entre deux séries, et cette donnée inventée
  // remontait ensuite dans le badge PR et dans l'indice « Dernière ».
  const [perfLog, setPerfLog] = useState<Record<string, SetEntry[]>>({})
  // Dernière perf par movementId : { last: {weight, reps}, bestWeight } — indices "la dernière fois"
  const [lastPerf, setLastPerf] = useState<Record<string, { last: { weight: number | null; reps: number | null } | null; bestWeight: number | null }>>({})
  // Les trous sont comblés par des entrées vides : saisir la série 3 avant la 2
  // ne doit pas décaler vers le bas les valeurs déjà tapées.
  const setLog = (wmId: string, index: number, field: 'weight' | 'reps', value: string) =>
    setPerfLog(prev => {
      const rows = [...(prev[wmId] ?? [])]
      while (rows.length <= index) rows.push({ weight: '', reps: '' })
      rows[index] = { ...rows[index], [field]: value }
      return { ...prev, [wmId]: rows }
    })

  // Reprendre la série précédente est un geste de l'utilisateur, pas une
  // supposition de l'application : trois séries à charge constante se tapent en
  // un appui, sans que l'écran lui souffle jamais de ne pas progresser.
  const copyPrevSet = (wmId: string, index: number) =>
    setPerfLog(prev => {
      const rows = [...(prev[wmId] ?? [])]
      const src = rows[index - 1]
      if (!src) return prev
      while (rows.length <= index) rows.push({ weight: '', reps: '' })
      rows[index] = { ...src }
      return { ...prev, [wmId]: rows }
    })

  const toggleSuperset = (blockId: string) =>
    setSupersetBlocs(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId); else next.add(blockId)
      return next
    })

  // Mise à jour dans un effet, pas en plein rendu : écrire dans une ref pendant
  // le rendu est une mutation que React peut jeter si le rendu est abandonné
  // (mode concurrent). Un tick de retard sur un compteur de secondes est sans
  // conséquence — c'est déjà le traitement appliqué à `doneRef` juste en dessous.
  const elapsedRef = useRef(elapsed)
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])
  const doneRef = useRef(done)
  useEffect(() => { doneRef.current = done }, [done])

  const storageKey = `arete_active_${id}`
  const startedAtRef = useRef<number | null>(null)

  // ── Audio + vibration à la fin des timers ──
  const audioCtxRef = useRef<AudioContext | null>(null)
  // L'AudioContext doit être créé/relancé sur un geste utilisateur (politique iOS/Chrome)
  const ensureAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (AC) audioCtxRef.current = new AC()
      }
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()
    } catch {}
  }
  const notifyTimerEnd = () => {
    try { navigator.vibrate?.([200, 100, 200]) } catch {}
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state !== 'running') return
    try {
      const beep = (delay: number, freq: number) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq
        const t = ctx.currentTime + delay
        g.gain.setValueAtTime(0.001, t)
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        o.start(t); o.stop(t + 0.3)
      }
      beep(0, 880); beep(0.3, 1175)
    } catch {}
  }

  // ── Wake lock : garder l'écran allumé pendant la séance ──
  useEffect(() => {
    if (!started) return
    type WakeLockSentinel = { release: () => Promise<void> }
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock
        const s = await wl?.request('screen')
        if (cancelled) { s?.release().catch(() => {}) } else if (s) lock = s
      } catch {}
    }
    request()
    // Le lock est libéré par le navigateur quand l'onglet passe en arrière-plan → on le redemande au retour
    const onVisibility = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [started])

  // Chargement de la seance. Ne rejette jamais : il pose `loadError` et renvoie
  // null, de sorte qu'aucun appelant ne puisse oublier le filet — c'est
  // precisement l'oubli qui bloquait cet ecran sur « Chargement… ».
  const loadWorkout = useCallback(async (): Promise<Workout | null> => {
    setLoadError(null)
    try {
      // Delai d'expiration : hors wifi la requete pouvait rester en suspens sans
      // jamais echouer. public/sw.js sert les reponses /api/workouts/* deja vues
      // (stale-while-revalidate), mais quand il n'en a aucune il attend le reseau
      // indefiniment et aucun `.catch` ne se declenche jamais.
      const r = await fetch(`/api/workouts/${id}`, { signal: withTimeout(12000) })
      if (!r.ok) {
        setDraft(readDraft(storageKey))
        // 403 est traite comme 404 : la route renvoie deja 404 a la place d'un 403
        // pour ne pas confirmer l'existence de l'identifiant.
        setLoadError(r.status === 401 ? 'auth' : r.status === 403 || r.status === 404 ? 'denied' : 'network')
        return null
      }
      const w = await r.json() as Workout
      // Une reponse 200 mal formee faisait exploser `w.blocks.filter` dans un
      // `then` sans filet : meme ecran bloque, par un autre chemin.
      if (!w || !Array.isArray(w.movements) || !Array.isArray(w.blocks)) {
        setDraft(readDraft(storageKey))
        setLoadError('network')
        return null
      }
      return w
    } catch {
      setDraft(readDraft(storageKey))
      setLoadError('network')
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Le chemin de chargement complet est depose dans cette ref par l'effet
  // ci-dessous. « Reessayer » doit le rejouer en entier — restauration du
  // brouillon et des supersets comprise — et pas seulement le fetch : un nouvel
  // essai reussi afficherait sinon une seance vierge alors que des series sont
  // deja cochees en local.
  const loadRef = useRef<() => void>(() => {})

  // load workout + restore session in progress
  useEffect(() => {
    loadRef.current = () => loadWorkout().then(w => {
      // null = echec deja signale par `loadWorkout` : rien a appliquer, et surtout
      // pas `w.blocks` sur un objet d'erreur.
      if (!w) return
      setWorkout(w)

      // Superset persistés sur le workout (colonne DB) → pré-activés
      const dbSuper = (w.blocks as Block[]).filter(b => b.superset).map(b => b.id)
      if (dbSuper.length > 0) setSupersetBlocs(prev => new Set([...prev, ...dbSuper]))

      // Reprise d'une séance interrompue (refresh, onglet fermé) — expire après 24h
      const savedRaw = localStorage.getItem(storageKey)
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw)
          if (saved.startedAt && Date.now() - saved.startedAt < 24 * 60 * 60 * 1000) {
            if (saved.done) setDone(saved.done)
            if (Array.isArray(saved.superset)) setSupersetBlocs(prev => new Set([...prev, ...saved.superset]))
            if (saved.note) setNote(saved.note)
            // Forme v2 : une entrée par série. Avant, `logInputs` ne portait qu'un
            // couple par mouvement, et rien ne distingue ce qui avait été tapé de
            // ce que l'ancien pré-remplissage avait recopié de la séance d'avant.
            // On ne reprend donc ce couple que sur la série 1 : l'étaler sur toutes
            // les séries validées reconduirait pile la donnée fausse qu'on supprime,
            // tandis que des séries vides se voient et se corrigent en deux appuis.
            if (saved.perfLog) {
              setPerfLog(normalizePerfLog(saved.perfLog))
            } else if (saved.logInputs && typeof saved.logInputs === 'object') {
              const migrated: Record<string, SetEntry[]> = {}
              for (const [wmId, v] of Object.entries(saved.logInputs as Record<string, { weight?: unknown; reps?: unknown }>)) {
                const weight = typeof v?.weight === 'string' ? v.weight : ''
                const reps = typeof v?.reps === 'string' ? v.reps : ''
                if (weight || reps) migrated[wmId] = [{ weight, reps }]
              }
              setPerfLog(migrated)
            }
            startedAtRef.current = saved.startedAt
            setElapsed(Math.max(0, Math.floor((Date.now() - saved.startedAt) / 1000)))
            setStarted(true)
          } else {
            localStorage.removeItem(storageKey)
          }
        } catch {}
      }

      const key = `arete_superset_init_${id}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          const orders: number[] = JSON.parse(stored)
          const ids = new Set<string>(
            (w.blocks as Block[]).filter((b: Block) => orders.includes(b.order)).map((b: Block) => b.id)
          )
          if (ids.size > 0) setSupersetBlocs(prev => new Set([...prev, ...ids]))
          localStorage.removeItem(key)
        } catch {}
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Declenchement separe de la definition juste au-dessus : les effets
  // s'executent dans l'ordre du fichier, la ref est donc deja remplie ici, et le
  // meme appel reste joignable depuis le bouton « Reessayer ».
  useEffect(() => { loadRef.current() }, [id])

  // persist session state so a refresh/tab close doesn't lose progress
  useEffect(() => {
    if (!started || !workout) return
    if (startedAtRef.current == null) startedAtRef.current = Date.now() - elapsedRef.current * 1000
    localStorage.setItem(storageKey, JSON.stringify({
      done,
      superset: [...supersetBlocs],
      note,
      perfLog,
      // Marqueur de forme : la saisie est passée d'un couple par mouvement à un
      // couple par série. Une séance démarrée avant ce déploiement n'a pas ce
      // champ — elle est reconnue à son `logInputs` et migrée au chargement.
      v: 2,
      startedAt: startedAtRef.current,
      // Le nom est persisté ici pour que la bannière « séance en cours »
      // (components/ResumeSessionBanner.tsx) l'affiche sans avoir à recharger
      // la séance complète — elle tirait tout le workout, ses blocs et tous ses
      // mouvements, juste pour ce libellé.
      name: workout.name,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, supersetBlocs, note, perfLog, started, workout])

  // Dernière perf (indices "la dernière fois" + PR)
  useEffect(() => {
    fetch(`/api/workouts/${id}/last-performance`).then(r => r.json()).then(d => setLastPerf(d || {})).catch(() => {})
  }, [id])

  // Pas de pré-remplissage : `lastPerf` ne sert plus qu'à afficher un indice
  // (placeholder du champ + ligne « Dernière : … »). Recopier la charge de la
  // séance précédente dans le champ revenait à proposer de stagner, et à envoyer
  // en base une valeur que personne n'avait saisie.

  // stopwatch — basé sur l'horloge réelle pour survivre à la mise en veille de l'onglet
  useEffect(() => {
    if (!started) return
    if (startedAtRef.current == null) startedAtRef.current = Date.now() - elapsedRef.current * 1000
    const t = setInterval(() => {
      setElapsed(startedAtRef.current != null ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)) : 0)
    }, 1000)
    return () => clearInterval(t)
  }, [started])

  // rest countdown
  useEffect(() => {
    if (!rest) return
    if (rest.sec <= 0) { setRest(null); notifyTimerEnd(); return }
    const t = setTimeout(() => setRest(r => r ? { ...r, sec: r.sec - 1 } : null), 1000)
    return () => clearTimeout(t)
  }, [rest])

  // exercise countdown (timed movements)
  useEffect(() => {
    if (!exerciseTimer) return
    if (exerciseTimer.sec <= 0) {
      setExerciseTimer(null)
      notifyTimerEnd()
      const wm = workout?.movements.find(m => m.id === exerciseTimer.wmId)
      if (!wm) return
      const target = wm.sets ?? 3
      const current = doneRef.current[wm.id] ?? 0
      if (current >= target) return
      const next = current + 1
      const restDur = (wm.rest && wm.rest >= 10) ? wm.rest : defaultRest
      if (wm.blockId && supersetBlocs.has(wm.blockId)) {
        const blocMovs = workout!.movements.filter(m => m.blockId === wm.blockId)
        const completedRounds = Math.min(...blocMovs.map(m => doneRef.current[m.id] ?? 0))
        const updatedDone = { ...doneRef.current, [wm.id]: next }
        setDone(() => updatedDone)
        const newRound = completedRounds + 1
        const roundDone = blocMovs.every(m => {
          const d = updatedDone[m.id] ?? 0
          return d >= newRound || d >= (m.sets ?? 3)
        })
        const allComplete = blocMovs.every(m => (updatedDone[m.id] ?? 0) >= (m.sets ?? 3))
        if (roundDone && !allComplete) setRest({ sec: restDur, total: restDur, wmId: wm.id })
        else setRest(null)
      } else {
        setDone(d => ({ ...d, [wm.id]: next }))
        if (next < target) setRest({ sec: restDur, total: restDur, wmId: wm.id })
        else setRest(null)
      }
      return
    }
    const t = setTimeout(() => setExerciseTimer(e => e ? { ...e, sec: e.sec - 1 } : null), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseTimer])

  const totalSets = useCallback(() => {
    if (!workout) return 0
    return workout.movements.reduce((s, wm) => s + (wm.sets ?? 3), 0)
  }, [workout])

  const doneSets = Object.values(done).reduce((a, b) => a + b, 0)
  const pct = workout ? Math.round((doneSets / Math.max(totalSets(), 1)) * 100) : 0
  const allDone = workout ? workout.movements.every(wm => (done[wm.id] ?? 0) >= (wm.sets ?? 3)) : false

  const hasBlocks = !!(workout && workout.blocks.length > 0)

  // Groupes affichés pendant la séance : les blocs, plus un groupe final pour
  // les mouvements rattachés à aucun bloc.
  //
  // Sans ce dernier, une séance comportant des blocs mais dont certains
  // mouvements ont `blockId = null` les faisait purement et simplement
  // disparaître de l'écran : la liste ne montrait plus que des en-têtes de
  // blocs vides, et il devenait impossible de s'entraîner.
  const orphanMovements: WM[] = workout && hasBlocks
    ? workout.movements.filter(wm => !wm.blockId || !workout.blocks.some(b => b.id === wm.blockId))
    : []
  const displayBlocks: (Block | null)[] = workout
    ? (hasBlocks ? [...workout.blocks, ...(orphanMovements.length > 0 ? [null] : [])] : [null])
    : []

  // Current movement = next to do, superset-aware (picks active movement in current round)
  const currentWm = (() => {
    if (!workout) return null
    for (const block of displayBlocks) {
      const movs = block ? workout.movements.filter(wm => wm.blockId === block.id) : (hasBlocks ? orphanMovements : workout.movements)
      const incomplete = movs.filter(m => (done[m.id] ?? 0) < (m.sets ?? 3))
      if (incomplete.length === 0) continue
      if (block && supersetBlocs.has(block.id)) {
        const completedRounds = Math.min(...movs.map(m => done[m.id] ?? 0))
        return incomplete.find(m => (done[m.id] ?? 0) === completedRounds) ?? incomplete[0]
      }
      return incomplete[0]
    }
    return null
  })()
  const rawEmbed = currentWm?.movement.videoUrl ? getEmbedInfo(currentWm.movement.videoUrl) : null
  // Instagram ne supporte pas l'autoplay en iframe — pas de panneau vidéo dans ce cas
  const currentEmbed = rawEmbed && rawEmbed.type !== 'instagram' ? rawEmbed : null

  // Mouvements suivants (hors mouvement actif), dans l'ordre de la séance —
  // bande "À suivre" sous la scène vidéo.
  const upNext = workout
    ? workout.movements.filter(wm => wm.id !== currentWm?.id && (done[wm.id] ?? 0) < (wm.sets ?? 3)).slice(0, 5)
    : []

  const handleSet = (wm: WM) => {
    ensureAudio()
    if (wm.duration != null) {
      if (!started) setStarted(true)
      const target = wm.sets ?? 3
      const current = done[wm.id] ?? 0
      if (current >= target) return
      setExerciseTimer({ wmId: wm.id, sec: wm.duration, total: wm.duration })
      return
    }
    if (!started) setStarted(true)
    const target = wm.sets ?? 3
    const current = done[wm.id] ?? 0
    if (current >= target) return
    const restDur = (wm.rest && wm.rest >= 10) ? wm.rest : defaultRest

    if (wm.blockId && supersetBlocs.has(wm.blockId)) {
      const blocMovs = workout!.movements.filter(m => m.blockId === wm.blockId)
      const completedRounds = Math.min(...blocMovs.map(m => done[m.id] ?? 0))
      // Enforce order: only the active movement in the current round can be clicked
      if (current > completedRounds) return
      const next = current + 1
      const updatedDone = { ...done, [wm.id]: next }
      setDone(() => updatedDone)
      // Round is done when every movement has completed >= completedRounds+1 or hit its target
      const newRound = completedRounds + 1
      const roundDone = blocMovs.every(m => {
        const d = updatedDone[m.id] ?? 0
        return d >= newRound || d >= (m.sets ?? 3)
      })
      // Toute série déclarée réinitialise le repos : repos frais si le round est bouclé
      // (et pas fini), sinon on coupe le repos en cours (on est reparti au travail).
      const allComplete = blocMovs.every(m => (updatedDone[m.id] ?? 0) >= (m.sets ?? 3))
      if (roundDone && !allComplete) setRest({ sec: restDur, total: restDur, wmId: wm.id })
      else setRest(null)
    } else {
      const next = current + 1
      setDone(d => ({ ...d, [wm.id]: next }))
      // Repos frais si séries restantes, sinon coupé (mouvement terminé)
      if (next < target) setRest({ sec: restDur, total: restDur, wmId: wm.id })
      else setRest(null)
    }
  }

  const handleUndo = (wm: WM) => {
    const current = done[wm.id] ?? 0
    if (current <= 0) return
    setDone(d => ({ ...d, [wm.id]: current - 1 }))
    setRest(null)
  }

  const handleFinish = async () => {
    setFinishing(true)
    // Construit le log de perf : une ligne par série validée, à la charge saisie
    // POUR CETTE série. Les mouvements chronométrés loggent charge + séries, reps null.
    const sets = workout
      ? workout.movements.flatMap(wm => {
          const n = done[wm.id] ?? 0
          if (n <= 0) return []
          const rows = perfLog[wm.id] ?? []
          // Seules les séries validées partent en base. Une ligne saisie puis
          // annulée (↩) reste en mémoire sans être enregistrée, et réapparaît
          // telle quelle si la série est refaite.
          return Array.from({ length: n }, (_, i) => ({
            movementId: wm.movement.id,
            setNumber: i + 1,
            weight: num(rows[i]?.weight),
            // À défaut de saisie, la consigne de la séance si c'est un nombre
            // simple : « 8-12 » ou « 12 par côté » n'est pas une performance,
            // `num` les rejette plutôt que d'en deviner une.
            reps: num(rows[i]?.reps) ?? (wm.duration != null ? null : num(wm.reps)),
          }))
        })
      : []
    // La charge utile est écrite sur l'appareil AVANT l'envoi : c'est tout le
    // correctif. Si le POST échoue, si l'onglet est tué pendant la requête ou si
    // iOS suspend la PWA en arrière-plan, la séance existe déjà quelque part, et
    // ResumeSessionBanner la rejouera au prochain montage ou au retour du réseau.
    const pendingKey = `${id}:${Date.now()}`
    enqueuePendingSession({
      key: pendingKey,
      workoutId: id,
      workoutName: workout?.name ?? null,
      note: note || undefined,
      sets,
      finishedAt: Date.now(),
    })
    // L'état « séance en cours » s'efface dès la mise en file. Le laisser
    // proposerait de « reprendre » une séance déjà terminée, et la terminer une
    // seconde fois créerait un doublon que rien, dans l'application, ne permet
    // de supprimer.
    localStorage.removeItem(storageKey)

    // Délai plus large qu'au chargement : la route crée la séance puis insère
    // toutes ses séries. Et comme elle n'a aucune clé d'idempotence, couper trop
    // tôt relancerait au rejeu un envoi que le serveur a peut-être déjà commis.
    const res = await fetch(`/api/workouts/${id}/sessions`, {
      signal: withTimeout(20000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || undefined, sets }),
    }).catch(() => null)
    // 201 strictement : un `res.ok` large accepterait le 200 d'un portail Wi-Fi
    // captif, et on retirerait de la file la seule copie de la séance.
    if (res?.status === 201) {
      dequeuePendingSession(pendingKey)
    } else {
      // Rien n'est perdu et il n'y a rien à refaire : l'ancien « Impossible
      // d'enregistrer — réessaie » était faux dans les deux sens.
      toast('Séance enregistrée sur l\'appareil — envoi dès le retour du réseau.', 'info')
    }
    router.push(`/workouts/${id}`)
  }

  // Sortie de secours. Sans ce bloc, un refus d'acces comme une coupure reseau
  // laissaient « Chargement… » plein ecran : ni retour, ni nouvel essai, et le
  // bouton systeme de retour arriere comme seule issue en pleine salle.
  if (loadError) {
    const titre = loadError === 'auth' ? 'Session expirée' : loadError === 'denied' ? 'Séance introuvable' : 'Serveur injoignable'
    const detail = loadError === 'auth'
      ? 'Reconnecte-toi pour reprendre la séance.'
      : loadError === 'denied'
        ? 'Cette séance n’existe plus, ou elle ne t’est pas partagée.'
        : 'Pas de réponse du serveur. Dès que le réseau revient, la séance repart où tu l’avais laissée.'
    const btnPrimaire: React.CSSProperties = {
      minHeight: 44, padding: 'var(--sp-3) var(--sp-6)', borderRadius: 'var(--r-sm)',
      background: 'var(--accent)', border: 'none', color: 'var(--on-accent)',
      fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--elev-1)',
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-6)', textAlign: 'center' }}>
        <div className="display" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--text-primary)' }}>{titre}</div>
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.5 }}>{detail}</div>
        {draft && (
          // Mousse : ces series sont de l'accompli, et c'est la seule chose a
          // rassurer ici — l'echec n'a pas touche le brouillon en localStorage.
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--green)', background: 'var(--cypress-ghost)', border: '1px solid rgba(134,160,107,0.25)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3) var(--sp-4)', maxWidth: 340, lineHeight: 1.5 }}>
            {draft.name ? `${draft.name} — ` : ''}{draft.doneSets} série{draft.doneSets > 1 ? 's' : ''} déjà cochée{draft.doneSets > 1 ? 's' : ''}, conservée{draft.doneSets > 1 ? 's' : ''} sur ce téléphone.
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--sp-2)' }}>
          {loadError === 'network' && (
            // Terracotta, action unique de l'ecran : c'est le seul cas ou un
            // nouvel essai a une chance d'aboutir, et il rejoue le chargement
            // complet — brouillon restauré compris.
            <button onClick={() => loadRef.current()} style={btnPrimaire}>Réessayer</button>
          )}
          {loadError === 'auth' && (
            <button onClick={() => router.push(`/login?redirect=/workouts/${id}/active`)} style={btnPrimaire}>Se reconnecter</button>
          )}
          <button onClick={() => router.push(loadError === 'denied' ? '/workouts' : `/workouts/${id}`)}
            style={{ minHeight: 44, padding: 'var(--sp-3) var(--sp-5)', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--border-plus)', color: 'var(--text-muted)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>
            {loadError === 'denied' ? 'Mes séances' : 'Retour à la séance'}
          </button>
        </div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
        Chargement…
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header + bouton d'action collants ── : sur un superset à rallonge, la
          vidéo défile hors écran et cocher l'exercice en cours devient une
          chasse au scroll. Ce bandeau reste visible en permanence et déclenche
          exactement la même action que la ligne du mouvement actif — plus
          besoin de chercher, on tape le gros bouton dès qu'on est prêt. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.push(`/workouts/${id}`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex', lineHeight: 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
              {workout.movements.length} mouvement{workout.movements.length > 1 ? 's' : ''} · {doneSets}/{totalSets()} séries
            </div>
          </div>
          {/* Cadran du chrono — aplat or massif, texte encre */}
          <div className="tnum display" style={{
            fontSize: 22, fontWeight: 700, flexShrink: 0, lineHeight: 1,
            padding: '9px 16px', borderRadius: 'var(--r-sm)',
            background: started ? 'linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 100%)' : 'var(--bg-elevated)',
            color: started ? 'var(--ink)' : 'var(--text-dim)',
            boxShadow: started ? 'var(--elev-gold)' : 'none',
            transition: 'background 0.3s, color 0.3s',
          }}>
            {fmt(elapsed)}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', background: allDone ? 'var(--green)' : 'var(--gold)', width: `${pct}%`, transition: 'width 0.4s ease' }} />
        </div>

        {/* ── Bouton d'action toujours visible : coche le mouvement actif ── */}
        {currentWm && (
          <button
            onClick={() => handleSet(currentWm)}
            disabled={exerciseTimer?.wmId === currentWm.id}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
              background: 'var(--accent)', border: 'none', borderBottom: '1px solid var(--border)',
              cursor: exerciseTimer?.wmId === currentWm.id ? 'default' : 'pointer',
              opacity: exerciseTimer?.wmId === currentWm.id ? 0.6 : 1, textAlign: 'left',
            }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F8F4EC" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(248,244,236,0.75)' }}>
                {currentWm.duration != null ? 'Lancer' : 'Série suivante'} · {(done[currentWm.id] ?? 0) + 1}/{currentWm.sets ?? 3}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F8F4EC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentWm.movement.name}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ── Scène : vidéo pleine largeur + HUD superposé (mouvement actif) ── */}
      {currentWm && (() => {
        const target = currentWm.sets ?? 3
        const setsNow = done[currentWm.id] ?? 0
        const ringProgress = target > 0 ? setsNow / target : 0
        const circumference = 2 * Math.PI * 64
        return (
          <div style={{ maxWidth: 980, margin: '0 auto', width: '100%', padding: '16px 16px 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>

              {/* Cadre vidéo (ou placeholder si pas de vidéo) */}
              {/* Format suivant l'écran plutôt qu'un 16/10 fixe : les démos
                  d'exercice sont très souvent tournées en vertical, et un embed
                  YouTube ne peut pas être recadré en `cover` — une vidéo
                  verticale se retrouvait avec d'énormes bandes noires
                  latérales sur téléphone. Le 4/5 mobile les réduit nettement
                  tout en gardant le 16/10 éditorial sur grand écran. */}
              <div className="wod-video-stage" style={{ position: 'relative', flex: '1 1 480px', minWidth: 280, borderRadius: 18, overflow: 'hidden', background: 'radial-gradient(ellipse at 38% 30%, #3a3428 0%, #221f1a 45%, #0e0d0a 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {currentEmbed ? (
                  currentEmbed.type === 'video' ? (
                    <video key={currentEmbed.url} src={currentEmbed.url} autoPlay muted loop playsInline controls
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : currentEmbed.type === 'youtube' && extractEmbedVideoId(currentEmbed.url) ? (
                    <YouTubeLoopEmbed videoId={extractEmbedVideoId(currentEmbed.url)!} />
                  ) : (
                    <iframe key={currentEmbed.url} src={currentEmbed.url}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  )
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 32%, transparent 70%, rgba(0,0,0,0.25) 100%)', pointerEvents: 'none' }} />
                {currentEmbed && (
                  <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--crimson-bright)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#F0EBE1' }}>DÉMONSTRATION</span>
                  </div>
                )}
                <div style={{ position: 'absolute', left: 18, bottom: 16, right: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--crimson-bright)', textTransform: 'uppercase', marginBottom: 3 }}>Mouvement actif</div>
                  <div className="display" style={{ fontSize: 24, fontWeight: 700, color: '#F8F4EC', lineHeight: 1.15 }}>{currentWm.movement.name}</div>
                </div>
              </div>

              {/* HUD superposé : anneau de séries + repos */}
              <div style={{ flex: '0 1 240px', minWidth: 220, borderRadius: 18, background: 'rgba(23,19,15,0.55)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.10)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 130, height: 130 }}>
                  <svg width="130" height="130" viewBox="0 0 130 130">
                    <circle cx="65" cy="65" r="64" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                    <circle cx="65" cy="65" r="64" fill="none" stroke="url(#activeRingGrad)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ringProgress)}
                      transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
                    <defs>
                      <linearGradient id="activeRingGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--gold-bright)" />
                        <stop offset="100%" stopColor="var(--crimson-bright)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="display" style={{ fontSize: 30, fontWeight: 800, color: '#F8F4EC' }}>{setsNow}/{target}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>séries</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Array.from({ length: target }).map((_, i) => (
                    <span key={i} className="tnum" style={{
                      width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                      background: i < setsNow ? 'linear-gradient(160deg, var(--gold-bright), var(--gold))' : 'rgba(255,255,255,0.06)',
                      color: i < setsNow ? '#17130F' : 'rgba(255,255,255,0.35)',
                      border: i < setsNow ? 'none' : '1px solid rgba(255,255,255,0.12)',
                    }}>{i + 1}</span>
                  ))}
                </div>
                {rest?.wmId === currentWm.id && (
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                      <svg width="36" height="36" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5" />
                        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--crimson-bright)" strokeWidth="3.5" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - rest.sec / rest.total)} transform="rotate(-90 18 18)" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#F0EBE1' }}>{rest.sec}</div>
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#F0EBE1' }}>Repos en cours</div>
                  </div>
                )}
              </div>
            </div>

            {/* À suivre */}
            {upNext.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 8 }}>À suivre</div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {upNext.map((wm, i) => (
                    <div key={wm.id} style={{
                      flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 11,
                      background: i === 0 ? 'rgba(201,165,53,0.12)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${i === 0 ? 'rgba(201,165,53,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: BIO_TYPE_COLORS[wm.movement.bioType] || '#888', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 600, color: i === 0 ? '#F8F4EC' : 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>{wm.movement.name}</div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)' }}>{wm.movement.bioType} · {wm.sets ?? 3} séries</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Default rest selector ── */}
      <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Repos par défaut</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {REST_OPTIONS.map(s => (
            <button key={s} onClick={() => setDefaultRest(s)}
              style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${defaultRest === s ? 'var(--crimson)' : 'rgba(255,255,255,0.1)'}`, background: defaultRest === s ? 'var(--crimson-ghost)' : 'transparent', color: defaultRest === s ? 'var(--crimson-bright)' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}>
              {s}s
            </button>
          ))}
        </div>
      </div>

      {/* ── Movements ── */}
      <div style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
        {displayBlocks.map((block, bi) => {
          const movs = block ? workout.movements.filter(wm => wm.blockId === block.id) : (hasBlocks ? orphanMovements : workout.movements)
          const isSuperset = !!(block?.id && supersetBlocs.has(block.id))
          const completedRounds = isSuperset ? Math.min(...movs.map(m => done[m.id] ?? 0)) : 0
          const maxRounds = isSuperset ? Math.max(...movs.map(m => m.sets ?? 3)) : 0
          const blocAllDone = isSuperset && movs.every(m => (done[m.id] ?? 0) >= (m.sets ?? 3))
          // Active movement in current superset round = first incomplete that hasn't done this round yet
          const incompleteMovs = isSuperset ? movs.filter(m => (done[m.id] ?? 0) < (m.sets ?? 3)) : []
          const activeMovId = isSuperset ? incompleteMovs.find(m => (done[m.id] ?? 0) === completedRounds)?.id : undefined
          return (
            <div key={block?.id ?? 'solo'} style={{ marginBottom: hasBlocks ? 20 : 0 }}>
              {hasBlocks && (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingLeft: 4, gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', flex: 1 }}>
                    {block ? `Bloc ${bi + 1}` : 'Hors bloc'}{block?.bioType ? ` · ${block.bioType}` : ''}{block?.instructions ? ` · ${block.instructions}` : ''}
                    {isSuperset && !blocAllDone && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>· Round {completedRounds + 1}/{maxRounds}</span>}
                    {isSuperset && blocAllDone && <span style={{ color: 'var(--green)', marginLeft: 6 }}>· Terminé</span>}
                  </div>
                  {movs.length > 1 && block?.id && (
                    <button onClick={() => toggleSuperset(block.id)}
                      style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: `1px solid ${isSuperset ? 'var(--crimson)' : 'rgba(255,255,255,0.15)'}`, background: isSuperset ? 'var(--crimson-ghost)' : 'transparent', color: isSuperset ? 'var(--crimson-bright)' : 'rgba(255,255,255,0.3)', transition: 'all 0.15s', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      ⚡ Superset
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {movs.map(wm => {
                  const target = wm.sets ?? 3
                  const setsNow = done[wm.id] ?? 0
                  const isComplete = setsNow >= target
                  const isCurrent = !isSuperset && currentWm?.id === wm.id
                  const isDoneInRound = isSuperset && !isComplete && setsNow > completedRounds
                  const isActiveInRound = isSuperset && !isComplete && wm.id === activeMovId
                  const isResting = rest?.wmId === wm.id
                  const color = BIO_TYPE_COLORS[wm.movement.bioType] || '#888'

                  // Trois registres : sombre = contexte · terracotta = maintenant · mousse = fait.
                  //
                  // Le mouvement actif était rendu sur une plaque ivoire (#F5F1E8)
                  // bordée d'or. Sur un écran de séance en plein écran quasi noir,
                  // cela donnait un rectangle blanc éblouissant — pénible le soir —
                  // et en contradiction avec le reste de la charte, où « le
                  // maintenant » est le terracotta : le bouton d'action collant en
                  // haut de page et l'anneau de repos l'emploient déjà. Le contraste
                  // qui rendait la carte repérable est conservé, mais par la bordure
                  // et le halo plutôt qu'en inversant la luminosité.
                  const isNow = (isCurrent || isActiveInRound) && !isComplete
                  const cardBg = isComplete ? 'var(--cypress-ghost)' : isDoneInRound ? 'rgba(58,94,72,0.15)' : isNow ? 'var(--crimson-ghost)' : 'var(--bg-card)'
                  const cardBorder = isComplete ? 'rgba(127,184,148,0.30)' : isDoneInRound ? 'rgba(127,184,148,0.18)' : isNow ? 'var(--crimson)' : isResting ? 'var(--crimson-border)' : 'var(--border)'
                  const nameColor = isComplete || isDoneInRound ? 'var(--green)' : isNow ? 'var(--text-primary)' : 'var(--text-muted)'
                  const subColor = isNow ? 'rgba(240,235,225,0.72)' : 'rgba(255,255,255,0.45)'
                  const dimColor = isNow ? 'rgba(240,235,225,0.45)' : 'rgba(255,255,255,0.25)'
                  const timedColor = 'var(--blue)'

                  return (
                    <div key={wm.id} style={{
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      borderRadius: 'var(--r-md)', padding: '14px 16px',
                      boxShadow: isNow ? '0 0 0 1px var(--crimson-border), 0 6px 24px rgba(180,85,45,0.20)' : 'none',
                      transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 15, fontWeight: isNow ? 700 : 600, color: nameColor }}>
                          {wm.movement.name}
                        </span>
                        {(isComplete || isDoneInRound) && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </div>

                      {/* Set circles + label */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {Array.from({ length: target }).map((_, i) => (
                            <span key={i} className="tnum" style={{
                              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                              // Une série faite est une série faite : mousse dans tous les cas.
                              // Elle était or pour un mouvement en répétitions et bleu pour un
                              // mouvement chronométré — deux couleurs pour un même état.
                              background: i < setsNow ? 'var(--green)' : (isNow ? 'rgba(240,235,225,0.08)' : 'rgba(255,255,255,0.07)'),
                              color: i < setsNow ? 'var(--ink)' : (isNow ? 'rgba(240,235,225,0.55)' : 'rgba(255,255,255,0.3)'),
                              border: `1px solid ${i < setsNow ? 'transparent' : (isNow ? 'rgba(240,235,225,0.22)' : 'rgba(255,255,255,0.1)')}`,
                              transition: 'all 0.2s',
                            }}>
                              {i + 1}
                            </span>
                          ))}
                        </div>
                        {wm.duration != null ? (
                          <span style={{ fontSize: 13, color: timedColor, marginLeft: 4, fontWeight: 600 }}>{wm.duration}s</span>
                        ) : wm.reps ? (
                          <span style={{ fontSize: 13, color: subColor, marginLeft: 4 }}>{wm.reps}</span>
                        ) : null}
                        {wm.rest && wm.rest >= 10 && wm.rest !== defaultRest && (
                          <span style={{ fontSize: 11, color: dimColor, marginLeft: 'auto' }}>repos {wm.rest}s</span>
                        )}
                      </div>

                      {/* ── Saisie, une ligne par série ──────────────────────────
                          Un couple unique par mouvement enregistrait la même charge
                          pour toutes les séries : monter de 40 à 50 kg entre la 1re
                          et la 3e écrivait trois fois la même valeur fausse.
                          Les lignes s'ouvrent au fur et à mesure (séries faites, plus
                          la suivante sur le mouvement en cours) : afficher d'emblée
                          toutes les séries de tous les mouvements ferait un mur de
                          champs sur un écran de téléphone. */}
                      {(() => {
                        const lp = lastPerf[wm.movement.id]
                        const rows = perfLog[wm.id] ?? []
                        const hasHint = !!(lp?.last && (lp.last.weight != null || lp.last.reps != null))
                        // Séries faites + la suivante quand c'est le mouvement actif :
                        // on remplit après avoir soulevé, pas avant la séance.
                        const visibleRows = Math.min(target, isNow ? setsNow + 1 : setsNow)
                        if (visibleRows === 0 && !hasHint) return null
                        // Le PR se juge sur la série la plus lourde SAISIE : c'est
                        // très souvent la dernière qui bat le record, pas la première.
                        const topTyped = rows.reduce((max, r) => {
                          const v = num(r?.weight)
                          return v != null && v > max ? v : max
                        }, 0)
                        const isPR = lp?.bestWeight != null && topTyped > 0 && topTyped > lp.bestWeight
                        const fieldStyle: React.CSSProperties = {
                          textAlign: 'center', borderRadius: 'var(--r-sm)', padding: '11px 6px', minHeight: 44,
                          fontSize: 'var(--fs-body)', fontWeight: 700, outline: 'none',
                          background: isNow ? 'rgba(240,235,225,0.08)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${isNow ? 'rgba(240,235,225,0.22)' : 'rgba(255,255,255,0.12)'}`,
                          color: 'var(--text-primary)',
                        }
                        const borderDim = isNow ? 'rgba(240,235,225,0.22)' : 'rgba(255,255,255,0.12)'
                        return (
                          <div style={{ marginBottom: 'var(--sp-3)' }}>
                            {/* La dernière charge connue est un indice — placeholder grisé
                                et rappel « Dernière : … » — jamais une valeur posée dans
                                le champ. Le record ne se
                                pose plus a cote sous forme de trophée : c’est la charge saisie
                                elle-même qui passe en or. La marque est frappée dans la piece. */}
                            {hasHint && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
                                {hasHint && (
                                  <span style={{ fontSize: 'var(--fs-micro)', color: dimColor, whiteSpace: 'nowrap' }}>
                                    Dernière&nbsp;: {lp!.last!.weight != null ? `${lp!.last!.weight}kg` : ''}{lp!.last!.weight != null && lp!.last!.reps != null ? ' × ' : ''}{lp!.last!.reps != null ? lp!.last!.reps : ''}
                                  </span>
                                )}
                              </div>
                            )}
                            {Array.from({ length: visibleRows }).map((_, i) => {
                              const row = rows[i]
                              const isPending = i >= setsNow
                              // Proposé seulement quand il y a de quoi reprendre et que la
                              // ligne est encore vide : un bouton inerte ou destructeur
                              // n'a rien à faire sous le pouce en pleine série.
                              const canCopy = i > 0 && num(rows[i - 1]?.weight) != null && !row?.weight
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: i === 0 ? 0 : 'var(--sp-2)' }}>
                                  {/* Mousse = l'accompli ; la série à venir reste neutre. Le
                                      terracotta est déjà pris par « Série suivante » juste
                                      en dessous — deux actions terracotta sur la même carte
                                      se disputeraient le regard. */}
                                  <span className="tnum" style={{
                                    width: 20, flexShrink: 0, textAlign: 'center',
                                    fontSize: 'var(--fs-micro)', fontWeight: 800,
                                    color: isPending ? dimColor : 'var(--green)',
                                  }}>{i + 1}</span>
                                  {/* type="text" + inputMode plutôt que type="number" : ce
                                      dernier refuse la virgule du pavé numérique iOS, change
                                      de valeur à la molette et affiche des flèches minuscules
                                      — intenable à une main entre deux séries. */}
                                  <input type="text" inputMode="decimal" enterKeyHint="next"
                                    aria-label={`Charge série ${i + 1} — ${wm.movement.name}`}
                                    placeholder={lp?.last?.weight != null ? String(lp.last.weight) : 'kg'}
                                    value={row?.weight ?? ''}
                                    onChange={e => setLog(wm.id, i, 'weight', e.target.value)}
                                    style={{ ...fieldStyle, width: 74,
                                      // L’or sur la seule serie qui bat le record, pas sur
                                      // toutes : c’est un fait precis, pas une decoration.
                                      ...(isPR && num(row?.weight) != null && num(row?.weight) === topTyped
                                        ? { color: 'var(--gold)', borderColor: 'var(--gold-border)' }
                                        : null) }} />
                                  {wm.duration != null ? (
                                    // Mouvement chronométré : la durée est la consigne, mais la
                                    // charge n'avait aucun champ — une planche lestée était
                                    // tout simplement impossible à enregistrer.
                                    <span style={{ color: dimColor, fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap' }}>kg&nbsp;·&nbsp;{wm.duration}s</span>
                                  ) : (
                                    <>
                                      <span style={{ color: dimColor, fontSize: 'var(--fs-sm)', fontWeight: 700 }}>kg&nbsp;×</span>
                                      <input type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done"
                                        aria-label={`Répétitions série ${i + 1} — ${wm.movement.name}`}
                                        placeholder={lp?.last?.reps != null ? String(lp.last.reps) : 'reps'}
                                        value={row?.reps ?? ''}
                                        onChange={e => setLog(wm.id, i, 'reps', e.target.value)}
                                        style={{ ...fieldStyle, width: 66 }} />
                                    </>
                                  )}
                                  {canCopy && (
                                    <button type="button" onClick={() => copyPrevSet(wm.id, i)}
                                      title="Reprendre la saisie de la série précédente"
                                      aria-label={`Reprendre la saisie de la série ${i}`}
                                      style={{ marginLeft: 'auto', minWidth: 44, minHeight: 44, borderRadius: 'var(--r-sm)', background: 'transparent', border: `1px solid ${borderDim}`, color: isNow ? 'rgba(240,235,225,0.6)' : 'rgba(255,255,255,0.35)', fontSize: 'var(--fs-body)', cursor: 'pointer' }}>
                                      ↑
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* Exercise timer in-card (timed mode, currently running) */}
                      {wm.duration != null && exerciseTimer?.wmId === wm.id && (
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                          <ProgressRing progress={exerciseTimer.sec / exerciseTimer.total} size={96} stroke={5} color="var(--crimson-bright)" track={'rgba(240,235,225,0.12)'}>
                            <span className="tnum display" style={{ fontSize: 27, fontWeight: 700, color: 'var(--text-primary)' }}>{exerciseTimer.sec}</span>
                          </ProgressRing>
                        </div>
                      )}

                      {/* Action button */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {wm.duration != null ? (
                          <>
                            <button
                              onClick={() => handleSet(wm)}
                              disabled={isComplete || (isSuperset && wm.id !== activeMovId) || exerciseTimer?.wmId === wm.id}
                              style={{
                                flex: 1, padding: '13px', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: isNow ? 800 : 700,
                                cursor: isComplete || exerciseTimer?.wmId === wm.id ? 'default' : 'pointer',
                                // Terracotta comme le bouton de série : c'est le même geste,
                                // « fais cet exercice maintenant ». Le caractère chronométré
                                // est déjà porté par le libellé (« ▶ Démarrer · 60s ») — il
                                // n'a pas besoin d'un bleu acier qui n'a aucun rôle dans la
                                // charte et qui formait un pavé délavé sur la carte active.
                                background: isComplete ? 'var(--cypress-ghost)' : exerciseTimer?.wmId === wm.id ? 'transparent' : isNow ? 'var(--accent)' : 'var(--crimson-ghost)',
                                border: `1px solid ${isComplete ? 'rgba(127,184,148,0.25)' : isNow && exerciseTimer?.wmId !== wm.id ? 'transparent' : 'var(--crimson-border)'}`,
                                color: isComplete ? 'var(--green)' : isNow && exerciseTimer?.wmId !== wm.id ? 'var(--on-accent)' : 'var(--crimson-bright)',
                                transition: 'all 0.15s',
                              }}>
                              {isComplete ? '✓ Terminé' : exerciseTimer?.wmId === wm.id ? '⏱ En cours…' : `▶ Démarrer · ${wm.duration}s`}
                            </button>
                            {exerciseTimer?.wmId === wm.id && (
                              <button onClick={() => setExerciseTimer(e => e ? { ...e, sec: 0 } : null)}
                                style={{ minHeight: 44, padding: '10px 16px', borderRadius: 'var(--r-sm)', fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid var(--crimson-border)', color: 'var(--crimson-bright)' }}
                                title="Valider maintenant sans attendre la fin du timer">
                                ✓ Skip
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleSet(wm)} disabled={isComplete || (isSuperset && wm.id !== activeMovId)}
                              style={{
                                flex: 1, padding: '13px', borderRadius: 'var(--r-sm)', fontSize: 14, cursor: isComplete ? 'default' : 'pointer',
                                fontWeight: isNow ? 800 : 700,
                                letterSpacing: isNow ? '0.03em' : 0,
                                textTransform: isNow ? 'uppercase' : 'none',
                                // Terracotta plein pour le mouvement actif : geste principal de
                                // la séance, identique à celui du bouton collant en haut de
                                // page — qui était déjà terracotta. L'or était employé ici
                                // alors qu'il appartient à la marque et à la progression.
                                background: isComplete ? 'var(--cypress-ghost)' : isNow ? 'var(--accent)' : 'var(--crimson-ghost)',
                                border: `1px solid ${isComplete ? 'rgba(127,184,148,0.25)' : isNow ? 'transparent' : 'var(--crimson-border)'}`,
                                color: isComplete ? 'var(--green)' : isNow ? 'var(--on-accent)' : 'var(--crimson-bright)',
                                boxShadow: isNow ? 'var(--elev-1)' : 'none',
                                transition: 'all 0.15s',
                              }}>
                              {isComplete ? '✓ Terminé' : `Série ${setsNow + 1} / ${target}`}
                            </button>
                            {setsNow > 0 && !isComplete && (
                              <button onClick={() => handleUndo(wm)}
                                style={{ minWidth: 44, minHeight: 44, padding: '10px 16px', borderRadius: 'var(--r-sm)', fontSize: 14, cursor: 'pointer', background: 'transparent', border: `1px solid ${isNow ? 'rgba(240,235,225,0.22)' : 'rgba(255,255,255,0.1)'}`, color: isNow ? 'rgba(240,235,225,0.6)' : 'rgba(255,255,255,0.35)' }}>
                                ↩
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Minuteur de repos ──────────────────────────────────────────────
          Panneau sombre, pas ivoire. L'écran de séance est un plein écran
          quasi noir : un cartouche clair y perçait un trou lumineux, à contre-
          emploi de la charte — et éblouissant quand on s'entraîne le soir.
          L'anneau porte désormais le terracotta, comme le petit anneau de
          repos déjà présent dans le bandeau vidéo de ce même écran : le repos
          est bien « le maintenant », il n'a aucune raison d'être traité
          autrement à deux endroits de la même page. */}
      {rest && (
        <div className="modal-in" style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          borderRadius: 'var(--r-lg)', padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 18, minWidth: 288, maxWidth: 'calc(100vw - 32px)',
          background: 'rgba(29,25,20,0.94)',
          border: '1px solid var(--crimson-border)',
          boxShadow: 'var(--elev-3)',
          backdropFilter: 'blur(12px)',
        }}>
          <ProgressRing progress={rest.sec / rest.total} size={58} stroke={4} color="var(--crimson-bright)" track="rgba(240,235,225,0.10)">
            <span className="tnum display" style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>{rest.sec}</span>
          </ProgressRing>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--crimson-bright)', marginBottom: 3 }}>Repos</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workout.movements.find(wm => wm.id === rest.wmId)?.movement.name}
            </div>
          </div>
          <button onClick={() => setRest(null)}
            style={{ padding: '9px 15px', borderRadius: 'var(--r-sm)', background: 'none', border: '1px solid var(--border-plus)', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Passer
          </button>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
        {showFinish ? (
          <>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note optionnelle…"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }} />
            <button onClick={handleFinish} disabled={finishing}
              style={{ padding: '10px 20px', borderRadius: 9, background: 'var(--green)', border: 'none', color: 'var(--ink)', fontSize: 13, fontWeight: 800, cursor: finishing ? 'wait' : 'pointer', flexShrink: 0 }}>
              {finishing ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowFinish(false)}
              style={{ padding: '10px 14px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
              ✕
            </button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              {allDone ? '🎉 Toutes les séries terminées !' : `${pct}% · ${doneSets}/${totalSets()} séries`}
            </div>
            {/* Mousse — « l'accompli » dans la palette. L'or était réservé à la
                marque et à la progression, et le terracotta sert déjà au bouton
                de série suivante juste au-dessus : deux actions terracotta
                simultanées se seraient disputé le regard en pleine séance. */}
            <button onClick={() => setShowFinish(true)}
              style={{
                padding: '11px 24px', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
                background: allDone ? 'var(--green)' : 'var(--cypress-ghost)',
                border: `1px solid ${allDone ? 'transparent' : 'var(--cypress-light)'}`,
                color: allDone ? 'var(--ink)' : 'var(--cypress-light)',
                boxShadow: allDone ? '0 0 20px rgba(134,160,107,0.35)' : 'none',
                transition: 'all var(--t-med) var(--ease)',
              }}>
              {allDone ? '🏁 Terminer la séance' : 'Terminer'}
            </button>
          </>
        )}
      </div>

    </div>
  )
}
