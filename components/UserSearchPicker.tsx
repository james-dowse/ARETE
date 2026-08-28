'use client'
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import CreatorBadge, { creatorName } from '@/components/CreatorBadge'

export interface FoundUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl: string | null
}

export default function UserSearchPicker({ onSelect, placeholder, autoFocus }: {
  onSelect: (user: FoundUser) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => setResults(data.users ?? []))
        .finally(() => setSearching(false))
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Nom, prénom ou email…'}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }}
        />
      </div>
      {query.trim().length >= 2 && (
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {searching && <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 4px' }}>Recherche…</div>}
          {!searching && results.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 4px' }}>Aucun utilisateur trouvé</div>
          )}
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
            >
              <CreatorBadge user={u} size={26} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creatorName(u)}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
