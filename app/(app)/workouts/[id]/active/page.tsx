'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BIO_TYPE_COLORS } from '@/lib/types'
import { Modal, ProgressRing } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { getEmbedInfo, extractEmbedVideoId, youtubeThumbnail } from '@/lib/video'
// La vignette commande l'affichage de la demonstration : voir la zone B.
import { useConfirm } from '@/components/ConfirmDialog'
import YouTubeLoopEmbed from '@/components/YouTubeLoopEmbed'
// La file d'attente locale vit dans ResumeSessionBanner : c'est lui qui la rejoue
// et qui l'affiche, et il est monté sur le tableau de bord comme sur la page de
// détail — là où l'on retombe juste après avoir terminé une séance.
import { enqueuePendingSession, dequeuePendingSession } from '@/components/ResumeSessionBanner'

// `equipment` est deja renvoye par GET /api/workouts/[id] (include movement:
// true) ; il n'etait simplement pas declare ici. « Poids corps » vaut pour 137
// des 377 mouvements du referentiel et decide si un champ de charge a un sens.
interface Movement { id: string; name: string; bioType: string; videoUrl?: string | null; equipment?: string | null }
interface WM { id: string; order: number; sets?: number | null; reps?: string | null; rest?: number | null; duration?: number | null; blockId?: string | null; movement: Movement }
interface Block { id: string; order: number; bioType?: string | null; instructions?: string | null; superset?: boolean }
interface Workout { id: string; name: string; duration?: number | null; movements: WM[]; blocks: Block[] }

const REST_OPTIONS = [30, 60, 90, 120]

// Mise en place : le temps de se mettre en position avant que le chrono
// d'exercice parte. 0 = aucune — on ne fait pas attendre celui qui est deja
// sous la barre.
const SETUP_OPTIONS = [0, 3, 5, 10]

// Demander la charge d'une traction est une question sans reponse : le champ
// est omis pour ces mouvements, et « + charge » reste a un appui pour le gilet.
const isBodyweight = (eq?: string | null) => (eq ?? '').trim().toLowerCase() === 'poids corps'

// Nom de la source, pour les plateformes qui n'exposent aucune vignette
// (Instagram, TikTok) : on annonce ou l'on envoie plutot que d'ouvrir un cadre
// 16/9 noir a la place d'une demonstration qui n'arrivera jamais.
const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', video: 'vidéo',
}
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

