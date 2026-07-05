'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BIO_TYPE_COLORS } from '@/lib/types'
import { ProgressRing } from '@/components/ui'

interface Movement { id: string; name: string; bioType: string; videoUrl?: string | null }
interface WM { id: string; order: number; sets?: number | null; reps?: string | null; rest?: number | null; duration?: number | null; blockId?: string | null; movement: Movement }
interface Block { id: string; order: number; bioType?: string | null; instructions?: string | null }
interface Workout { id: string; name: string; duration?: number | null; movements: WM[]; blocks: Block[] }

const REST_OPTIONS = [30, 60, 90, 120]
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const ytId = (url: string) => {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function ActivePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [workout, setWorkout] = useState<Workout | null>(null)

  const [done, setDone] = useState<Record<string, number>>({})
  const [rest, setRest] = useState<{ sec: number; total: number; wmId: string } | null>(null)
  const [defaultRest, setDefaultRest] = useState(60)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [note, setNote] = useState('')
  const [showFinish, setShowFinish] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [supersetBlocs, setSupersetBlocs] = useState<Set<string>>(new Set())
  const [exerciseTimer, setExerciseTimer] = useState<{ wmId: string; sec: number; total: number } | null>(null)

  const toggleSuperset = (blockId: string) =>
    setSupersetBlocs(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId); else next.add(blockId)
      return next
    })

  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed
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

  // load workout + restore session in progress
  useEffect(() => {
    fetch(`/api/workouts/${id}`).then(r => r.json()).then(w => {
      setWorkout(w)

      // Reprise d'une séance interrompue (refresh, onglet fermé) — expire après 24h
      const savedRaw = localStorage.getItem(storageKey)
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw)
          if (saved.startedAt && Date.now() - saved.startedAt < 24 * 60 * 60 * 1000) {
            if (saved.done) setDone(saved.done)
            if (Array.isArray(saved.superset)) setSupersetBlocs(prev => new Set([...prev, ...saved.superset]))
            if (saved.note) setNote(saved.note)
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

  // persist session state so a refresh/tab close doesn't lose progress
  useEffect(() => {
    if (!started || !workout) return
    if (startedAtRef.current == null) startedAtRef.current = Date.now() - elapsedRef.current * 1000
    localStorage.setItem(storageKey, JSON.stringify({
      done,
      superset: [...supersetBlocs],
      note,
      startedAt: startedAtRef.current,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, supersetBlocs, note, started, workout])

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
        if (roundDone) {
          const allComplete = blocMovs.every(m => (updatedDone[m.id] ?? 0) >= (m.sets ?? 3))
          if (!allComplete) setRest({ sec: restDur, total: restDur, wmId: wm.id })
        }
      } else {
        setDone(d => ({ ...d, [wm.id]: next }))
        if (next < target) setRest({ sec: restDur, total: restDur, wmId: wm.id })
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

  // Current movement = next to do, superset-aware (picks active movement in current round)
  const currentWm = (() => {
    if (!workout) return null
    const blocks = hasBlocks ? workout.blocks : [null as null]
    for (const block of blocks) {
      const movs = block ? workout.movements.filter(wm => wm.blockId === block.id) : workout.movements
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
  const currentVid = currentWm?.movement.videoUrl ? ytId(currentWm.movement.videoUrl) : null

  // Reset video player when movement changes
  const prevWmIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevWmIdRef.current !== (currentWm?.id ?? null)) {
      prevWmIdRef.current = currentWm?.id ?? null
      setVideoPlaying(false)
    }
  }, [currentWm?.id])

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
      if (roundDone) {
        const allComplete = blocMovs.every(m => (updatedDone[m.id] ?? 0) >= (m.sets ?? 3))
        if (!allComplete) setRest({ sec: restDur, total: restDur, wmId: wm.id })
      }
    } else {
      const next = current + 1
      setDone(d => ({ ...d, [wm.id]: next }))
      if (next < target) setRest({ sec: restDur, total: restDur, wmId: wm.id })
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
    await fetch(`/api/workouts/${id}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || undefined }),
    }).catch(() => {})
    localStorage.removeItem(storageKey)
    router.push(`/workouts/${id}`)
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

      {/* ── Header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#12100C', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
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

      {/* ── Video panel (current movement) ── */}
      {currentVid && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 680, margin: '0 auto', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {/* movement name badge */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>
            {currentWm?.movement.name}
          </div>
          <div style={{ position: 'relative', width: '100%', paddingBottom: '42%', overflow: 'hidden' }}>
            {videoPlaying ? (
              <iframe
                src={`https://www.youtube.com/embed/${currentVid}?autoplay=1&rel=0&modestbranding=1`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button onClick={() => setVideoPlaying(true)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}>
                <img
                  src={`https://img.youtube.com/vi/${currentVid}/hqdefault.jpg`}
                  alt={currentWm?.movement.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.75)' }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(201,165,53,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Default rest selector ── */}
      <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Repos par défaut</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {REST_OPTIONS.map(s => (
            <button key={s} onClick={() => setDefaultRest(s)}
              style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${defaultRest === s ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`, background: defaultRest === s ? 'rgba(201,165,53,0.15)' : 'transparent', color: defaultRest === s ? 'var(--gold)' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}>
              {s}s
            </button>
          ))}
        </div>
      </div>

      {/* ── Movements ── */}
      <div style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
        {(hasBlocks ? workout.blocks : [null]).map((block, bi) => {
          const movs = hasBlocks ? workout.movements.filter(wm => wm.blockId === block!.id) : workout.movements
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
                    Bloc {bi + 1}{block?.bioType ? ` · ${block.bioType}` : ''}{block?.instructions ? ` · ${block.instructions}` : ''}
                    {isSuperset && !blocAllDone && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>· Round {completedRounds + 1}/{maxRounds}</span>}
                    {isSuperset && blocAllDone && <span style={{ color: 'var(--green)', marginLeft: 6 }}>· Terminé</span>}
                  </div>
                  {movs.length > 1 && block?.id && (
                    <button onClick={() => toggleSuperset(block.id)}
                      style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: `1px solid ${isSuperset ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`, background: isSuperset ? 'rgba(201,165,53,0.15)' : 'transparent', color: isSuperset ? 'var(--gold)' : 'rgba(255,255,255,0.3)', transition: 'all 0.15s', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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

                  // Trois registres : sombre = contexte · ivoire = maintenant · or = agir
                  const onIvory = (isCurrent || isActiveInRound) && !isComplete
                  const cardBg = isComplete ? 'var(--cypress-ghost)' : isDoneInRound ? 'rgba(58,94,72,0.15)' : onIvory ? 'var(--ivory-card)' : 'var(--bg-card)'
                  const cardBorder = isComplete ? 'rgba(127,184,148,0.30)' : isDoneInRound ? 'rgba(127,184,148,0.18)' : onIvory ? 'var(--gold)' : isResting ? 'var(--gold-border)' : 'var(--border)'
                  const nameColor = isComplete || isDoneInRound ? 'var(--green)' : onIvory ? 'var(--ink)' : 'var(--text-muted)'
                  const subColor = onIvory ? 'var(--ink-muted)' : 'rgba(255,255,255,0.45)'
                  const dimColor = onIvory ? 'var(--ink-dim)' : 'rgba(255,255,255,0.25)'
                  const timedColor = onIvory ? '#2F6FA7' : 'var(--blue)'

                  return (
                    <div key={wm.id} style={{
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      borderRadius: 'var(--r-md)', padding: '14px 16px',
                      boxShadow: onIvory ? 'var(--elev-2)' : 'none',
                      transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 15, fontWeight: onIvory ? 700 : 600, color: nameColor }}>
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
                              background: i < setsNow ? (isComplete ? 'var(--green)' : (wm.duration != null ? timedColor : 'var(--gold)')) : (onIvory ? 'rgba(14,12,8,0.06)' : 'rgba(255,255,255,0.07)'),
                              color: i < setsNow ? (isComplete ? '#0E0C08' : 'var(--ink)') : (onIvory ? 'var(--ink-dim)' : 'rgba(255,255,255,0.3)'),
                              border: `1px solid ${i < setsNow ? 'transparent' : (onIvory ? 'rgba(14,12,8,0.18)' : 'rgba(255,255,255,0.1)')}`,
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

                      {/* Exercise timer in-card (timed mode, currently running) */}
                      {wm.duration != null && exerciseTimer?.wmId === wm.id && (
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                          <ProgressRing progress={exerciseTimer.sec / exerciseTimer.total} size={96} stroke={5} color={timedColor} track={onIvory ? 'rgba(14,12,8,0.10)' : 'rgba(99,179,237,0.15)'}>
                            <span className="tnum display" style={{ fontSize: 27, fontWeight: 700, color: timedColor }}>{exerciseTimer.sec}</span>
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
                                flex: 1, padding: '13px', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: onIvory ? 800 : 700,
                                cursor: isComplete || exerciseTimer?.wmId === wm.id ? 'default' : 'pointer',
                                background: isComplete ? 'var(--cypress-ghost)' : exerciseTimer?.wmId === wm.id ? 'transparent' : onIvory ? timedColor : 'rgba(99,179,237,0.12)',
                                border: `1px solid ${isComplete ? 'rgba(127,184,148,0.25)' : onIvory ? 'transparent' : 'rgba(99,179,237,0.3)'}`,
                                color: isComplete ? 'var(--green)' : exerciseTimer?.wmId === wm.id ? timedColor : onIvory ? '#F1EAD8' : 'var(--blue)',
                                transition: 'all 0.15s',
                              }}>
                              {isComplete ? '✓ Terminé' : exerciseTimer?.wmId === wm.id ? '⏱ En cours…' : `▶ Démarrer · ${wm.duration}s`}
                            </button>
                            {exerciseTimer?.wmId === wm.id && (
                              <button onClick={() => setExerciseTimer(e => e ? { ...e, sec: 0 } : null)}
                                style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', fontSize: 12, cursor: 'pointer', background: 'transparent', border: `1px solid ${onIvory ? 'rgba(14,12,8,0.2)' : 'rgba(99,179,237,0.2)'}`, color: timedColor }}
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
                                fontWeight: onIvory ? 800 : 700,
                                letterSpacing: onIvory ? '0.03em' : 0,
                                textTransform: onIvory ? 'uppercase' : 'none',
                                // Or massif pour le mouvement actif : le geste principal de la séance
                                background: isComplete ? 'var(--cypress-ghost)' : onIvory ? 'linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 100%)' : 'rgba(201,165,53,0.10)',
                                border: `1px solid ${isComplete ? 'rgba(127,184,148,0.25)' : onIvory ? 'transparent' : 'rgba(201,165,53,0.3)'}`,
                                color: isComplete ? 'var(--green)' : onIvory ? '#0E0C08' : 'var(--gold)',
                                boxShadow: onIvory ? '0 2px 0 rgba(14,12,8,0.25)' : 'none',
                                transition: 'all 0.15s',
                              }}>
                              {isComplete ? '✓ Terminé' : `Série ${setsNow + 1} / ${target}`}
                            </button>
                            {setsNow > 0 && !isComplete && (
                              <button onClick={() => handleUndo(wm)}
                                style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', fontSize: 12, cursor: 'pointer', background: 'transparent', border: `1px solid ${onIvory ? 'rgba(14,12,8,0.2)' : 'rgba(255,255,255,0.1)'}`, color: onIvory ? 'var(--ink-muted)' : 'rgba(255,255,255,0.35)' }}>
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

      {/* ── Rest timer overlay — panneau ivoire, le « maintenant » ── */}
      {rest && (
        <div className="modal-in panel-ivory" style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 20, borderRadius: 'var(--r-lg)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 20, minWidth: 280 }}>
          <ProgressRing progress={rest.sec / rest.total} size={60} stroke={4} color="var(--gold-dim)" track="rgba(14,12,8,0.10)">
            <span className="tnum display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{rest.sec}</span>
          </ProgressRing>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Repos</div>
            <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
              {workout.movements.find(wm => wm.id === rest.wmId)?.movement.name}
            </div>
          </div>
          <button onClick={() => setRest(null)}
            style={{ padding: '8px 15px', borderRadius: 'var(--r-sm)', background: 'linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 100%)', border: 'none', color: '#0E0C08', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 0 rgba(14,12,8,0.25)' }}>
            Passer
          </button>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#12100C', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
        {showFinish ? (
          <>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note optionnelle…"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }} />
            <button onClick={handleFinish} disabled={finishing}
              style={{ padding: '10px 20px', borderRadius: 9, background: 'var(--green)', border: 'none', color: '#000', fontSize: 13, fontWeight: 800, cursor: finishing ? 'wait' : 'pointer', flexShrink: 0 }}>
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
            <button onClick={() => setShowFinish(true)}
              style={{
                padding: '11px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
                background: allDone ? 'var(--green)' : 'rgba(201,165,53,0.15)',
                border: `1px solid ${allDone ? 'transparent' : 'rgba(201,165,53,0.3)'}`,
                color: allDone ? '#000' : 'var(--gold)',
                boxShadow: allDone ? '0 0 20px rgba(34,197,94,0.4)' : 'none',
                transition: 'all 0.3s',
              }}>
              {allDone ? '🏁 Terminer la séance' : 'Terminer'}
            </button>
          </>
        )}
      </div>

    </div>
  )
}
