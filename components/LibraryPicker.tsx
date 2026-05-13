'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { BIO_TYPES, COMPLEXITIES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS } from '@/lib/types'

export interface PickableMovement {
  id: string
  name: string
  bioType: string
  complexity: string
  description?: string | null
  videoUrl?: string | null
}

interface Props {
  currentName: string
  onPick: (m: PickableMovement) => void
  onClose: () => void
}

function Chip({ active, color, onClick, children }: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
      border: `1px solid ${active ? (color || 'var(--text-primary)') : 'var(--border)'}`,
      background: active ? (color ? `${color}18` : 'rgba(0,0,0,0.08)') : 'var(--bg-elevated)',
      color: active ? (color || 'var(--text-primary)') : 'var(--text-muted)',
      fontWeight: active ? 600 : 400,
    }}>
      {children}
    </button>
  )
}

export default function LibraryPicker({ currentName, onPick, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [bioFilter, setBioFilter] = useState('')
  const [complexityFilter, setComplexityFilter] = useState('')
  const [results, setResults] = useState<PickableMovement[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const doFetch = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (bioFilter) p.set('bioType', bioFilter)
    if (complexityFilter) p.set('complexity', complexityFilter)
    if (search) p.set('search', search)
    const res = await fetch(`/api/movements?${p}`)
    setResults(await res.json())
    setLoading(false)
  }, [bioFilter, complexityFilter, search])

  useEffect(() => { const t = setTimeout(doFetch, 200); return () => clearTimeout(t) }, [doFetch])
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
        width: 560, maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Choisir un mouvement</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Remplace : <span style={{ color: 'var(--text-primary)' }}>{currentName}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={17} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={11} color="var(--text-muted)" /></button>}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip active={!bioFilter} color="" onClick={() => setBioFilter('')}>Tous</Chip>
            {BIO_TYPES.map(bt => (
              <Chip key={bt} active={bioFilter === bt} color={BIO_TYPE_COLORS[bt]} onClick={() => setBioFilter(bioFilter === bt ? '' : bt)}>
                {BIO_TYPE_ICONS[bt]} {bt}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip active={!complexityFilter} color="" onClick={() => setComplexityFilter('')}>Tous niveaux</Chip>
            {COMPLEXITIES.map(c => (
              <Chip key={c} active={complexityFilter === c} color={COMPLEXITY_COLORS[c]} onClick={() => setComplexityFilter(complexityFilter === c ? '' : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>}
          {!loading && results.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucun résultat</div>}
          {!loading && results.map(m => (
            <button key={m.id} onClick={() => onPick(m)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8,
                background: 'transparent', border: '1px solid transparent',
                cursor: 'pointer', marginBottom: 2, textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${BIO_TYPE_COLORS[m.bioType] || '#000'}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                {BIO_TYPE_ICONS[m.bioType] || '⚡'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  <span style={{ color: BIO_TYPE_COLORS[m.bioType] || 'var(--text-muted)' }}>{m.bioType}</span>
                  <span style={{ color: 'var(--text-dim)' }}> · </span>
                  <span style={{ color: COMPLEXITY_COLORS[m.complexity] || 'var(--text-muted)' }}>{m.complexity}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
