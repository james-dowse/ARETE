'use client'
import AppShell from '@/components/AppShell'
import { BIO_TYPES, COMPLEXITIES, EQUIPMENT_TYPES, EQUIPMENT_ICONS, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, type GeneratedMovement } from '@/lib/types'
import RichEditor from '@/components/RichEditor'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Zap, Save, RefreshCw, Clock, Minus, ChevronDown, ChevronUp, Dices, Search } from 'lucide-react'
import MovementModal from '@/components/MovementModal'
import LibraryPicker, { type PickableMovement } from '@/components/LibraryPicker'

interface Block {
  id: string
  bioTypes: string[]
  complexities: string[]
  equipments: string[]
  count: number
  order: number
  instructions: string
  sets: number
  reps: string
  rest: number
}
interface MovementParams { sets: number; reps: string; rest: number }

function uid() { return Math.random().toString(36).slice(2) }

const DEFAULT_SETS = 2
const DEFAULT_REPS = '10'
const DEFAULT_REST = 1

export default function GeneratorPage() {
  const router = useRouter()
  const [blocks, setBlocks] = useState<Block[]>([
    { id: uid(), bioTypes: [], complexities: [], equipments: [], count: 3, order: 0, instructions: '', sets: DEFAULT_SETS, reps: DEFAULT_REPS, rest: DEFAULT_REST },
  ])
  const [duration, setDuration] = useState('')
  const [workoutName, setWorkoutName] = useState('')

  // Generated movements + per-movement sets/reps
  const [generated, setGenerated] = useState<GeneratedMovement[] | null>(null)
  const [params, setParams] = useState<MovementParams[]>([])

  // Global inter-block rest (seconds between blocks, shared across all blocks)
  const [globalBlockRest, setGlobalBlockRest] = useState(2) // minutes de repos entre blocs

  const [workoutDescription, setWorkoutDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; blocks: Block[] }[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [claimingTemplates, setClaimingTemplates] = useState(false)
  const [videoOnly, setVideoOnly] = useState(false)

  // Track which block cards are collapsed
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({})
  // Section-level collapse
  const [collapsedRandom, setCollapsedRandom] = useState(false)
  const [collapsedStructure, setCollapsedStructure] = useState(false)
  // Result panel: collapse per result block
  const [collapsedResultBlocks, setCollapsedResultBlocks] = useState<Record<string, boolean>>({})

  // Random workout
  const [randomDifficulty, setRandomDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  // Movement detail modal
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)

  // Result panel blocks — snapshot from left panel on generate, then independent
  const [resultBlocks, setResultBlocks] = useState<Block[]>([])
  // Per-gap rests: blockRests[i] = rest (min) between resultBlock[i] and resultBlock[i+1]
  const [blockRests, setBlockRests] = useState<number[]>([])

  // Library substitution
  const [substitutingIndex, setSubstitutingIndex] = useState<number | null>(null)
  // Library picker for adding a movement to a result block
  const [addingToBlockIndex, setAddingToBlockIndex] = useState<number | null>(null)
  // Random reroll per movement
  const [rerollingIndex, setRerollingIndex] = useState<number | null>(null)
  // Adding a random movement to a result block
  const [addingRandomToBlock, setAddingRandomToBlock] = useState<number | null>(null)

  const removeGeneratedMovement = (i: number) => {
    setGenerated(prev => prev!.filter((_, idx) => idx !== i))
    setParams(prev => prev.filter((_, idx) => idx !== i))
  }

  const removeGeneratedBlock = (bi: number) => {
    if (!generated) return
    const keepIndices = generated.map((m, idx) => ({ m, idx })).filter(({ m }) => m.blockIndex !== bi).map(({ idx }) => idx)
    // Keep movements from other blocks, renumber blockIndex for blocks above bi
    setGenerated(
      generated
        .filter(m => m.blockIndex !== bi)
        .map(m => m.blockIndex > bi ? { ...m, blockIndex: m.blockIndex - 1 } : m)
    )
    setParams(prev => keepIndices.map(i => prev[i]))
    setResultBlocks(prev => prev.filter((_, i) => i !== bi).map((b, i) => ({ ...b, order: i })))
    // Remove the gap after bi (or the last gap if bi is the last block)
    setBlockRests(prev => prev.filter((_, i) => i !== (bi < prev.length ? bi : prev.length - 1)))
  }

  const handleReroll = async (i: number, blockIdx: number) => {
    if (!generated) return
    setRerollingIndex(i)
    try {
      const block = resultBlocks[blockIdx]
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [{
            bioTypes: block.bioTypes,
            complexities: block.complexities,
            equipments: block.equipments,
            count: 1,
            exclude: [generated[i].id],
          }],
          videoOnly,
        }),
      })
      const data = await res.json()
      const newMov = data.movements?.[0]
      if (newMov) {
        setGenerated(prev => prev!.map((gm, idx) =>
          idx === i ? { ...newMov, blockIndex: gm.blockIndex } : gm
        ))
      }
    } finally {
      setRerollingIndex(null)
    }
  }

  const handleLibraryPick = (m: PickableMovement) => {
    if (substitutingIndex !== null) {
      setGenerated(prev => prev!.map((gm, i) =>
        i === substitutingIndex
          ? { id: m.id, name: m.name, bioType: m.bioType, complexity: m.complexity, videoUrl: m.videoUrl ?? null, blockIndex: gm.blockIndex }
          : gm
      ))
      setSubstitutingIndex(null)
    } else if (addingToBlockIndex !== null) {
      const bi = addingToBlockIndex
      const rb = resultBlocks[bi]
      setGenerated(prev => [...(prev ?? []), { id: m.id, name: m.name, bioType: m.bioType, complexity: m.complexity, videoUrl: m.videoUrl ?? null, blockIndex: bi }])
      setParams(prev => [...prev, { sets: rb?.sets ?? DEFAULT_SETS, reps: rb?.reps ?? DEFAULT_REPS, rest: rb?.rest ?? DEFAULT_REST }])
      setAddingToBlockIndex(null)
    }
  }

  const addRandomToResultBlock = async (bi: number) => {
    const rb = resultBlocks[bi]
    setAddingRandomToBlock(bi)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [{ bioTypes: rb.bioTypes, complexities: rb.complexities, equipments: rb.equipments, count: 1 }],
          videoOnly,
        }),
      })
      const data = await res.json()
      const newMov = data.movements?.[0]
      if (newMov) {
        setGenerated(prev => [...(prev ?? []), { ...newMov, blockIndex: bi }])
        setParams(prev => [...prev, { sets: rb?.sets ?? DEFAULT_SETS, reps: rb?.reps ?? DEFAULT_REPS, rest: rb?.rest ?? DEFAULT_REST }])
      }
    } finally {
      setAddingRandomToBlock(null)
    }
  }

  const addResultBlock = () => {
    setResultBlocks(prev => [...prev, {
      id: uid(), bioTypes: [], complexities: [], equipments: [],
      count: 0, order: prev.length, instructions: '',
      sets: DEFAULT_SETS, reps: DEFAULT_REPS, rest: DEFAULT_REST,
    }])
    setBlockRests(prev => [...prev, globalBlockRest])
  }

  const addBlock = () => setBlocks(prev => [...prev, { id: uid(), bioTypes: [], complexities: [], equipments: [], count: 3, order: prev.length, instructions: '', sets: DEFAULT_SETS, reps: DEFAULT_REPS, rest: DEFAULT_REST }])
  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id))
  const updateBlock = (id: string, field: keyof Block, value: string | number | null) =>
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  const toggleBlockArr = (id: string, field: 'bioTypes' | 'complexities' | 'equipments', value: string) =>
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = b[field]
      return { ...b, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    }))
  const toggleCollapse = (id: string) =>
    setCollapsedBlocks(prev => ({ ...prev, [id]: !prev[id] }))

  const setParam = (idx: number, field: keyof MovementParams, value: string | number) =>
    setParams(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))

  const generate = async () => {
    setLoading(true)
    setSavedId(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: blocks.map(b => ({ bioTypes: b.bioTypes, complexities: b.complexities, equipments: b.equipments, count: b.count })), videoOnly }),
      })
      const data = await res.json()
      setResultBlocks([...blocks])
      setBlockRests(Array(Math.max(0, blocks.length - 1)).fill(globalBlockRest))
      setGenerated(data.movements)
      setParams(data.movements.map((m: { blockIndex: number }) => {
        const b = blocks[m.blockIndex]
        return { sets: b?.sets ?? DEFAULT_SETS, reps: b?.reps ?? DEFAULT_REPS, rest: b?.rest ?? DEFAULT_REST }
      }))
      if (!workoutName) {
        const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
        setWorkoutName(`Workout ${date}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const saveWorkout = async () => {
    if (!generated || !workoutName.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workoutName,
          duration: duration ? Number(duration) : null,
          description: workoutDescription || null,
          blockRest: globalBlockRest,
          movements: generated.map((m, i) => ({
            movementId: m.id,
            order: i,
            sets: params[i]?.sets ?? DEFAULT_SETS,
            reps: params[i]?.reps ?? DEFAULT_REPS,
            rest: params[i]?.rest ?? DEFAULT_REST,
            blockIndex: m.blockIndex,
          })),
          blocks: resultBlocks.map((b, i) => ({
            order: i,
            bioType: b.bioTypes[0] ?? null,
            instructions: b.instructions || null,
            restAfter: blockRests[i] ?? null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data?.error ?? `Erreur ${res.status}`)
        return
      }
      setSavedId(data.id)
      if (!data.userId) {
        setSaveError('⚠ Workout sauvegardé mais non lié à ton compte — tu n\'es pas connecté. Il n\'apparaîtra pas dans "Mes workouts".')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const launchNow = async () => {
    if (!generated) return
    setLaunching(true)
    try {
      const tempName = `Séance éclair · ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tempName,
          duration: duration ? Number(duration) : null,
          description: null,
          blockRest: globalBlockRest,
          movements: generated.map((m, i) => ({
            movementId: m.id,
            order: i,
            sets: params[i]?.sets ?? DEFAULT_SETS,
            reps: params[i]?.reps ?? DEFAULT_REPS,
            rest: params[i]?.rest ?? DEFAULT_REST,
            blockIndex: m.blockIndex,
          })),
          blocks: resultBlocks.map((b, i) => ({
            order: i,
            bioType: b.bioTypes[0] ?? null,
            instructions: b.instructions || null,
            restAfter: blockRests[i] ?? null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      router.push(`/workouts/${data.id}/active`)
    } catch {
      setLaunching(false)
      setShowLaunchConfirm(false)
    }
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, blocks }),
      })
      setShowSaveTemplate(false)
      setTemplateName('')
    } finally {
      setSavingTemplate(false)
    }
  }

  const loadTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data.map((t: { id: string; name: string; blocks: { bioType: string | null; complexity: string | null; count: number; order: number }[] }) => ({
        ...t,
        blocks: t.blocks.map((b: { bioType: string | null; complexity: string | null; count: number; order: number }) => ({ ...b, id: uid(), instructions: '', sets: DEFAULT_SETS, reps: DEFAULT_REPS, rest: DEFAULT_REST })),
      })))
      setShowTemplates(true)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const applyTemplate = (tpl: { blocks: Block[] }) => {
    setBlocks(tpl.blocks.map((b, i) => ({ ...b, id: uid(), order: i })))
    setShowTemplates(false)
    setGenerated(null)
  }

  const claimTemplates = async () => {
    setClaimingTemplates(true)
    try {
      const res = await fetch('/api/templates/claim', { method: 'POST' })
      const { claimed } = await res.json()
      if (claimed > 0) await loadTemplates()
      else setShowTemplates(false)
    } finally {
      setClaimingTemplates(false)
    }
  }

  const totalMovements = blocks.reduce((s, b) => s + b.count, 0)

  // Group generated movements by blockIndex — uses resultBlocks (independent of left panel after generate)
  const generatedByBlock: GeneratedMovement[][] = generated
    ? resultBlocks.map((_, bi) => (generated || []).filter(m => m.blockIndex === bi))
    : []

  // ── Duration estimates ──
  const fmtMin = (min: number) => {
    const r = Math.round(min)
    if (r < 60) return `~${r}min`
    const h = Math.floor(r / 60); const m = r % 60
    return m > 0 ? `~${h}h${m}min` : `~${h}h`
  }
  const minPerMov = (sets: number, rest: number) => sets * (1 + rest)
  const blockEstMin = (count: number, sets: number, rest: number) => count * minPerMov(sets, rest)
  const interBlockRest = (nbBlocks: number) => Math.max(0, nbBlocks - 1) * globalBlockRest
  // When generated: sum actual per-gap rests (only between non-empty adjacent blocks)
  const totalInterBlockRestGenerated = blockRests.reduce((s, r, i) => {
    const hasLeft = generatedByBlock[i]?.length > 0
    const hasRight = generatedByBlock[i + 1]?.length > 0
    return s + (hasLeft && hasRight ? r : 0)
  }, 0)
  const totalEstMin = generated
    ? generated.reduce((sum, _, i) => sum + minPerMov(params[i]?.sets ?? DEFAULT_SETS, params[i]?.rest ?? DEFAULT_REST), 0)
      + totalInterBlockRestGenerated
    : blocks.reduce((sum, b) => sum + b.count * minPerMov(b.sets, b.rest), 0)
      + interBlockRest(blocks.length)

  // ── Duration target logic ──
  // On retire les repos inter-blocs de la durée disponible avant de calculer les mouvements
  const movementTime = duration
    ? Math.max(0, Number(duration) - interBlockRest(blocks.length))
    : null
  const avgMinPerMov = blocks.length > 0
    ? blocks.reduce((s, b) => s + minPerMov(b.sets, b.rest), 0) / blocks.length
    : minPerMov(DEFAULT_SETS, DEFAULT_REST)
  const targetMovements = movementTime !== null
    ? Math.max(1, Math.round(movementTime / avgMinPerMov))
    : null
  const durationDelta = targetMovements ? totalMovements - targetMovements : 0
  const durationOk = Math.abs(durationDelta) <= 1

  const adaptToDuration = () => {
    if (!targetMovements || targetMovements < 1) return
    const n = blocks.length
    const base = Math.max(1, Math.floor(targetMovements / n))
    const extra = Math.max(0, targetMovements - base * n)
    setBlocks(prev => prev.map((b, i) => ({ ...b, count: base + (i < extra ? 1 : 0) })))
  }

  const generateRandom = async (difficulty: 'easy' | 'medium' | 'hard') => {
    setLoading(true)
    setSavedId(null)

    const difficultyMap = {
      easy:   { complexities: ['Easy', 'Common'],   sets: 2, label: 'Facile' },
      medium: { complexities: ['Common', 'Hard'],   sets: 3, label: 'Intermédiaire' },
      hard:   { complexities: ['Hard', 'Advanced'], sets: 4, label: 'Difficile' },
    }
    const { complexities, sets, label } = difficultyMap[difficulty]

    // Random nb of blocks (2-4), random duration (20-60 min)
    const nbBlocks = Math.floor(Math.random() * 3) + 2
    const targetDur = Math.floor(Math.random() * 41) + 20 // 20-60

    // Available time after inter-block rests
    const availableForMovements = Math.max(nbBlocks, targetDur - Math.max(0, nbBlocks - 1) * globalBlockRest)
    const timePerMov = sets * (1 + DEFAULT_REST)
    const totalMovTarget = Math.max(nbBlocks * 2, Math.round(availableForMovements / timePerMov))

    // Distribute across blocks (min 2 per block)
    const base = Math.max(2, Math.floor(totalMovTarget / nbBlocks))
    const extra = Math.max(0, Math.min(nbBlocks, totalMovTarget - base * nbBlocks))

    // Pick nbBlocks distinct bio types (shuffle)
    const shuffledBioTypes = [...BIO_TYPES].sort(() => Math.random() - 0.5)

    const randomBlocks: Block[] = Array.from({ length: nbBlocks }, (_, i) => ({
      id: uid(),
      bioTypes: [shuffledBioTypes[i % shuffledBioTypes.length]],
      complexities: [complexities[Math.floor(Math.random() * complexities.length)]],
      equipments: [],
      count: base + (i < extra ? 1 : 0),
      order: i,
      instructions: '',
      sets,
      reps: DEFAULT_REPS,
      rest: DEFAULT_REST,
    }))

    setBlocks(randomBlocks)
    setDuration(String(targetDur))
    setCollapsedBlocks({})

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: randomBlocks }),
      })
      const data = await res.json()
      setResultBlocks([...randomBlocks])
      setBlockRests(Array(Math.max(0, randomBlocks.length - 1)).fill(globalBlockRest))
      setGenerated(data.movements)
      setParams(data.movements.map((m: { blockIndex: number }) => {
        const b = randomBlocks[m.blockIndex]
        return { sets: b?.sets ?? sets, reps: b?.reps ?? DEFAULT_REPS, rest: b?.rest ?? DEFAULT_REST }
      }))
      const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      setWorkoutName(`Workout ${label} ${date}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1060 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="r-h1" style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Générateur</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 16 }}>Définis ta structure, génère ton entraînement</p>
        </div>

        <div className="r-gen-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) 1fr', gap: 32 }}>

          {/* ── Left: Builder ── */}
          <div>

            {/* ── 1. Section aléatoire ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderLeft: '3px solid var(--gold)', marginBottom: 24, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
              <div onClick={() => setCollapsedRandom(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 34, height: 34, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Dices size={16} color="var(--gold)" strokeWidth={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>Workout aléatoire</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Structure et exercices générés automatiquement · ≤ 60 min</div>
                </div>
                <span style={{ color: 'var(--gold)', opacity: 0.7, flexShrink: 0 }}>
                  {collapsedRandom ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </span>
              </div>

              {!collapsedRandom && (<div style={{ padding: '0 20px 18px' }}>
              {/* Difficulty selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {([
                  { key: 'easy',   label: 'Facile',   sub: 'Easy / Common',   color: '#6BAE7C' },
                  { key: 'medium', label: 'Moyen',    sub: 'Common / Hard',   color: '#D4884A' },
                  { key: 'hard',   label: 'Difficile',sub: 'Hard / Advanced', color: '#C47878' },
                ] as const).map(({ key, label, sub, color }) => {
                  const active = randomDifficulty === key
                  return (
                    <button key={key} onClick={() => setRandomDifficulty(key)} style={{
                      flex: 1, padding: '9px 6px',
                      border: `1px solid ${active ? color : 'var(--border-plus)'}`,
                      background: active ? `${color}18` : 'var(--bg-elevated)',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'border-color 0.12s, background 0.12s',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: active ? color : 'var(--text-muted)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => generateRandom(randomDifficulty)}
                disabled={loading}
                style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: '#080808', border: 'none', fontWeight: 800, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, transition: 'filter 0.15s' }}
              >
                {loading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Génération…</> : <><Dices size={14} /> Générer</>}
              </button>
              </div>)}
            </div>

            {/* ── Séparateur ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.10em' }}>OU</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* ── 2. Section structurée ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, cursor: 'pointer', userSelect: 'none' }} onClick={() => setCollapsedStructure(v => !v)}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Structure personnalisée
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                    {collapsedStructure ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: targetMovements && !durationOk ? 'var(--orange)' : 'var(--text-muted)', marginTop: 2 }}>
                  {totalMovements} mvts · {fmtMin(totalEstMin)}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); loadTemplates() }} disabled={loadingTemplates} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Save size={12} /> {loadingTemplates ? '…' : 'Mes templates'}
              </button>
            </div>

            {!collapsedStructure && (<>

            {showTemplates && templates.length === 0 && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun template trouvé pour ce compte.</span>
                <button
                  onClick={claimTemplates}
                  disabled={claimingTemplates}
                  style={{ fontSize: 12, color: 'var(--gold,#C9A535)', background: 'none', border: '1px solid rgba(201,165,53,0.35)', borderRadius: 6, padding: '5px 11px', cursor: claimingTemplates ? 'wait' : 'pointer', whiteSpace: 'nowrap', opacity: claimingTemplates ? 0.6 : 1 }}
                >
                  {claimingTemplates ? '…' : '↩ Récupérer mes anciens templates'}
                </button>
              </div>
            )}

            {showTemplates && templates.length > 0 && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 8 }}>TEMPLATES SAUVEGARDÉS</div>
                {templates.map(t => (
                  <div key={t.id} style={{ padding: '8px 10px', borderRadius: 7, fontSize: 13, marginBottom: 4, background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                  >
                    <span onClick={() => applyTemplate(t)} style={{ flex: 1, cursor: 'pointer' }}>{t.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>{t.blocks.reduce((s, b) => s + b.count, 0)} mvts</span>
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        await fetch(`/api/templates/${t.id}`, { method: 'DELETE' })
                        setTemplates(prev => prev.filter(x => x.id !== t.id))
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-dim)', flexShrink: 0, lineHeight: 1 }}
                      title="Supprimer"
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {blocks.map((block, idx) => {
                const collapsed = !!collapsedBlocks[block.id]
                return (
                  <div key={block.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.4)' }}>
                    {/* Block header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleCollapse(block.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>BLOC {idx + 1}</span>
                        {block.bioTypes.map(bt => (
                          <span key={bt} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${BIO_TYPE_COLORS[bt]}22`, color: BIO_TYPE_COLORS[bt], border: `1px solid ${BIO_TYPE_COLORS[bt]}44`, fontWeight: 600 }}>
                            {BIO_TYPE_ICONS[bt]} {bt}
                          </span>
                        ))}
                        {block.complexities.map(c => (
                          <span key={c} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${COMPLEXITY_COLORS[c]}22`, color: COMPLEXITY_COLORS[c], border: `1px solid ${COMPLEXITY_COLORS[c]}44`, fontWeight: 600 }}>{c}</span>
                        ))}
                        {block.equipments.map(eq => (
                          <span key={eq} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600 }}>{EQUIPMENT_ICONS[eq]} {eq}</span>
                        ))}
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{block.count} mvt{block.count > 1 ? 's' : ''} · {fmtMin(blockEstMin(block.count, block.sets, block.rest))}</span>
                        {block.instructions && (
                          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>• instructions</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {blocks.length > 1 && (
                          <button onClick={e => { e.stopPropagation(); removeBlock(block.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                        <span style={{ color: 'var(--text-dim)' }}>
                          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible body */}
                    {!collapsed && (
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>NOMBRE DE MOUVEMENTS</label>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                              <button key={n} onClick={() => updateBlock(block.id, 'count', n)} style={{ width: 38, height: 38, borderRadius: 8, border: block.count === n ? '1px solid var(--accent)' : '1px solid var(--border)', background: block.count === n ? 'var(--accent-dim)' : 'var(--bg-elevated)', color: block.count === n ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{n}</button>
                            ))}
                            <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 2px' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <input
                                type="number"
                                min={1}
                                value={block.count}
                                onChange={e => {
                                  const v = parseInt(e.target.value, 10)
                                  if (!isNaN(v) && v >= 1) updateBlock(block.id, 'count', v)
                                }}
                                style={{ width: 56, height: 36, borderRadius: 8, border: `1px dashed ${block.count > 8 ? 'var(--accent)' : 'var(--border)'}`, background: 'transparent', color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, textAlign: 'center', outline: 'none' } as React.CSSProperties}
                              />
                              <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>saisie libre</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            TYPE BIOMÉCANIQUE
                            {block.bioTypes.length === 0 && <span style={{ marginLeft: 6, fontWeight: 400, fontStyle: 'italic' }}>· tous</span>}
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {BIO_TYPES.map(bt => {
                              const active = block.bioTypes.includes(bt)
                              const c = BIO_TYPE_COLORS[bt]
                              return (
                                <button key={bt} onClick={() => toggleBlockArr(block.id, 'bioTypes', bt)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? c : 'var(--border)'}`, background: active ? `${c}22` : 'var(--bg-elevated)', color: active ? c : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>
                                  {BIO_TYPE_ICONS[bt]} {bt}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            COMPLEXITÉ
                            {block.complexities.length === 0 && <span style={{ marginLeft: 6, fontWeight: 400, fontStyle: 'italic' }}>· toutes</span>}
                          </label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {COMPLEXITIES.map(c => {
                              const active = block.complexities.includes(c)
                              const cc = COMPLEXITY_COLORS[c]
                              return (
                                <button key={c} onClick={() => toggleBlockArr(block.id, 'complexities', c)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? cc : 'var(--border)'}`, background: active ? `${cc}22` : 'var(--bg-elevated)', color: active ? cc : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>{c}</button>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            MATÉRIEL
                            {block.equipments.length === 0 && <span style={{ marginLeft: 6, fontWeight: 400, fontStyle: 'italic' }}>· tous</span>}
                          </label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {EQUIPMENT_TYPES.map(eq => {
                              const active = block.equipments.includes(eq)
                              return (
                                <button key={eq} onClick={() => toggleBlockArr(block.id, 'equipments', eq)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${active ? 'var(--text-primary)' : 'var(--border)'}`, background: active ? 'rgba(255,255,255,0.12)' : 'var(--bg-elevated)', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>
                                  {EQUIPMENT_ICONS[eq]} {eq}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        {/* Instructions */}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>INSTRUCTIONS (optionnel)</label>
                          <RichEditor
                            value={block.instructions}
                            onChange={v => updateBlock(block.id, 'instructions', v)}
                            placeholder="Ex: 45s travail / 15s repos, priorité technique…"
                            minHeight={60}
                          />
                        </div>
                        {/* Per-block sets / reps / rest */}
                        <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, display: 'block', marginBottom: 10 }}>PARAMÈTRES</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 0.4 }}>SÉRIES</label>
                              <Stepper value={block.sets} min={1} max={10} onChange={v => updateBlock(block.id, 'sets', v)} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 0.4 }}>REPS</label>
                              <RepsInput value={block.reps} onChange={v => updateBlock(block.id, 'reps', v)} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 0.4 }}>REPOS (min)</label>
                              <Stepper value={block.rest} min={0} max={10} onChange={v => updateBlock(block.id, 'rest', v)} />
                              <span style={{ fontSize: 9, fontStyle: 'italic', color: 'var(--text-dim)' }}>entre chaque série</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={addBlock} style={{ width: '100%', padding: '10px', border: '1px dashed var(--border)', borderRadius: 10, background: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={14} /> Ajouter un bloc
            </button>

            {/* Inter-block rest */}
            <div style={{ marginTop: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.4 }}>REPOS ENTRE BLOCS (min)</label>
                <Stepper value={globalBlockRest} min={0} max={15} onChange={setGlobalBlockRest} />
              </div>
            </div>

            {/* Workout settings */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Video only toggle */}
              <button
                onClick={() => setVideoOnly(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 13px',
                  background: videoOnly ? 'rgba(201,165,53,0.10)' : 'var(--bg-card)',
                  border: `1px solid ${videoOnly ? 'rgba(201,165,53,0.55)' : 'var(--border)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: videoOnly ? 700 : 500,
                  color: videoOnly ? 'var(--gold,#C9A535)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 14 }}>▶</span>
                Vidéos uniquement
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>DURÉE CIBLE (min)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: `1px solid ${targetMovements && !durationOk ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 12px', transition: 'border-color 0.2s' }}>
                <Clock size={14} color={targetMovements && !durationOk ? 'var(--orange)' : 'var(--text-muted)'} />
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="30" min={1} max={180}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
              </div>
            </div>

            {/* Duration guidance banner */}
            {targetMovements && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: durationOk ? 'rgba(21,128,61,0.07)' : 'rgba(194,65,12,0.07)', border: `1px solid ${durationOk ? 'rgba(21,128,61,0.25)' : 'rgba(194,65,12,0.3)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: durationOk ? 'var(--green)' : 'var(--orange)' }}>
                    {durationOk
                      ? `✓ Structure adaptée pour ${duration} min`
                      : `Cible ${duration} min → ${targetMovements} mouvements recommandés`}
                  </div>
                  {!durationOk && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Structure actuelle : {totalMovements} mvts ({durationDelta > 0 ? '+' : ''}{durationDelta} vs cible) · {fmtMin(totalEstMin)} estimé
                    </div>
                  )}
                </div>
                {!durationOk && (
                  <button onClick={adaptToDuration}
                    style={{ flexShrink: 0, padding: '5px 12px', background: 'var(--orange)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Adapter
                  </button>
                )}
              </div>
            )}

            <button onClick={generate} disabled={loading} style={{ marginTop: 16, width: '100%', padding: '14px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.8 : 1 }}>
              {loading ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Génération...</> : <><Zap size={16} /> Générer</>}
            </button>

            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSaveTemplate(true)} style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                Sauvegarder la structure
              </button>
            </div>

            {showSaveTemplate && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nom du template" style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                <button onClick={saveTemplate} disabled={savingTemplate} style={{ padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
                  {savingTemplate ? '...' : 'OK'}
                </button>
              </div>
            )}
            </>)}
          </div>

          {/* ── Right: Generated workout ── */}
          <div>
            {!generated && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: 12 }}>
                <Zap size={48} strokeWidth={1} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>Configure et génère</div>
                <div style={{ fontSize: 13 }}>Ton workout apparaîtra ici</div>
              </div>
            )}

            {generated && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{generated.length} mouvements · {fmtMin(totalEstMin)}</div>
                    {duration && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{duration} min défini</div>}
                  </div>
                  <button onClick={generate} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={12} /> Regénérer
                  </button>
                </div>

                {/* Movements grouped by block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {generatedByBlock.map((movs, bi) => {
                    const block = resultBlocks[bi]
                    if (!block) return null
                    // Compute the absolute index offset for this block
                    const offset = generatedByBlock.slice(0, bi).reduce((s, g) => s + g.length, 0)
                    const resultCollapsed = !!collapsedResultBlocks[block.id]
                    return (
                      <div key={block.id}>
                        {/* Block header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: resultCollapsed ? 0 : 8 }}>
                          <div
                            onClick={() => setCollapsedResultBlocks(prev => ({ ...prev, [block.id]: !prev[block.id] }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {bi + 1}</span>
                            {block.bioTypes.map(bt => (
                              <span key={bt} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${BIO_TYPE_COLORS[bt]}22`, color: BIO_TYPE_COLORS[bt], border: `1px solid ${BIO_TYPE_COLORS[bt]}44`, fontWeight: 600 }}>
                                {BIO_TYPE_ICONS[bt]} {bt}
                              </span>
                            ))}
                            {block.complexities.map(c => (
                              <span key={c} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${COMPLEXITY_COLORS[c]}22`, color: COMPLEXITY_COLORS[c], border: `1px solid ${COMPLEXITY_COLORS[c]}44`, fontWeight: 600 }}>{c}</span>
                            ))}
                            {block.equipments.map(eq => (
                              <span key={eq} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600 }}>{EQUIPMENT_ICONS[eq]} {eq}</span>
                            ))}
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              {fmtMin(movs.reduce((s, _, j) => s + minPerMov(params[offset + j]?.sets ?? DEFAULT_SETS, params[offset + j]?.rest ?? DEFAULT_REST), 0))}
                            </span>
                            <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                              {resultCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                            </span>
                          </div>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                          <button
                            onClick={() => removeGeneratedBlock(bi)}
                            title="Supprimer ce bloc du résultat"
                            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {/* Block instructions preview */}
                        {!resultCollapsed && block.instructions && (
                          <div
                            className="rich-content"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}
                            dangerouslySetInnerHTML={{ __html: block.instructions }}
                          />
                        )}
                        {/* Movements */}
                        {!resultCollapsed && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {movs.map((m, j) => {
                            const i = offset + j
                            return (
                              <div key={`${m.id}-${i}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                  <div
                                    onClick={() => setSelectedMovementId(m.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                                  >
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${BIO_TYPE_COLORS[m.bioType] || '#fff'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                                      {BIO_TYPE_ICONS[m.bioType] || '⚡'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: 14, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{m.name}</div>
                                      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                                        <span style={{ fontSize: 12, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)' }}>{m.bioType}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>·</span>
                                        <span style={{ fontSize: 12, color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>{m.complexity}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                                    <button
                                      onClick={() => handleReroll(i, bi)}
                                      disabled={rerollingIndex === i}
                                      title="Remplacer par un mouvement aléatoire"
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 11, cursor: rerollingIndex === i ? 'wait' : 'pointer', opacity: rerollingIndex === i ? 0.5 : 1 }}
                                    >
                                      <RefreshCw size={11} style={rerollingIndex === i ? { animation: 'spin 1s linear infinite' } : {}} />
                                      Aléatoire
                                    </button>
                                    <button
                                      onClick={() => setSubstitutingIndex(i)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
                                    >
                                      <Search size={11} /> Biblio
                                    </button>
                                    <button
                                      onClick={() => removeGeneratedMovement(i)}
                                      title="Supprimer ce mouvement"
                                      style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-dim)', cursor: 'pointer' }}
                                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444' }}
                                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700 }}>#{i + 1}</span>
                                  </div>
                                </div>

                                {/* Séries · Reps · Repos */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Séries</span>
                                    <Stepper value={params[i]?.sets ?? DEFAULT_SETS} min={1} max={10} onChange={v => setParam(i, 'sets', v)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Reps</span>
                                    <RepsInput value={params[i]?.reps ?? DEFAULT_REPS} onChange={v => setParam(i, 'reps', v)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Repos (min)</span>
                                    <Stepper value={params[i]?.rest ?? DEFAULT_REST} min={0} max={10} onChange={v => setParam(i, 'rest', v)} />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>}
                        {/* Add movement to this block */}
                        {!resultCollapsed && <div style={{ display: 'flex', gap: 6, marginTop: movs.length > 0 ? 8 : 0 }}>
                          <button
                            onClick={() => addRandomToResultBlock(bi)}
                            disabled={addingRandomToBlock === bi}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-dim)', fontSize: 12, cursor: addingRandomToBlock === bi ? 'wait' : 'pointer', opacity: addingRandomToBlock === bi ? 0.6 : 1 }}
                          >
                            <RefreshCw size={11} style={addingRandomToBlock === bi ? { animation: 'spin 1s linear infinite' } : {}} />
                            Mouvement aléatoire
                          </button>
                          <button
                            onClick={() => setAddingToBlockIndex(bi)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer' }}
                          >
                            <Search size={11} /> Depuis la bibliothèque
                          </button>
                        </div>}

                        {/* Per-gap inter-block rest */}
                        {bi < resultBlocks.length - 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>⏸</span>
                              <Stepper
                                value={blockRests[bi] ?? globalBlockRest}
                                min={0}
                                max={15}
                                onChange={v => setBlockRests(prev => prev.map((r, i) => i === bi ? v : r))}
                              />
                              <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>min entre blocs</span>
                            </div>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Add a new block to the result */}
                <button
                  onClick={addResultBlock}
                  style={{ width: '100%', marginBottom: 20, padding: '9px', border: '1px dashed var(--border)', borderRadius: 10, background: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--text-dim)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <Plus size={13} /> Ajouter un bloc
                </button>

                {!savedId ? (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sauvegarder ce workout</div>
                    <input value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="Nom du workout" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 10 }} />
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: 0.4 }}>DESCRIPTION (optionnel)</label>
                      <RichEditor value={workoutDescription} onChange={setWorkoutDescription} placeholder="Décris ce workout…" minHeight={60} />
                    </div>
                    {saveError && (
                      <div style={{ padding: '8px 12px', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: 7, fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>
                        ⚠ {saveError}
                      </div>
                    )}
                    <button onClick={saveWorkout} disabled={saving || !workoutName.trim()} style={{ width: '100%', padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'var(--on-accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Save size={14} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>

                    {!showLaunchConfirm ? (
                      <button onClick={() => setShowLaunchConfirm(true)}
                        style={{ width: '100%', marginTop: 8, padding: '9px', background: 'rgba(201,165,53,0.1)', border: '1px solid rgba(201,165,53,0.3)', borderRadius: 8, color: '#C9A535', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Zap size={13} /> Lancer à la volée
                      </button>
                    ) : (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(201,165,53,0.07)', border: '1px solid rgba(201,165,53,0.25)', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textAlign: 'center' }}>
                          ⚠ Lancer sans sauvegarder ?
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setShowLaunchConfirm(false)}
                            style={{ flex: 1, padding: '7px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                            Annuler
                          </button>
                          <button onClick={launchNow} disabled={launching}
                            style={{ flex: 2, padding: '7px', background: 'rgba(201,165,53,0.15)', border: '1px solid rgba(201,165,53,0.4)', borderRadius: 7, color: '#C9A535', fontSize: 12, fontWeight: 700, cursor: launching ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <Zap size={12} /> {launching ? 'Lancement…' : 'Oui, lancer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--green)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                    <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>✓ Workout sauvegardé !</div>
                    <a href={`/workouts/${savedId}`} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>Voir le workout →</a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <MovementModal movementId={selectedMovementId} onClose={() => setSelectedMovementId(null)} />

      {(substitutingIndex !== null || addingToBlockIndex !== null) && (
        <LibraryPicker
          currentName={substitutingIndex !== null && generated ? (generated[substitutingIndex]?.name ?? '') : ''}
          onPick={handleLibraryPick}
          onClose={() => { setSubstitutingIndex(null); setAddingToBlockIndex(null) }}
        />
      )}
    </AppShell>
  )
}

// ─── Stepper component ────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: value > min ? 'pointer' : 'default', color: value > min ? 'var(--text-primary)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Minus size={12} />
      </button>
      <span style={{ width: 32, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: value < max ? 'pointer' : 'default', color: value < max ? 'var(--text-primary)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Plus size={12} />
      </button>
    </div>
  )
}

// ─── Reps input ───────────────────────────────────────────────────────────────
function RepsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder="10"
      style={{ width: 80, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center' }} />
  )
}