// Tour courant d'un bloc en circuit : le plus petit nombre de séries déjà
// faites, mais SEULEMENT parmi les mouvements qui n'ont pas encore atteint leur
// cible. Si tous y sont, le circuit est terminé et on retombe sur le minimum du
// bloc, faute de mieux à ouvrir.
//
// Le minimum brut sur TOUS les mouvements rendait la séance impossible à
// terminer : dès qu'un mouvement atteignait sa cible, il épinglait le minimum
// pour toujours. Le tour n'avançait plus, la porte d'ordre de `handleSet`
// refusait tous les autres mouvements du bloc, et « Terminer la séance »
// n'apparaissait jamais. Il suffisait de max(séries) > min(séries) + 1 dans le
// bloc — un circuit où une station tourne en 1 série et une autre en 3.
// `roundDone` avait déjà cette échappatoire (`d >= cible`) : c'est l'asymétrie
// entre les deux calculs qui verrouillait tout.
const tourCourantCircuit = (blocMovs: WM[], etatDone: Record<string, number>): number => {
  const enCours = blocMovs.filter(m => (etatDone[m.id] ?? 0) < (m.sets ?? 3))
  const base = enCours.length > 0 ? enCours : blocMovs
  // Math.min() sans argument vaut Infinity : un bloc vide ne doit pas ouvrir
  // une porte sur un tour imaginaire.
  if (base.length === 0) return 0
  return Math.min(...base.map(m => etatDone[m.id] ?? 0))
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
  // `endsAt` est la verite, `sec` n'est plus qu'un affichage. Les deux minuteurs
  // enchainaient des setTimeout de 1 s : la chaine s'arrete quand l'ecran se
  // verrouille, et le repos reprenait la ou il s'etait fige — alors que le
  // chronometre de seance, ancre sur Date.now(), repartait juste. Trois
  // compteurs, trois temps differents, et le son toujours en retard.
  const [rest, setRest] = useState<{ sec: number; total: number; wmId: string; endsAt: number } | null>(null)
  const [defaultRest, setDefaultRest] = useState(60)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const toast = useToast()
  const [note, setNote] = useState('')
  const [showFinish, setShowFinish] = useState(false)
  const [supersetBlocs, setSupersetBlocs] = useState<Set<string>>(new Set())
  const [exerciseTimer, setExerciseTimer] = useState<{ wmId: string; sec: number; total: number; endsAt: number } | null>(null)
  // Mise en place : decompte en gros chiffres avant le chrono d'exercice. Meme
  // ancrage horloge, meme raison.
  const [setup, setSetup] = useState<{ wmId: string; sec: number; total: number; endsAt: number } | null>(null)
  const [setupSeconds, setSetupSeconds] = useState(5)
  // Seconde deja sonnee. Un seul compteur suffit : mise en place, effort et
  // repos ne tournent jamais ensemble. Sans cette memoire, l'intervalle qui
  // rafraichit l'affichage plus vite qu'une seconde ferait tiquer plusieurs
  // fois la meme seconde.
  const tickedSecRef = useRef(-1)
  // Curseur pose a la main (rail, Precedent, Suivant). Null = on suit la
  // deduction « premiere serie non faite ». Un curseur explicite est
  // indispensable parce que « Suivant » doit pouvoir sauter un mouvement SANS
  // le declarer fait — ce qu'aucune derivation sur `done` ne sait exprimer.
  const [cursorWmId, setCursorWmId] = useState<string | null>(null)
  // Circuit : les charges se reglent avant le depart, et se corrigent apres. Un
  // bloc dont la preparation est acquittee ne la redemande plus.
  const [circuitPrepDone, setCircuitPrepDone] = useState<Set<string>>(new Set())
  const [circuitReview, setCircuitReview] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const confirm = useConfirm()
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

  // ── Les trois signaux ──────────────────────────────────────────────────
  // Trois, pas davantage : au-dela on ne les distingue plus a l'oreille, et
  // c'est tout l'interet — ne pas avoir a regarder l'ecran. Le tic sec des
  // trois dernieres secondes, la note montante au depart de l'effort, et les
  // deux notes de fin (notifyTimerEnd, deja la). Meme AudioContext : en creer
  // un par signal sature le quota d'iOS au bout de quelques series.
  const blip = (freq: number, dur: number, gain: number, from?: number) => {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state !== 'running') return
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime
      if (from != null) { o.frequency.setValueAtTime(from, t); o.frequency.linearRampToValueAtTime(freq, t + dur) }
      else o.frequency.value = freq
      g.gain.setValueAtTime(0.001, t)
      g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.start(t); o.stop(t + dur + 0.02)
    } catch {}
  }
  // Court et haut : le tic se place dans le silence sans couvrir la musique.
  const tick = () => blip(1650, 0.055, 0.16)
  // Un glissando montant ne se confond pas avec les deux notes piquees de la
  // fin : « ca part » et « c'est fini » doivent s'entendre sans reflechir.
  const riseNote = () => blip(990, 0.26, 0.22, 330)

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

  // ── Lancements : un seul endroit pose les echeances ────────────────────
  // Chaque minuteur recoit `endsAt` ET `sec`. Les poser a la main sur chaque
  // site d'appel est precisement ce qui laissait quatre `setRest` divergents.
  const startRest = (wmId: string, sec: number) => {
    tickedSecRef.current = -1
    setRest({ wmId, sec, total: sec, endsAt: Date.now() + sec * 1000 })
  }
  const startExercise = (wmId: string, sec: number) => {
    tickedSecRef.current = -1
    riseNote()
    setExerciseTimer({ wmId, sec, total: sec, endsAt: Date.now() + sec * 1000 })
  }
  // Mise en place d'abord, chrono ensuite. Reglable, 0 = aucune.
  const startWithSetup = (wmId: string, sec: number) => {
    if (setupSeconds <= 0) { startExercise(wmId, sec); return }
    tickedSecRef.current = -1
    setSetup({ wmId, sec: setupSeconds, total: setupSeconds, endsAt: Date.now() + setupSeconds * 1000 })
  }

  // Decompte de mise en place. Un tic a CHAQUE seconde, et non seulement sur
  // les trois dernieres : la mise en place est courte, et le tic est le seul
  // signal disponible quand on a la tete sous la barre.
  useEffect(() => {
    if (!setup) return
    if (setup.sec <= 0) {
      const wm = workout?.movements.find(m => m.id === setup.wmId)
      setSetup(null)
      if (wm?.duration != null) startExercise(wm.id, wm.duration)
      return
    }
    if (tickedSecRef.current !== setup.sec) { tickedSecRef.current = setup.sec; tick() }
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((setup.endsAt - Date.now()) / 1000))
      setSetup(s => (s && s.sec !== left ? { ...s, sec: left } : s))
    }, 200)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup])

  // rest countdown
  useEffect(() => {
    if (!rest) return
    if (rest.sec <= 0) { setRest(null); notifyTimerEnd(); return }
    // Un tic par seconde sur les trois dernieres. `tickedSecRef` evite de
    // sonner deux fois la meme seconde, l'intervalle tournant a 200 ms pour
    // que l'affichage ne saute pas une seconde entiere au reveil de l'ecran.
    if (rest.sec <= 3 && tickedSecRef.current !== rest.sec) { tickedSecRef.current = rest.sec; tick() }
    // Relu depuis l'echeance et non decremente : c'est ce qui fait survivre le
    // repos a la mise en veille de l'ecran.
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000))
      setRest(r => (r && r.sec !== left ? { ...r, sec: left } : r))
    }, 200)
    return () => clearInterval(t)
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
        const completedRounds = tourCourantCircuit(blocMovs, doneRef.current)
        const updatedDone = { ...doneRef.current, [wm.id]: next }
        setDone(() => updatedDone)
        const newRound = completedRounds + 1
        const roundDone = blocMovs.every(m => {
          const d = updatedDone[m.id] ?? 0
          return d >= newRound || d >= (m.sets ?? 3)
        })
        const allComplete = blocMovs.every(m => (updatedDone[m.id] ?? 0) >= (m.sets ?? 3))
        if (roundDone && !allComplete) startRest(wm.id, restDur)
        else setRest(null)
      } else {
        setDone(d => ({ ...d, [wm.id]: next }))
        if (next < target) startRest(wm.id, restDur)
        else setRest(null)
      }
      return
    }
    // Tic sec sur les trois dernieres secondes, comme pour le repos : on doit
    // savoir que l'effort se termine sans quitter la barre des yeux.
    if (exerciseTimer.sec <= 3 && tickedSecRef.current !== exerciseTimer.sec) { tickedSecRef.current = exerciseTimer.sec; tick() }
    // Echeance en horloge reelle (meme motif que le repos) : un chrono qui gele
    // pendant un verrouillage d'ecran sonne la fin bien apres l'effort.
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((exerciseTimer.endsAt - Date.now()) / 1000))
      setExerciseTimer(e => (e && e.sec !== left ? { ...e, sec: left } : e))
    }, 200)
    return () => clearInterval(t)
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
  // Mouvement deduit : la premiere serie non faite, en respectant les rounds de
  // circuit. C'est la regle par defaut, pas la seule.
  const derivedWm = (() => {
    if (!workout) return null
    for (const block of displayBlocks) {
      const movs = block ? workout.movements.filter(wm => wm.blockId === block.id) : (hasBlocks ? orphanMovements : workout.movements)
      const incomplete = movs.filter(m => (done[m.id] ?? 0) < (m.sets ?? 3))
      if (incomplete.length === 0) continue
      if (block && supersetBlocs.has(block.id)) {
        const completedRounds = tourCourantCircuit(movs, done)
        return incomplete.find(m => (done[m.id] ?? 0) === completedRounds) ?? incomplete[0]
      }
      return incomplete[0]
    }
    return null
  })()
  // Un curseur pose a la main l'emporte sur la deduction : c'est la seule facon
  // d'exprimer « saute ce mouvement » sans le declarer fait.
  const cursorWm = cursorWmId ? (workout?.movements.find(m => m.id === cursorWmId) ?? null) : null
  const currentWm = cursorWm ?? derivedWm
  const rawEmbed = currentWm?.movement.videoUrl ? getEmbedInfo(currentWm.movement.videoUrl) : null
  // Instagram ne supporte pas l'autoplay en iframe — pas de panneau vidéo dans ce cas
  const currentEmbed = rawEmbed && rawEmbed.type !== 'instagram' ? rawEmbed : null

  // Ordre de la seance a plat : blocs dans l'ordre, puis les orphelins. C'est
  // exactement l'ordre du rail, donc celui que l'utilisateur voit — et donc
  // celui dans lequel « Precedent » et « Suivant » doivent se deplacer.
  const flatMovs: WM[] = workout
    ? displayBlocks.flatMap(b => (b ? workout.movements.filter(wm => wm.blockId === b.id) : (hasBlocks ? orphanMovements : workout.movements)))
    : []

  const handleSet = (wm: WM) => {
    ensureAudio()
    if (wm.duration != null) {
      if (!started) setStarted(true)
      const target = wm.sets ?? 3
      const current = done[wm.id] ?? 0
      if (current >= target) return
      startWithSetup(wm.id, wm.duration)
      return
    }
    if (!started) setStarted(true)
    const target = wm.sets ?? 3
    const current = done[wm.id] ?? 0
    if (current >= target) return
    const restDur = (wm.rest && wm.rest >= 10) ? wm.rest : defaultRest

    if (wm.blockId && supersetBlocs.has(wm.blockId)) {
      const blocMovs = workout!.movements.filter(m => m.blockId === wm.blockId)
      const completedRounds = tourCourantCircuit(blocMovs, done)
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
      if (roundDone && !allComplete) startRest(wm.id, restDur)
      else setRest(null)
    } else {
      const next = current + 1
      setDone(d => ({ ...d, [wm.id]: next }))
      // Repos frais si séries restantes, sinon coupé (mouvement terminé)
      if (next < target) startRest(wm.id, restDur)
      else setRest(null)
    }
  }

  const handleUndo = (wm: WM) => {
    const current = done[wm.id] ?? 0
    if (current <= 0) return
    setDone(d => ({ ...d, [wm.id]: current - 1 }))
    setRest(null)
  }

  // ── Deplacement du curseur ─────────────────────────────────────────────
  // « Suivant » saute ce qui est en cours : repos, mise en place, effort, puis
  // le mouvement. Un seul bouton pour quatre refus, parce qu'en salle on ne
  // cherche pas lequel des quatre on veut annuler — on veut avancer.
  const goNext = () => {
    ensureAudio()
    if (setup) { setSetup(null); return }
    if (exerciseTimer) { setExerciseTimer(e => (e ? { ...e, sec: 0, endsAt: Date.now() } : null)); return }
    if (rest) { setRest(null); return }
    const i = flatMovs.findIndex(m => m.id === currentWm?.id)
    const next = i >= 0 ? flatMovs[i + 1] : flatMovs[0]
    // Au bas du rail il n'y a pas de suivant. Ne rien faire y transformait un
    // etat dont on pouvait sortir en etat fige : le seul recours contre un
    // bouton muet etait lui-meme muet. On rend la main a la deduction.
    setCursorWmId(next ? next.id : null)
  }

  // « Precedent » recule sans confirmation et remet a zero le mouvement quitte :
  // revenir en arriere pour refaire est le seul motif de reculer, et laisser ses
  // series cochees obligerait a decocher n fois avant de pouvoir reprendre.
  const goPrev = () => {
    ensureAudio()
    setSetup(null); setExerciseTimer(null); setRest(null)
    const i = flatMovs.findIndex(m => m.id === currentWm?.id)
    const prev = i > 0 ? flatMovs[i - 1] : null
    if (!prev) return
    if (currentWm) setDone(d => ({ ...d, [currentWm.id]: 0 }))
    setCursorWmId(prev.id)
  }

  // En circuit, la charge est posee a la preparation et ne se retape pas entre
  // deux stations : on la reporte sur le tour suivant au moment de valider.
  // L'ecran de fin de circuit sert a corriger — on ajoute un disque au deuxieme
  // tour et le circuit n'a aucun moment pour l'entendre.
  const validate = (wm: WM) => {
    const inCircuit = !!(wm.blockId && supersetBlocs.has(wm.blockId))
    const i = done[wm.id] ?? 0
    if (inCircuit && i > 0 && !perfLog[wm.id]?.[i]?.weight) copyPrevSet(wm.id, i)
    handleSet(wm)
  }

  // Le curseur se relache des que le mouvement qu'il designe est termine, sinon
  // « Valider la serie » resterait pose sur un mouvement complet.
  //
  // ET des que la porte d'ordre du circuit le refuserait. C'est le SECOND
  // declencheur de l'impasse, et il ne doit rien a l'inegalite des series : il
  // suffit que le curseur soit pose a la main sur une station en avance sur le
  // tour, ce que font « Suivant » (dont c'est le role), « Precedent » et le
  // rail. handleSet refusait alors en silence, le gros bouton ne faisait plus
  // rien et « Terminer la seance » n'arrivait jamais — dans un circuit a series
  // HOMOGENES, c'est-a-dire le cas ordinaire. Quatre appuis suffisaient.
  useEffect(() => {
    if (!cursorWmId || !workout) return
    const wm = workout.movements.find(m => m.id === cursorWmId)
    if (!wm) { setCursorWmId(null); return }
    const fait = done[wm.id] ?? 0
    if (fait >= (wm.sets ?? 3)) { setCursorWmId(null); return }
    if (wm.blockId && supersetBlocs.has(wm.blockId)) {
      const blocMovs = workout.movements.filter(m => m.blockId === wm.blockId)
      // Une station au tour courant reste parfaitement selectionnable : seule
      // celle que la porte refuserait est rendue a la deduction. Le saut
      // volontaire n'est donc pas perdu.
      if (fait > tourCourantCircuit(blocMovs, done)) setCursorWmId(null)
    }
  }, [cursorWmId, done, workout, supersetBlocs])

  // Fin de circuit : on le detecte en QUITTANT le bloc, pas en y etant — une
  // fois le circuit complet, la deduction a deja porte le curseur ailleurs.
  const lastCircuitRef = useRef<string | null>(null)
  useEffect(() => {
    if (!workout) return
    const b = currentWm?.blockId ?? null
    const prev = lastCircuitRef.current
    if (prev && prev !== b) {
      const movs = workout.movements.filter(m => m.blockId === prev)
      lastCircuitRef.current = null
      if (movs.length > 0 && movs.every(m => (done[m.id] ?? 0) >= (m.sets ?? 3))) setCircuitReview(prev)
    }
    if (b && supersetBlocs.has(b)) lastCircuitRef.current = b
  }, [currentWm?.blockId, done, supersetBlocs, workout])

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

  // ── Derivations des trois zones ──────────────────────────────────────────
  // Calculees avant le rendu : la zone D ne doit jamais changer de composition,
  // donc chacun de ses trois controles doit pouvoir se decider d'un coup d'oeil
  // sur ces valeurs plutot qu'au fil d'une imbrication de conditions JSX.
  const curTarget = currentWm ? (currentWm.sets ?? 3) : 0
  const curDone = currentWm ? (done[currentWm.id] ?? 0) : 0
  const curIndex = currentWm ? flatMovs.findIndex(m => m.id === currentWm.id) : -1
  const curBlock = currentWm?.blockId ? (workout.blocks.find(b => b.id === currentWm.blockId) ?? null) : null
  const curBlockLabel = curBlock
    ? `Bloc ${workout.blocks.indexOf(curBlock) + 1}${curBlock.bioType ? ` · ${curBlock.bioType}` : ''}`
    // « Hors bloc » n’a de sens que si d’AUTRES mouvements, eux, sont ranges
    // dans un bloc. Quand aucun ne l’est — c’est le cas de toutes les seances
    // de la base — le libelle serait affiche sur les 27 mouvements et ne
    // dirait rien : on montre alors le nom de la seance.
    : (hasBlocks && workout.movements.some(m => m.blockId)) ? 'Hors bloc' : workout.name
  const nextWm = curIndex >= 0 ? (flatMovs[curIndex + 1] ?? null) : null
  const isTimed = currentWm?.duration != null
  const isCircuit = !!(curBlock && supersetBlocs.has(curBlock.id))
  const circuitMovs = curBlock ? workout.movements.filter(m => m.blockId === curBlock.id) : []
  // Ecran de preparation : tant qu'aucune station n'a ete validee et que
  // l'utilisateur n'a pas dit « c'est bon ». Pure derivation, pas un etat —
  // un etat se desynchronise du `done` qu'il est justement cense observer.
  const showPrep = isCircuit && !circuitPrepDone.has(curBlock!.id) && circuitMovs.every(m => (done[m.id] ?? 0) === 0)
  const reviewMovs = circuitReview ? workout.movements.filter(m => m.blockId === circuitReview) : []

  // La vignette commande la bande video. Un mouvement sur cinq du referentiel
  // pointe vers Instagram ou TikTok, qui n'exposent aucune vignette : un cadre
  // 16/9 noir y tenait la place d'une demonstration qui n'arrivait jamais.
  const curThumb = youtubeThumbnail(currentWm?.movement.videoUrl)
  const canEmbed = !!curThumb || rawEmbed?.type === 'video'
  const curSource = rawEmbed ? (SOURCE_LABELS[rawEmbed.type] ?? 'vidéo') : null

  // Libelle et geste du bouton principal. Un seul endroit les decide, sinon la
  // zone D finit par porter deux boutons differents selon l'etat — exactement
  // ce que « ne change JAMAIS de composition » interdit.
  const main: { label: string; sub: string | null; fill: number; onPress: () => void; tone: 'accent' | 'green' } =
    allDone && !rest && !setup && !exerciseTimer
      ? { label: 'Terminer la séance', sub: null, fill: 0, onPress: () => setShowFinish(true), tone: 'green' }
      : setup
        ? { label: 'Valider maintenant', sub: 'Mise en place', fill: setup.sec / Math.max(setup.total, 1), onPress: () => { setSetup(null); if (currentWm?.duration != null) startExercise(currentWm.id, currentWm.duration) }, tone: 'accent' }
        : exerciseTimer
          ? { label: 'Valider maintenant', sub: `${exerciseTimer.sec} s`, fill: exerciseTimer.sec / Math.max(exerciseTimer.total, 1), onPress: () => setExerciseTimer(e => (e ? { ...e, sec: 0, endsAt: Date.now() } : null)), tone: 'accent' }
          : rest
            ? { label: `Reprendre · ${rest.sec} s`, sub: null, fill: rest.sec / Math.max(rest.total, 1), onPress: () => { ensureAudio(); setRest(null) }, tone: 'accent' }
            : showPrep
              ? { label: 'Commencer le circuit', sub: null, fill: 0, onPress: () => { ensureAudio(); if (!started) setStarted(true); setCircuitPrepDone(prev => new Set([...prev, curBlock!.id])) }, tone: 'accent' }
              : circuitReview
                ? { label: 'Circuit terminé', sub: null, fill: 0, onPress: () => setCircuitReview(null), tone: 'green' }
                : currentWm && isTimed
                  ? { label: `Démarrer · ${currentWm.duration} s`, sub: null, fill: 0, onPress: () => validate(currentWm), tone: 'accent' }
                  : currentWm
                    ? { label: `Valider la série ${Math.min(curDone + 1, curTarget)} / ${curTarget}`, sub: null, fill: 0, onPress: () => validate(currentWm), tone: 'accent' }
                    : { label: 'Terminer la séance', sub: null, fill: 0, onPress: () => setShowFinish(true), tone: 'green' }

  // Ligne d'information de la zone D : une seule ligne, toujours presente, pour
  // que la hauteur de la zone ne bouge pas d'un etat a l'autre.
  const infoLine = rest
    // On nomme la station sur laquelle l'ecran REPRENDRA, pas celle qu'on vient
    // de quitter. Hors circuit les deux coincident — on enchaine les series du
    // meme mouvement. En circuit non : le repos part justement quand le tour est
    // boucle, donc apres la DERNIERE station, et l'ecran repart sur la PREMIERE.
    // La ligne annoncait l'exercice qu'on venait de finir.
    ? `Repos · puis ${currentWm?.movement.name ?? '—'}`
    : setup
      ? 'Mise en place · tiens la position'
      : nextWm
        ? `À suivre · ${nextWm.movement.name}`
        : 'Dernier mouvement de la séance'

  // Sortie en annulant : la confirmation enumere ce qui disparait. « Tu vas
  // perdre ta progression » ne dit pas combien, et personne n'annule une
  // seance sans savoir ce qu'il y laisse.
  const quitWithoutSaving = async () => {
    const ok = await confirm(
      `${doneSets} série${doneSets > 1 ? 's' : ''} cochée${doneSets > 1 ? 's' : ''}, ${fmt(elapsed)} de chronomètre et les charges saisies seront effacées. Rien ne sera enregistré.`,
      { title: 'Abandonner la séance ?', danger: true, confirmLabel: 'Abandonner', cancelLabel: 'Continuer' },
    )
    if (!ok) return
    try { localStorage.removeItem(storageKey) } catch {}
    router.push(`/workouts/${id}`)
  }

  // Style commun des deux controles lateraux. 56 px de large, verbe ecrit sous
  // le signe, presents dans TOUS les etats : un bouton qui disparait pendant le
  // repos est un bouton qu'on cherche au moment ou l'on en a le plus besoin.
  const sideBtn: React.CSSProperties = {
    width: 56, minHeight: 56, flexShrink: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 1,
    borderRadius: 'var(--r-sm)', background: 'var(--bg-card)',
    border: '1px solid var(--border-plus)', color: 'var(--text-muted)',
    fontSize: 'var(--fs-micro)', fontWeight: 700, cursor: 'pointer', padding: 0,
  }
  const fieldStyle: React.CSSProperties = {
    textAlign: 'center', borderRadius: 'var(--r-sm)', padding: '11px 6px', minHeight: 44,
    fontSize: 'var(--fs-body)', fontWeight: 700, outline: 'none',
    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-plus)',
    color: 'var(--text-primary)',
  }

  return (
    // Coque : la page ne defile pas. Deux zones fixes encadrent la seule qui
    // defile, pour que « Valider la serie » soit toujours au meme endroit sous
    // le pouce — le chercher au scroll etait le geste le plus couteux de l'ecran.
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ══ ZONE A — REPERAGE ═══════════════════════════════════════════════ */}
      <div style={{ flexShrink: 0, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-cartouche)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: '6px var(--sp-3)' }}>
          {/* Deux sorties, deux formes. Un libelle ecrit pour celle qui
              enregistre, une croix pour celle qui annule : deux chevrons
              jumeaux auraient fait jouer la seance a la roulette. */}
          <button onClick={() => setShowFinish(true)}
            style={{ minHeight: 44, padding: '0 var(--sp-3)', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--border-plus)', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Sortir
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {curBlockLabel}
            </div>
            <div className="tnum" style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              {curIndex >= 0
                ? `Mouvement ${curIndex + 1} / ${flatMovs.length} · série ${Math.min(curDone + 1, curTarget)} / ${curTarget}`
                : `${flatMovs.length} mouvement${flatMovs.length > 1 ? 's' : ''} · terminé`}
            </div>
          </div>
          {/* Or : la progression et la marque. Jamais un bouton d'action — le
              cadran ouvre les reglages, qui ne sont pas une action de seance. */}
          <button className="tnum display" onClick={() => setShowSettings(true)}
            aria-label="Chronomètre — ouvrir les réglages de séance"
            style={{
              fontSize: 'var(--fs-lg)', fontWeight: 700, flexShrink: 0, lineHeight: 1, cursor: 'pointer',
              minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 var(--sp-3)',
              borderRadius: 'var(--r-sm)', border: 'none',
              background: started ? 'linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 100%)' : 'var(--bg-card)',
              color: started ? 'var(--ink)' : 'var(--text-dim)',
              boxShadow: started ? 'var(--elev-gold)' : 'none',
            }}>
            {fmt(elapsed)}
          </button>
          <button onClick={quitWithoutSaving} aria-label="Abandonner la séance sans enregistrer"
            style={{ width: 44, minHeight: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* ── Le rail ──────────────────────────────────────────────────────
            Un cran par mouvement, groupes par bloc. Vert mousse = fait,
            terracotta epais = ici, neutre = a venir. Les crans sont sous
            44 px : c'est assume. Douze mouvements a 44 px ne tiennent pas
            sur 375 px, et le rail est un reperage d'abord, un raccourci
            ensuite — les trois controles de la zone D, eux, font 56 px. */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', padding: '0 var(--sp-3) 6px', overflowX: 'auto' }}>
          {displayBlocks.map((b, bi) => {
            const movs = b ? workout.movements.filter(wm => wm.blockId === b.id) : (hasBlocks ? orphanMovements : workout.movements)
            if (movs.length === 0) return null
            return (
              <div key={b?.id ?? 'solo'} style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {movs.map(wm => {
                  const d = done[wm.id] ?? 0
                  const t = wm.sets ?? 3
                  const isHere = currentWm?.id === wm.id
                  const isDone = d >= t
                  return (
                    <button key={wm.id} onClick={() => { ensureAudio(); setCursorWmId(wm.id) }}
                      aria-label={`${wm.movement.name} — ${d}/${t} séries`}
                      title={`${b ? `Bloc ${bi + 1} · ` : ''}${wm.movement.name}`}
                      style={{
                        height: 30, minWidth: isHere ? 26 : 16, padding: 0, cursor: 'pointer',
                        borderRadius: 'var(--r-xs)', border: 'none',
                        background: isDone ? 'var(--cypress-light)' : isHere ? 'var(--accent)' : 'rgba(240,235,225,0.12)',
                        boxShadow: isHere ? '0 0 0 1px var(--crimson-border)' : 'none',
                        transition: 'min-width 0.15s, background 0.2s',
                      }} />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ══ ZONE B — CONTENU (la seule qui defile) ═════════════════════════ */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--sp-4) var(--sp-4) var(--sp-6)' }}>

          {/* ── Fin de circuit : l'ecran calme ──────────────────────────────
              On ajoute un disque au deuxieme tour et le circuit n'a aucun
              moment pour l'entendre. La correction se fait ici, une fois. */}
          {circuitReview ? (
            <>
              <div className="display" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>Circuit terminé</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
                Corrige les charges si tu as changé quelque chose en cours de route.
              </div>
              {reviewMovs.map(wm => {
                const rounds = done[wm.id] ?? 0
                if (isBodyweight(wm.movement.equipment)) {
                  return (
                    <div key={wm.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ flex: 1, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>{wm.movement.name}</span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>poids du corps</span>
                    </div>
                  )
                }
                return (
                  <div key={wm.id} style={{ padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>{wm.movement.name}</div>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      {Array.from({ length: rounds }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                          <span className="tnum" style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-dim)', fontWeight: 800 }}>T{i + 1}</span>
                          <input type="text" inputMode="decimal"
                            aria-label={`Charge tour ${i + 1} — ${wm.movement.name}`}
                            placeholder="kg" value={perfLog[wm.id]?.[i]?.weight ?? ''}
                            onChange={e => setLog(wm.id, i, 'weight', e.target.value)}
                            style={{ ...fieldStyle, width: 70 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          ) : showPrep ? (
            /* ── Preparation du circuit ───────────────────────────────────
               Les charges se reglent AVANT le lancement : pendant le circuit
               on passe d'une station a l'autre sans une main libre pour taper. */
            <>
              <div className="display" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>{curBlockLabel}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
                {circuitMovs.length} stations · règle les charges maintenant, tu les auras en lecture seule pendant le circuit.
              </div>
              <button type="button"
                onClick={() => circuitMovs.forEach(wm => { const w = lastPerf[wm.movement.id]?.last?.weight; if (w != null) setLog(wm.id, 0, 'weight', String(w)) })}
                style={{ minHeight: 44, width: '100%', marginBottom: 'var(--sp-4)', borderRadius: 'var(--r-sm)', background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>
                Reprendre les charges de la dernière fois
              </button>
              {circuitMovs.map((wm, i) => {
                const bw = isBodyweight(wm.movement.equipment)
                const typed = perfLog[wm.id]?.[0]?.weight ?? ''
                return (
                  <div key={wm.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="tnum" style={{ width: 18, flexShrink: 0, fontSize: 'var(--fs-micro)', fontWeight: 800, color: 'var(--text-dim)' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wm.movement.name}</div>
                      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-dim)' }}>
                        {wm.duration != null ? `${wm.duration} s` : (wm.reps ?? `${wm.sets ?? 3} séries`)}
                        {bw ? ' · poids du corps' : ''}
                      </div>
                    </div>
                    {/* Le champ est OMIS pour « Poids corps » : 137 des 377
                        mouvements du referentiel le sont, et demander combien
                        pese une traction est une question sans reponse. Le
                        gilet leste reste a un appui. */}
                    {bw && !typed ? (
                      // L'espace est un marqueur « champ demande » : `num` le
                      // rejette comme une saisie vide, donc rien de faux ne
                      // part en base si l'utilisateur ne tape finalement rien,
                      // et vider le champ fait revenir le bouton.
                      <button type="button" onClick={() => setLog(wm.id, 0, 'weight', ' ')}
                        style={{ minHeight: 44, padding: '0 var(--sp-3)', flexShrink: 0, borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px dashed var(--border-plus)', color: 'var(--text-dim)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }}>
                        + charge
                      </button>
                    ) : (
                      <input type="text" inputMode="decimal" enterKeyHint="next"
                        aria-label={`Charge — ${wm.movement.name}`}
                        placeholder={lastPerf[wm.movement.id]?.last?.weight != null ? String(lastPerf[wm.movement.id]!.last!.weight) : 'kg'}
                        value={typed.trim()}
                        onChange={e => setLog(wm.id, 0, 'weight', e.target.value)}
                        style={{ ...fieldStyle, width: 74, flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}
            </>
          ) : currentWm ? (
            <>
              {/* Le nom en serif : c'est le titre de ce qu'on fait, pas une
                  etiquette d'interface. */}
              <div className="display" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                {currentWm.movement.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: BIO_TYPE_COLORS[currentWm.movement.bioType] || '#888', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  {currentWm.movement.bioType}
                  {' · '}
                  {currentWm.duration != null ? `${currentWm.duration} s` : (currentWm.reps ? currentWm.reps : `${curTarget} séries`)}
                  {currentWm.movement.equipment ? ` · ${currentWm.movement.equipment}` : ''}
                </span>
              </div>

              {/* ── Mise en place : gros chiffres ─────────────────────────
                  On a la tete sous la barre, pas sur l'ecran : le chiffre
                  doit se lire du coin de l'oeil, et le tic suffit au reste. */}
              {setup && setup.wmId === currentWm.id && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: 'var(--sp-5) 0' }}>
                  <ProgressRing progress={setup.sec / Math.max(setup.total, 1)} size={132} stroke={6} color="var(--crimson-bright)" track="rgba(240,235,225,0.12)">
                    <span className="tnum display" style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-primary)' }}>{setup.sec}</span>
                  </ProgressRing>
                </div>
              )}

              {/* ── La demonstration ─────────────────────────────────────
                  Une bande 16/9 SEULEMENT quand il y a de quoi la remplir.
                  Instagram et TikTok n'exposent aucune vignette : pour eux,
                  une ligne qui nomme la source, et pas un cadre noir. */}
              {canEmbed && currentEmbed ? (
                <div style={{ position: 'relative', aspectRatio: '16 / 9', width: '100%', marginTop: 'var(--sp-4)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#0e0d0a', border: '1px solid var(--border)' }}>
                  {currentEmbed.type === 'video' ? (
                    <video key={currentEmbed.url} src={currentEmbed.url} autoPlay muted loop playsInline controls
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : extractEmbedVideoId(currentEmbed.url) ? (
                    <YouTubeLoopEmbed videoId={extractEmbedVideoId(currentEmbed.url)!} />
                  ) : (
                    <iframe key={currentEmbed.url} src={currentEmbed.url} title={`Démonstration — ${currentWm.movement.name}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  )}
                </div>
              ) : currentWm.movement.videoUrl ? (
                <a href={currentWm.movement.videoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minHeight: 44, marginTop: 'var(--sp-3)', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Voir la démonstration{curSource ? ` sur ${curSource}` : ''}
                </a>
              ) : null}

              {/* ── Les lignes de serie ──────────────────────────────────── */}
              {(() => {
                const lp = lastPerf[currentWm.movement.id]
                const rows = perfLog[currentWm.id] ?? []
                const hasHint = !!(lp?.last && (lp.last.weight != null || lp.last.reps != null))
                // Series faites, plus la suivante : on remplit apres avoir
                // souleve, pas avant la seance.
                const visibleRows = Math.min(curTarget, curDone + 1)
                // Le record se juge sur la serie la plus lourde SAISIE : c'est
                // tres souvent la derniere qui le bat, pas la premiere.
                const topTyped = rows.reduce((max, r) => { const v = num(r?.weight); return v != null && v > max ? v : max }, 0)
                const isPR = lp?.bestWeight != null && topTyped > 0 && topTyped > lp.bestWeight
                const bw = isBodyweight(currentWm.movement.equipment)
                return (
                  <div style={{ marginTop: 'var(--sp-5)' }}>
                    {hasHint && (
                      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>
                        Dernière&nbsp;: {lp!.last!.weight != null ? `${lp!.last!.weight}kg` : ''}{lp!.last!.weight != null && lp!.last!.reps != null ? ' × ' : ''}{lp!.last!.reps != null ? lp!.last!.reps : ''}
                      </div>
                    )}
                    {Array.from({ length: Math.max(visibleRows, 0) }).map((_, i) => {
                      const row = rows[i]
                      const isPending = i >= curDone
                      const canCopy = i > 0 && num(rows[i - 1]?.weight) != null && !row?.weight
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: i === 0 ? 0 : 'var(--sp-2)' }}>
                          <span className="tnum" style={{ width: 20, flexShrink: 0, textAlign: 'center', fontSize: 'var(--fs-micro)', fontWeight: 800, color: isPending ? 'var(--text-dim)' : 'var(--green)' }}>{i + 1}</span>
                          {/* En circuit, la charge est en lecture seule : on
                              n'a pas les mains libres entre deux stations, et
                              l'ecran de fin de circuit sert a corriger. */}
                          {isCircuit ? (
                            <span className="tnum" style={{ ...fieldStyle, width: 74, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-muted)' }}>
                              {row?.weight?.trim() ? row.weight : (bw ? '—' : '·')}
                            </span>
                          ) : (
                            <input type="text" inputMode="decimal" enterKeyHint="next"
                              aria-label={`Charge série ${i + 1} — ${currentWm.movement.name}`}
                              placeholder={lp?.last?.weight != null ? String(lp.last.weight) : (bw ? '+ lest' : 'kg')}
                              value={row?.weight ?? ''}
                              onChange={e => setLog(currentWm.id, i, 'weight', e.target.value)}
                              style={{ ...fieldStyle, width: 74,
                                // L'or sur la seule serie qui bat le record, pas
                                // sur toutes : c'est un fait precis, pas un decor.
                                ...(isPR && num(row?.weight) != null && num(row?.weight) === topTyped
                                  ? { color: 'var(--gold)', borderColor: 'var(--gold-border)' }
                                  : null) }} />
                          )}
                          {currentWm.duration != null ? (
                            <span style={{ color: 'var(--text-dim)', fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap' }}>kg&nbsp;·&nbsp;{currentWm.duration}s</span>
                          ) : (
                            <>
                              <span style={{ color: 'var(--text-dim)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>kg&nbsp;×</span>
                              <input type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done"
                                aria-label={`Répétitions série ${i + 1} — ${currentWm.movement.name}`}
                                placeholder={lp?.last?.reps != null ? String(lp.last.reps) : 'reps'}
                                value={row?.reps ?? ''}
                                onChange={e => setLog(currentWm.id, i, 'reps', e.target.value)}
                                style={{ ...fieldStyle, width: 66 }} />
                            </>
                          )}
                          {canCopy && !isCircuit && (
                            <button type="button" onClick={() => copyPrevSet(currentWm.id, i)}
                              aria-label={`Reprendre la saisie de la série ${i}`}
                              style={{ marginLeft: 'auto', minWidth: 44, minHeight: 44, borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--border-plus)', color: 'var(--text-dim)', fontSize: 'var(--fs-body)', cursor: 'pointer' }}>
                              ↑
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {curDone > 0 && (
                      <button type="button" onClick={() => handleUndo(currentWm)}
                        style={{ minHeight: 44, marginTop: 'var(--sp-3)', padding: '0 var(--sp-3)', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }}>
                        ↩ Décocher la série {curDone}
                      </button>
                    )}
                  </div>
                )
              })()}

              {curBlock?.instructions && (
                <div style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{curBlock.instructions}</div>
              )}

              <a href={`/workouts/${id}`}
                style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 'var(--sp-5)', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-dim)', textDecoration: 'none' }}>
                Voir le plan complet de la séance →
              </a>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
              <div className="display" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--green)' }}>Toutes les séries sont faites</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>{doneSets} séries · {fmt(elapsed)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ZONE D — ACTION ════════════════════════════════════════════════
          Hauteur et composition fixes : une ligne d'information, puis trois
          controles. Le lateral qui s'eclipse pendant le repos est le bouton
          qu'on cherche au moment ou l'on en a le plus besoin. */}
      <div style={{ flexShrink: 0, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-cartouche)', padding: 'var(--sp-2) var(--sp-3) calc(var(--sp-3) + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-dim)', marginBottom: 'var(--sp-2)', paddingLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', height: 15, lineHeight: '15px' }}>
          {infoLine}
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--sp-2)' }}>
          <button onClick={goPrev} disabled={curIndex <= 0} style={{ ...sideBtn, opacity: curIndex <= 0 ? 0.35 : 1, cursor: curIndex <= 0 ? 'default' : 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Précédent</span>
          </button>
          {/* Remplissage degressif EN FOND : le temps restant se lit sans
              deplacer le regard du bouton sur lequel le pouce est deja pose. */}
          <button onClick={main.onPress}
            style={{
              flex: 1, minWidth: 0, minHeight: 56, borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              color: main.tone === 'green' ? 'var(--ink)' : 'var(--on-accent)',
              background: main.fill > 0
                ? `linear-gradient(90deg, var(--crimson) 0%, var(--crimson) ${main.fill * 100}%, var(--crimson-ghost) ${main.fill * 100}%, var(--crimson-ghost) 100%)`
                : main.tone === 'green' ? 'var(--green)' : 'var(--accent)',
              boxShadow: 'var(--elev-1)',
              transition: 'background 0.2s linear',
            }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 800, letterSpacing: '0.02em' }}>{main.label}</span>
            {main.sub && <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, opacity: 0.8 }}>{main.sub}</span>}
          </button>
          <button onClick={goNext} style={sideBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>Suivant</span>
          </button>
        </div>
      </div>

      {/* ── Reglages : repos par defaut, mise en place, circuits ───────────
          Tires de l'ecran principal : trois reglages consultes une fois par
          seance n'ont pas a occuper la place d'un controle utilise a chaque
          serie. On y arrive par le chronometre. */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} maxWidth={420}>
          <div style={{ padding: 'var(--sp-5)' }}>
            <div className="display" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 'var(--sp-4)' }}>Réglages de séance</div>

            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>Repos par défaut</div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
              {REST_OPTIONS.map(s => (
                <button key={s} onClick={() => setDefaultRest(s)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', border: `1px solid ${defaultRest === s ? 'var(--crimson)' : 'var(--border-plus)'}`, background: defaultRest === s ? 'var(--crimson-ghost)' : 'transparent', color: defaultRest === s ? 'var(--crimson-bright)' : 'var(--text-dim)' }}>
                  {s}s
                </button>
              ))}
            </div>

            <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>Mise en place</div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
              {SETUP_OPTIONS.map(s => (
                <button key={s} onClick={() => setSetupSeconds(s)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', border: `1px solid ${setupSeconds === s ? 'var(--crimson)' : 'var(--border-plus)'}`, background: setupSeconds === s ? 'var(--crimson-ghost)' : 'transparent', color: setupSeconds === s ? 'var(--crimson-bright)' : 'var(--text-dim)' }}>
                  {s === 0 ? 'aucune' : `${s}s`}
                </button>
              ))}
            </div>

            {workout.blocks.filter(b => workout.movements.filter(m => m.blockId === b.id).length > 1).length > 0 && (
              <>
                <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>Circuits</div>
                {workout.blocks.filter(b => workout.movements.filter(m => m.blockId === b.id).length > 1).map(b => (
                  <button key={b.id} onClick={() => toggleSuperset(b.id)}
                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 'var(--sp-2)', padding: '0 var(--sp-3)', borderRadius: 'var(--r-sm)', cursor: 'pointer', border: `1px solid ${supersetBlocs.has(b.id) ? 'var(--crimson)' : 'var(--border-plus)'}`, background: supersetBlocs.has(b.id) ? 'var(--crimson-ghost)' : 'transparent', color: supersetBlocs.has(b.id) ? 'var(--crimson-bright)' : 'var(--text-dim)', fontSize: 'var(--fs-body)', fontWeight: 700 }}>
                    <span>Bloc {workout.blocks.indexOf(b) + 1}{b.bioType ? ` · ${b.bioType}` : ''}</span>
                    <span>{supersetBlocs.has(b.id) ? 'en circuit' : 'une à une'}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Sortie en enregistrant ──────────────────────────────────────── */}
      {showFinish && (
        <Modal onClose={() => setShowFinish(false)} maxWidth={420}>
          <div style={{ padding: 'var(--sp-5)' }}>
            <div className="display" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>Enregistrer et sortir ?</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--sp-4)' }}>
              {doneSets} série{doneSets > 1 ? 's' : ''} sur {totalSets()} · {fmt(elapsed)}
              {allDone ? ' · séance complète.' : ` · ${pct}% de la séance.`}
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note optionnelle…"
              style={{ ...fieldStyle, width: '100%', textAlign: 'left', padding: '11px var(--sp-3)', marginBottom: 'var(--sp-4)' }} />
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button onClick={() => setShowFinish(false)}
                style={{ minHeight: 48, padding: '0 var(--sp-4)', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px solid var(--border-plus)', color: 'var(--text-muted)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleFinish} disabled={finishing}
                style={{ flex: 1, minHeight: 48, borderRadius: 'var(--r-sm)', background: 'var(--green)', border: 'none', color: 'var(--ink)', fontSize: 'var(--fs-body)', fontWeight: 800, cursor: finishing ? 'wait' : 'pointer' }}>
                {finishing ? '…' : 'Enregistrer la séance'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
