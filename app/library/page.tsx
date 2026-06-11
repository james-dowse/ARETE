'use client'
import AppShell from '@/components/AppShell'
import MovementModal from '@/components/MovementModal'
import { BIO_TYPES, COMPLEXITIES, EQUIPMENT_TYPES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, EQUIPMENT_ICONS } from '@/lib/types'
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Star, BookOpen } from 'lucide-react'

interface Movement {
  id: string
  name: string
  bioType: string
  complexity: string
  equipment?: string | null
  description?: string | null
  videoUrl?: string | null
}

export default function LibraryPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bioFilter, setBioFilter] = useState<string | null>(null)
  const [complexityFilter, setComplexityFilter] = useState<string | null>(null)
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null)
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'all' | 'favorites'>('all')

  // Load favorites once
  useEffect(() => {
    fetch('/api/favorites').then(r => r.json()).then((ids: string[]) => {
      setFavIds(new Set(ids))
    }).catch(() => {})
  }, [])

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (bioFilter) params.set('bioType', bioFilter)
    if (complexityFilter) params.set('complexity', complexityFilter)
    if (equipmentFilter) params.set('equipment', equipmentFilter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/movements?${params}`)
    const data = await res.json()
    setMovements(data)
    setLoading(false)
  }, [bioFilter, complexityFilter, equipmentFilter, search])

  useEffect(() => {
    const t = setTimeout(fetchMovements, 300)
    return () => clearTimeout(t)
  }, [fetchMovements])

  const toggleFav = async (id: string) => {
    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movementId: id }),
    })
    const data = await res.json()
    setFavIds(prev => {
      const next = new Set(prev)
      if (data.favorited) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // Tri par pertinence quand une recherche est active, alphabétique sinon
  const relevanceScore = (name: string, q: string): number => {
    const n = name.toLowerCase()
    const s = q.toLowerCase().trim()
    if (!s) return 0
    if (n === s) return 3
    if (n.startsWith(s)) return 2
    if (n.includes(` ${s}`) || n.includes(`-${s}`)) return 1
    return 0
  }

  const sorted = search
    ? [...movements].sort((a, b) => {
        const diff = relevanceScore(b.name, search) - relevanceScore(a.name, search)
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      })
    : movements

  const displayed = tab === 'favorites' ? sorted.filter(m => favIds.has(m.id)) : sorted

  const groupByBio = !bioFilter && tab !== 'favorites'
  const grouped: Record<string, Movement[]> = {}
  if (groupByBio) {
    displayed.forEach(m => {
      if (!grouped[m.bioType]) grouped[m.bioType] = []
      grouped[m.bioType].push(m)
    })
  }

  const tabBtn = (t: 'all' | 'favorites'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: tab === t ? 700 : 500,
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? 'var(--on-accent)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  })

  return (
    <AppShell>
      <div style={{ maxWidth: 1000 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Bibliothèque</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 16 }}>
            {loading ? '...' : `${displayed.length} mouvement${displayed.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
          <button style={tabBtn('all')} onClick={() => setTab('all')}><BookOpen size={13} /> Tous</button>
          <button style={tabBtn('favorites')} onClick={() => setTab('favorites')}>
            <Star size={13} fill={tab === 'favorites' ? 'var(--on-accent)' : 'none'} /> Favoris {favIds.size > 0 && <span style={{ fontSize: 11, opacity: 0.75 }}>({favIds.size})</span>}
          </button>
        </div>

        {/* Filters (hidden in favorites tab) */}
        {tab === 'all' && (
          <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un mouvement..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, flex: 1 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={14} color="var(--text-muted)" /></button>}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setBioFilter(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !bioFilter ? '1px solid var(--text-primary)' : '1px solid var(--border)', background: !bioFilter ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: !bioFilter ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: !bioFilter ? 600 : 400 }}>Tous</button>
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

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setComplexityFilter(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !complexityFilter ? '1px solid var(--text-primary)' : '1px solid var(--border)', background: !complexityFilter ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: !complexityFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>Tous niveaux</button>
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

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setEquipmentFilter(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: !equipmentFilter ? '1px solid var(--text-primary)' : '1px solid var(--border)', background: !equipmentFilter ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: !equipmentFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>Tout équipement</button>
              {EQUIPMENT_TYPES.map(eq => {
                const active = equipmentFilter === eq
                return (
                  <button key={eq} onClick={() => setEquipmentFilter(active ? null : eq)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${active ? 'var(--text-muted)' : 'var(--border)'}`, background: active ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
                    {EQUIPMENT_ICONS[eq]} {eq}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Search bar in favorites tab */}
        {tab === 'favorites' && (
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrer les favoris..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={14} color="var(--text-muted)" /></button>}
          </div>
        )}

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
                {mvts.map(m => <MovementCard key={m.id} movement={m} isFav={favIds.has(m.id)} onFav={toggleFav} onClick={() => setSelectedMovementId(m.id)} />)}
              </div>
            </div>
          ))
        )}

        {!loading && !groupByBio && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {displayed.map(m => <MovementCard key={m.id} movement={m} isFav={favIds.has(m.id)} onFav={toggleFav} onClick={() => setSelectedMovementId(m.id)} />)}
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === 'favorites' ? '⭐' : '🔍'}</div>
            <div>{tab === 'favorites' ? 'Aucun favori encore — clique sur ★ sur un mouvement' : 'Aucun mouvement trouvé'}</div>
          </div>
        )}
      </div>

      <MovementModal movementId={selectedMovementId} onClose={() => setSelectedMovementId(null)} />

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </AppShell>
  )
}

function MovementCard({ movement: m, isFav, onFav, onClick }: { movement: Movement; isFav: boolean; onFav: (id: string) => void; onClick: () => void }) {
  return (
    <div
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-dim)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${BIO_TYPE_COLORS[m.bioType] || '#fff'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {BIO_TYPE_ICONS[m.bioType] || '⚡'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)' }}>{m.bioType}</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>·</span>
            <span style={{ fontSize: 12, color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>{m.complexity}</span>
            {m.equipment && (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{EQUIPMENT_ICONS[m.equipment] || '🔧'} {m.equipment}</span>
              </>
            )}
          </div>
        </div>
        {m.videoUrl && <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>▶</span>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onFav(m.id) }}
        title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isFav ? 'var(--gold)' : 'var(--text-dim)', flexShrink: 0, transition: 'color 0.15s' }}
      >
        <Star size={14} fill={isFav ? 'var(--gold)' : 'none'} />
      </button>
    </div>
  )
}
