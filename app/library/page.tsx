'use client'
import AppShell from '@/components/AppShell'
import MovementModal from '@/components/MovementModal'
import { BIO_TYPES, COMPLEXITIES, EQUIPMENT_TYPES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, EQUIPMENT_ICONS } from '@/lib/types'
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Star, BookOpen, ArrowUpDown } from 'lucide-react'

type SortOption = 'name' | 'name-desc' | 'complexity' | 'complexity-desc'

const SORT_LABELS: Record<SortOption, string> = {
  name: 'Nom (A→Z)',
  'name-desc': 'Nom (Z→A)',
  complexity: 'Difficulté ↑',
  'complexity-desc': 'Difficulté ↓',
}

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
  // Multi-sélection : un ensemble vide = pas de restriction sur ce critère
  const [bioFilters, setBioFilters] = useState<Set<string>>(new Set())
  const [complexityFilters, setComplexityFilters] = useState<Set<string>>(new Set())
  const [equipmentFilters, setEquipmentFilters] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('name')

  const toggleInSet = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSet(next)
  }
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'all' | 'favorites'>('all')

  // Load favorites once
  useEffect(() => {
    fetch('/api/favorites').then(r => r.json()).then((ids: string[]) => {
      setFavIds(new Set(ids))
    }).catch(() => {})
  }, [])

  // bioType/complexity/equipment sont désormais filtrés côté client (multi-sélection) :
  // seule la recherche texte reste envoyée au serveur.
  const fetchMovements = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch(`/api/movements?${params}`)
    const data = await res.json()
    setMovements(data)
    setLoading(false)
  }, [search])

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

  const complexityRank = (c: string) => {
    const i = COMPLEXITIES.indexOf(c)
    return i === -1 ? COMPLEXITIES.length : i
  }

  const sortComparator = (a: Movement, b: Movement) => {
    switch (sortBy) {
      case 'name-desc': return b.name.localeCompare(a.name)
      case 'complexity': {
        const d = complexityRank(a.complexity) - complexityRank(b.complexity)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      }
      case 'complexity-desc': {
        const d = complexityRank(b.complexity) - complexityRank(a.complexity)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      }
      case 'name':
      default: return a.name.localeCompare(b.name)
    }
  }

  // La pertinence de recherche prime sur le tri choisi quand on filtre par texte
  const sorted = search
    ? [...movements].sort((a, b) => {
        const diff = relevanceScore(b.name, search) - relevanceScore(a.name, search)
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      })
    : [...movements].sort(sortComparator)

  // Filtres client-side, multi-sélection : OR à l'intérieur d'un critère, AND entre critères
  const matchesFilters = (m: Movement) =>
    (bioFilters.size === 0 || bioFilters.has(m.bioType)) &&
    (complexityFilters.size === 0 || complexityFilters.has(m.complexity)) &&
    (equipmentFilters.size === 0 || (m.equipment != null && equipmentFilters.has(m.equipment)))

  const filtered = sorted.filter(matchesFilters)
  const displayed = tab === 'favorites' ? filtered.filter(m => favIds.has(m.id)) : filtered

  const groupByBio = bioFilters.size === 0
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
      <div style={{ maxWidth: 1240, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="r-h1">Bibliothèque</h1>
          <p className="r-subtitle">
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
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 220 }}>
                <Search size={16} color="var(--text-muted)" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un mouvement..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, flex: 1 }} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={14} color="var(--text-muted)" /></button>}
              </div>

              <div
                title={search ? 'Recherche active : tri par pertinence' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', opacity: search ? 0.5 : 1 }}
              >
                <ArrowUpDown size={14} color="var(--text-muted)" />
                <select
                  value={sortBy}
                  disabled={!!search}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, cursor: search ? 'default' : 'pointer' }}
                >
                  {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                    <option key={opt} value={opt} style={{ background: 'var(--bg-card)' }}>{SORT_LABELS[opt]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Multi-sélection : clique plusieurs types pour les combiner (OR) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bioFilters.size > 0 && (
                <button onClick={() => setBioFilters(new Set())} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}><X size={11} /> Tout</button>
              )}
              {BIO_TYPES.map(bt => {
                const active = bioFilters.has(bt)
                const color = BIO_TYPE_COLORS[bt]
                return (
                  <button key={bt} onClick={() => toggleInSet(bioFilters, setBioFilters, bt)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
                    {BIO_TYPE_ICONS[bt]} {bt}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {complexityFilters.size > 0 && (
                <button onClick={() => setComplexityFilters(new Set())} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}><X size={11} /> Tout</button>
              )}
              {COMPLEXITIES.map(c => {
                const active = complexityFilters.has(c)
                const color = COMPLEXITY_COLORS[c]
                return (
                  <button key={c} onClick={() => toggleInSet(complexityFilters, setComplexityFilters, c)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-muted)' }}>
                    {c}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {equipmentFilters.size > 0 && (
                <button onClick={() => setEquipmentFilters(new Set())} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}><X size={11} /> Tout</button>
              )}
              {EQUIPMENT_TYPES.map(eq => {
                const active = equipmentFilters.has(eq)
                return (
                  <button key={eq} onClick={() => toggleInSet(equipmentFilters, setEquipmentFilters, eq)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${active ? 'var(--text-muted)' : 'var(--border)'}`, background: active ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
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
