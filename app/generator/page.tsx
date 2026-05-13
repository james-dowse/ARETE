'use client'
import AppShell from '@/components/AppShell'
import { BIO_TYPES, COMPLEXITIES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, type TemplateBlockInput, type GeneratedMovement } from '@/lib/types'
import RichEditor from '@/components/RichEditor'
import { useState } from 'react'
import { Plus, Trash2, Zap, Save, RefreshCw, Clock, Minus, ChevronDown, ChevronUp, Dices, Search } from 'lucide-react'
import MovementModal from '@/components/MovementModal'
import LibraryPicker, { type PickableMovement } from '@/components/LibraryPicker'

interface Block extends TemplateBlockInput { id: string; instructions: string }
interface MovementParams { sets: number; reps: string; rest: number }

function uid() { return Math.random().toString(36).slice(2) }

const DEFAULT_SETS = 2
const DEFAULT_REPS = '10'

export default function GeneratorPage() {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: uid(), bioType: null, complexity: null, count: 3, order: 0, instructions: '' },
  ])
  const [duration, setDuration] = useState('')
  const [workoutName, setWorkoutName] = useState('')

  // Generated movements + per-movement sets/reps
  const [generated, setGenerated] = useState<GeneratedMovement[] | null>(null)
  const [params, setParams] = useState<MovementParams[]>([])

  // Global defaults (apply on generate)
  const [globalSets, setGlobalSets] = useState(DEFAULT_SETS)
  const [globalReps, setGlobalReps] = useState(DEFAULT_REPS)
  const [globalRest, setGlobalRest] = useState(1)      // minutes de repos entre séries
  const [globalBlockRest, setGlobalBlockRest] = useState(2) // minutes de repos entre blocs

  const [workoutDescription, setWorkoutDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; blocks: Block[] }[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [claimingTemplates, setClaimingTemplates] = useState(false)

  // Track which block cards are collapsed
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({})

  // Random workout
  const [randomDifficulty, setRandomDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  // Movement detail modal
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)

  // Library substitution
  const [substitutingIndex, setSubstitutingIndex] = useState<number | null>(null)

  const handleLibraryPick = (m: PickableMovement) => {
    if (substitutingIndex === null) return
    setGenerated(prev => prev!.map((gm, i) =>
      i === substitutingIndex
        ? { id: m.id, name: m.name, bioType: m.bioType, complexity: m.complexity, videoUrl: m.videoUrl ?? null, blockIndex: gm.blockIndex }
        : gm
    ))
    setSubstitutingIndex(null)
  }

  const addBlock = () => setBlocks(prev => [...prev, { id: uid(), bioType: null, complexity: null, count: 3, order: prev.length, instructions: '' }])
  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id))
  const updateBlock = (id: string, field: keyof Block, value: string | number | null) =>
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
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
        body: JSON.stringify({ blocks }),
      })
      const data = await res.json()
      setGenerated(data.movements)
      setParams(data.movements.map(() => ({ sets: globalSets, reps: globalReps, rest: globalRest })))
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
            sets: params[i]?.sets ?? globalSets,
            reps: params[i]?.reps ?? globalReps,
            rest: params[i]?.rest ?? globalRest,
            blockIndex: m.blockIndex,
          })),
          blocks: blocks.map((b, i) => ({
            order: i,
            bioType: b.bioType,
            instructions: b.instructions || null,
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
        blocks: t.blocks.map((b: { bioType: string | null; complexity: string | null; count: number; order: number }) => ({ ...b, id: uid(), instructions: '' })),
      })))
      setShowTemplates(true)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const applyTemplate = (tpl: { blocks: Block[] }) => {
    setBlocks(tpl.blocks); setShowTemplates(false); setGenerated(null)
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

  // Group generated movements by blockIndex
  const generatedByBlock: GeneratedMovement[][] = generated
    ? blocks.map((_, bi) => (generated || []).filter(m => m.blockIndex === bi))
    : []

  // ── Duration estimates ──
  const fmtMin = (min: number) => {
    const r = Math.round(min)
    if (r < 60) return `~${r}min`
    const h = Math.floor(r / 60); const m = r % 60
    return m > 0 ? `~${h}h${m}min` : `~${h}h`
  }
  const minPerMov = (sets: number) => sets * (1 + globalRest)
  const blockEstMin = (count: number, sets: number) => count * minPerMov(sets)
  const interBlockRest = (nbBlocks: number) => Math.max(0, nbBlocks - 1) * globalBlockRest
  const totalEstMin = generated
    ? generated.reduce((sum, _, i) => sum + minPerMov(params[i]?.sets ?? globalSets), 0)
      + interBlockRest(generatedByBlock.filter(g => g.length > 0).length)
    : blocks.reduce((sum, b) => sum + b.count * minPerMov(globalSets), 0)
      + interBlockRest(blocks.length)

  // ── Duration target logic ──
  // On retire les repos inter-blocs de la durée disponible avant de calculer les mouvements
  const movementTime = duration
    ? Math.max(0, Number(duration) - interBlockRest(blocks.length))
    : null
  const targetMovements = movementTime !== null
    ? Math.max(1, Math.round(movementTime / minPerMov(globalSets)))
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
    const timePerMov = sets * (1 + globalRest)
    const totalMovTarget = Math.max(nbBlocks * 2, Math.round(availableForMovements / timePerMov))

    // Distribute across blocks (min 2 per block)
    const base = Math.max(2, Math.floor(totalMovTarget / nbBlocks))
    const extra = Math.max(0, Math.min(nbBlocks, totalMovTarget - base * nbBlocks))

    // Pick nbBlocks distinct bio types (shuffle)
    const shuffledBioTypes = [...BIO_TYPES].sort(() => Math.random() - 0.5)

    const randomBlocks: Block[] = Array.from({ length: nbBlocks }, (_, i) => ({
      id: uid(),
      bioType: shuffledBioTypes[i % shuffledBioTypes.length],
      complexity: complexities[Math.floor(Math.random() * complexities.length)],
      count: base + (i < extra ? 1 : 0),
      order: i,
      instructions: '',
    }))

    setBlocks(randomBlocks)
    setGlobalSets(sets)
    setDuration(String(targetDur))
    setCollapsedBlocks({})

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: randomBlocks }),
      })
      const data = await res.json()
      setGenerated(data.movements)
      setParams(data.movements.map(() => ({ sets, reps: globalReps, rest: globalRest })))
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
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderLeft: '3px solid var(--gold)', padding: '20px 20px 18px', marginBottom: 24, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 16px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Dices size={16} color="var(--gold)" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>Workout aléatoire</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Structure et exercices générés automatiquement · ≤ 60 min</div>
                </div>
              </div>

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
            </div>

            {/* ── Séparateur ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.10em' }}>OU</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* ── 2. Section structurée ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Structure personnalisée</div>
                <div style={{ fontSize: 12, color: targetMovements && !durationOk ? 'var(--orange)' : 'var(--text-muted)', marginTop: 2 }}>
                  {totalMovements} mvts · {fmtMin(totalEstMin)}
                </div>
              </div>
              <button onClick={loadTemplates} disabled={loadingTemplates} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Save size={12} /> {loadingTemplates ? '…' : 'Mes templates'}
              </button>
            </div>

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
                const color = block.bioType ? BIO_TYPE_COLORS[block.bioType] : 'var(--text-muted)'
                return (
                  <div key={block.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.4)' }}>
                    {/* Block header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleCollapse(block.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>BLOC {idx + 1}</span>
                        {block.bioType && (
                          <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${color}22`, color, border: `1px solid ${color}44`, fontWeight: 600 }}>
                            {BIO_TYPE_ICONS[block.bioType]} {block.bioType}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{block.count} mvt{block.count > 1 ? 's' : ''} · {fmtMin(blockEstMin(block.count, globalSets))}</span>
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
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>TYPE BIOMÉCANIQUE</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <button onClick={() => updateBlock(block.id, 'bioType', null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !block.bioType ? '1px solid var(--text-muted)' : '1px solid var(--border)', background: !block.bioType ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)', color: !block.bioType ? 'var(--text-primary)' : 'var(--text-muted)' }}>Tous</button>
                            {BIO_TYPES.map(bt => {
                              const active = block.bioType === bt
                              const c = BIO_TYPE_COLORS[bt]
                              return (
                                <button key={bt} onClick={() => updateBlock(block.id, 'bioType', active ? null : bt)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? c : 'var(--border)'}`, background: active ? `${c}22` : 'var(--bg-elevated)', color: active ? c : 'var(--text-muted)' }}>
                                  {BIO_TYPE_ICONS[bt]} {bt}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>COMPLEXITÉ</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => updateBlock(block.id, 'complexity', null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !block.complexity ? '1px solid var(--text-muted)' : '1px solid var(--border)', background: !block.complexity ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)', color: !block.complexity ? 'var(--text-primary)' : 'var(--text-muted)' }}>Tous</button>
                            {COMPLEXITIES.map(c => {
                              const active = block.complexity === c
                              const cc = COMPLEXITY_COLORS[c]
                              return (
                                <button key={c} onClick={() => updateBlock(block.id, 'complexity', active ? null : c)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? cc : 'var(--border)'}`, background: active ? `${cc}22` : 'var(--bg-elevated)', color: active ? cc : 'var(--text-muted)' }}>{c}</button>
                              )
                            })}
                          </div>
                        </div>
                        {/* Instructions */}
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>INSTRUCTIONS (optionnel)</label>
                          <RichEditor
                            value={block.instructions}
                            onChange={v => updateBlock(block.id, 'instructions', v)}
                            placeholder="Ex: 45s travail / 15s repos, priorité technique…"
                            minHeight={60}
                          />
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

            {/* Global defaults */}
            <div style={{ marginTop: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, marginBottom: 12 }}>PARAMÈTRES DES MOUVEMENTS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>SÉRIES</label>
                  <Stepper value={globalSets} min={1} max={10} onChange={setGlobalSets} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>RÉPÉTITIONS</label>
                  <RepsInput value={globalReps} onChange={setGlobalReps} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>REPOS (min)</label>
                  <Stepper value={globalRest} min={0} max={10} onChange={setGlobalRest} />
                  <div style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-dim)', marginTop: 4 }}>entre chaque série</div>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>REPOS ENTRE BLOCS (min)</label>
                <Stepper value={globalBlockRest} min={0} max={15} onChange={setGlobalBlockRest} />
              </div>
            </div>

            {/* Workout settings */}
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
                    const block = blocks[bi]
                    if (!block || movs.length === 0) return null
                    const blockColor = block.bioType ? BIO_TYPE_COLORS[block.bioType] : 'var(--text-muted)'
                    // Compute the absolute index offset for this block
                    const offset = generatedByBlock.slice(0, bi).reduce((s, g) => s + g.length, 0)
                    return (
                      <div key={block.id}>
                        {/* Block header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {bi + 1}</span>
                            {block.bioType && (
                              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${blockColor}22`, color: blockColor, border: `1px solid ${blockColor}44`, fontWeight: 600 }}>
                                {BIO_TYPE_ICONS[block.bioType]} {block.bioType}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              {fmtMin(movs.reduce((s, _, j) => s + minPerMov(params[offset + j]?.sets ?? globalSets), 0))}
                            </span>
                          </div>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        </div>
                        {/* Block instructions preview */}
                        {block.instructions && (
                          <div
                            className="rich-content"
                            style={{ background: `${blockColor}10`, border: `1px solid ${blockColor}30`, borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}
                            dangerouslySetInnerHTML={{ __html: block.instructions }}
                          />
                        )}
                        {/* Movements */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                      onClick={() => setSubstitutingIndex(i)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
                                    >
                                      <Search size={11} /> Biblio
                                    </button>
                                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700 }}>#{i + 1}</span>
                                  </div>
                                </div>

                                {/* Séries · Reps · Repos */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Séries</span>
                                    <Stepper value={params[i]?.sets ?? globalSets} min={1} max={10} onChange={v => setParam(i, 'sets', v)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Reps</span>
                                    <RepsInput value={params[i]?.reps ?? globalReps} onChange={v => setParam(i, 'reps', v)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Repos (min)</span>
                                    <Stepper value={params[i]?.rest ?? globalRest} min={0} max={10} onChange={v => setParam(i, 'rest', v)} />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Inter-block rest */}
                        {generatedByBlock.slice(bi + 1).some(g => g.length > 0) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              ⏸ {globalBlockRest} min · repos entre blocs
                            </span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

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

      {substitutingIndex !== null && generated && (
        <LibraryPicker
          currentName={generated[substitutingIndex]?.name ?? ''}
          onPick={handleLibraryPick}
          onClose={() => setSubstitutingIndex(null)}
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
