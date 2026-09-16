'use client'
import { useState } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'

// Panneau de filtres repliable.
//
// Les écrans « Mes séances » et « Bibliothèque » affichaient toutes leurs
// pastilles de filtre en permanence : sur téléphone, cela représentait 26 à 35
// pastilles sur 8 rangées, soit environ 1 000 px à faire défiler avant la
// première séance. On ouvre l'application pour s'entraîner et on tombe sur un
// formulaire.
//
// Le panneau est donc replié par défaut. Ce qui reste visible en permanence :
// le bouton « Filtrer » avec le nombre de filtres actifs, et les filtres
// actifs eux-mêmes sous forme de pastilles supprimables — on ne perd jamais de
// vue ce qui restreint la liste, ce qui était le seul intérêt de tout afficher.

export interface ActiveFilter {
  /** Identifiant unique, sert de clé React et d'argument à onRemove. */
  key: string
  label: string
  /** Couleur d'accent de la pastille ; par défaut la couleur d'action. */
  color?: string
  onRemove: () => void
}

export default function FilterPanel({
  active,
  onClearAll,
  children,
  label = 'Filtrer',
}: {
  active: ActiveFilter[]
  onClearAll: () => void
  children: React.ReactNode
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const count = active.length

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 'var(--r-sm)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: count > 0 ? 'var(--crimson-ghost)' : 'var(--bg-card)',
            color: count > 0 ? 'var(--crimson-bright)' : 'var(--text-muted)',
            border: `1px solid ${count > 0 ? 'var(--crimson-border)' : 'var(--border)'}`,
            transition: 'background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)',
          }}
        >
          <SlidersHorizontal size={14} />
          {label}
          {count > 0 && (
            <span style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-full)',
              background: 'var(--crimson)', color: 'var(--on-accent)',
              fontSize: 11, fontWeight: 800, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
            }}>{count}</span>
          )}
          <ChevronDown
            size={13}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-med) var(--ease)' }}
          />
        </button>

        {/* Résumé des filtres actifs — toujours visible, panneau ouvert ou non. */}
        {active.map(f => (
          <button
            key={f.key}
            onClick={f.onRemove}
            title={`Retirer « ${f.label} »`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 'var(--r-full)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: `${f.color ?? 'var(--crimson-bright)'}1A`,
              color: f.color ?? 'var(--crimson-bright)',
              border: `1px solid ${f.color ?? 'var(--crimson-bright)'}59`,
            }}
          >
            {f.label}
            <X size={11} />
          </button>
        ))}

        {count > 1 && (
          <button
            onClick={onClearAll}
            style={{
              padding: '5px 10px', borderRadius: 'var(--r-full)', fontSize: 12,
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-dim)', cursor: 'pointer',
            }}
          >Tout effacer</button>
        )}
      </div>

      {open && (
        <div style={{
          marginTop: 12, padding: 14,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          display: 'flex', flexDirection: 'column', gap: 14,
          // Sur un petit écran, le panneau déplié reste borné et défile
          // lui-même plutôt que de repousser la liste hors de l'écran.
          maxHeight: 'min(56vh, 460px)', overflowY: 'auto',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// Groupe étiqueté à l'intérieur du panneau.
export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-dim)', marginBottom: 8,
      }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}
