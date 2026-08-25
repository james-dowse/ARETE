import { COMPLEXITY_COLORS } from '@/lib/types'
import { hexToHsl, hslToCss } from '@/lib/color'

// À appliquer sur l'<img> elle-même (aux côtés de ce composant, en overlay)
// pour que le filtre coloré ci-dessous soit un vrai duotone plutôt qu'un
// simple voile sur une photo déjà saturée.
// L'image est d'abord vraiment désaturée, puis éclaircie/adoucie pour que le
// multiply qui suit retombe dans une bande pastel plutôt que dans les tons
// sombres (multiply assombrit toujours).
export const DIFFICULTY_TINT_IMG_FILTER = 'grayscale(1) contrast(0.95) brightness(1.3)'

// Normalise n'importe quelle couleur de difficulté (Admin > Référentiels, donc
// arbitraire) en teinte de duotone pastel : luminosité haute, saturation
// bornée. Une couleur quasi neutre (un "Elite" gris ou noir) reste neutre —
// forcer une saturation minimale la faisait virer au jaune-brun.
function blendTint(hex: string): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const [h, s] = hsl
  const sat = s < 0.15 ? 0 : Math.min(Math.max(s, 0.55), 0.8)
  return hslToCss(h, sat, 0.68)
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
        pointerEvents: 'none',
      }}
    />
  )
}
