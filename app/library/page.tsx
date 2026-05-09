'use client'
import AppShell from '@/components/AppShell'
import MovementModal from '@/components/MovementModal'
import { BIO_TYPES, COMPLEXITIES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS } from '@/lib/types'
import { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'

interface Movement {
  id: string
  name: string
  bioType: string
  complexity: string
  description?: string | null
  videoUrl?: string | null
}

export default function LibraryPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bioFilter, setBioFilter] = useState<string | null>(null)
  const [complexityFilter, setComplexityFilter] = useState<string | null>(null)
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (bioFilter) params.set('bioType', bioFilter)
    if (complexityFilter) params.set('complexity', complexityFilter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/movements?${params}`)
    const data = await res.json()
    setMovements(data)
    setLoading(false)
  }, [bioFilter, complexityFilter, search])

  useEffect(() => {
    const t = setTimeout(fetchMovements, 300)
    return () => clearTimeout(t)
  }, [fetchMovements])

  // Tri par pertinence quand une recherche est active, alphabétique sinon
  const relevanceScore = (name: string, q: string): number => {
    const n = name.toLowerCase()
    const s = q.toLowerCase().trim()
    if (!s) return 0
    if (n === s) return 3                          // correspondance exacte
    if (n.startsWith(s)) return 2                 // commence par le terme
    if (n.includes(` ${s}`) || n.includes(`-${s}`)) return 1  // mot entier
    return 0                                      // contient (ordre alpha)
  }

  const sorted = search
    ? [...movements].sort((a, b) => {
        const diff = relevanceScore(b.name, search) - relevanceScore(a.name, search)
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      })
    : movements

  const groupByBio = !bioFilter
  const grouped: Record<string, Movement[]> = {}
  if (groupByBio) {
    sorted.forEach(m => {
      if (!grouped[m.bioType]) grouped[m.bioType] = []
      grouped[m.bioType].push(m)
    })
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1000 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Bibliothèque</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 16 }}>
            {loading ? '...' : `${movements.length} mouvements`}
          </p>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un mouvement..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={14} color="var(--text-muted)" /></button>}
          </div>

          {/* Bio filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setBioFilter(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !bioFilter ? '1px solid var(--text-primary)' : '1px solid var(--border)', background: !bioFilter ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: !bioFilter ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: !bioFilter ? 600 : 400 }}>
              Tous
            </button>
            {BIO_TYPES.map(bt => {
              const active = bioFilter === bt
              const color = BIO_TYPE_COLORS[bt]
              return (
                <button key={bt} onClick={() => setBioFilter(active ? null : bt)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
                  {BIO_TYPE_ICONS[bt]} {bt}
                </button>
              )
            })}
          </div>

          {/* Complexity filters */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setComplexityFilter(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !complexityFilter ? '1px solid var(--text-primary)' : '1px solid var(--border)', background: !complexityFilter ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: !complexityFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              Tous niveaux
            </button>
            {COMPLEXITIES.map(c => {
              const active = complexityFilter === c
              const color = COMPLEXITY_COLORS[c]
              return (
                <button key={c} onClick={() => setComplexityFilter(active ? null : c)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-muted)' }}>
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 10, height: 72, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && groupByBio && (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([bt, mvts]) => (
            <div key={bt} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>{BIO_TYPE_ICONS[bt]}</span>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: BIO_TYPE_COLORS[bt] || 'var(--text-primary)' }}>{bt}</h2>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{mvts.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {mvts.map(m => <MovementCard key={m.id} movement={m} onClick={() => setSelectedMovementId(m.id)} />)}
              </div>
            </div>
          ))
        )}

        {!loading && !groupByBio && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {sorted.map(m => <MovementCard key={m.id} movement={m} onClick={() => setSelectedMovementId(m.id)} />)}
          </div>
        )}

        {!loading && movements.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div>Aucun mouvement trouvé</div>
          </div>
        )}
      </div>

      <MovementModal movementId={selectedMovementId} onClose={() => setSelectedMovementId(null)} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </AppShell>
  )
}

function MovementCard({ movement: m, onClick }: { movement: Movement; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-dim)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${BIO_TYPE_COLORS[m.bioType] || '#fff'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {BIO_TYPE_ICONS[m.bioType] || '⚡'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 12, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)' }}>{m.bioType}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>·</span>
          <span style={{ fontSize: 12, color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>{m.complexity}</span>
        </div>
      </div>
      {m.videoUrl && (
        <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>▶</span>
      )}
    </div>
  )
}
