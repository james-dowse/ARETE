import { COMPLEXITY_COLORS } from '@/lib/types'

// Overlay coloré discret sur une image de couverture, selon la difficulté
// calculée du workout (computeWorkoutDifficulty). Couleur pilotée par
// COMPLEXITY_COLORS (Admin > Référentiels) — aucune palette en dur ici.
export default function DifficultyImageTint({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null
  const color = COMPLEXITY_COLORS[difficulty]
  if (!color) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(to top, ${color}55, transparent 60%)`,
        pointerEvents: 'none',
      }}
    />
  )
}
