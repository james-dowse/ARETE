import { COMPLEXITY_COLORS } from '@/lib/types'
import { hexToHsl, hslToCss } from '@/lib/color'

// À appliquer sur l'<img> elle-même (aux côtés de ce composant, en overlay)
// pour que le filtre coloré ci-dessous soit un vrai duotone plutôt qu'un
// simple voile sur une photo déjà saturée. Contraste renforcé (pas juste
// désaturé) pour que le détail de l'image reste lisible sous la teinte.
export const DIFFICULTY_TINT_IMG_FILTER = 'grayscale(1) contrast(1.15)'

// Normalise n'importe quelle couleur de difficulté (Admin > Référentiels, donc
// arbitraire) en teinte de duotone vive : saturation forcée haute, luminosité
// moyenne-basse pour que la couleur reste franche (pas pastel). Une couleur
// quasi neutre (un "Elite" gris ou noir) reste neutre — forcer une saturation
// minimale la faisait virer au jaune-brun.
function blendTint(hex: string): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const [h, s] = hsl
  const sat = s < 0.15 ? 0 : Math.min(Math.max(s, 0.7), 1)
  return hslToCss(h, sat, 0.45)
}

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
        background: blendTint(color),
        mixBlendMode: 'multiply',
        opacity: 0.8,
        pointerEvents: 'none',
      }}
    />
  )
}
