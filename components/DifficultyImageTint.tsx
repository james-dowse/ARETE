import { COMPLEXITY_COLORS } from '@/lib/types'

// À appliquer sur l'<img> elle-même (aux côtés de ce composant, en overlay)
// pour que le filtre coloré ci-dessous soit un vrai duotone plutôt qu'un
// simple voile sur une photo déjà saturée.
export const DIFFICULTY_TINT_IMG_FILTER = 'grayscale(1) contrast(1.08)'

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`
}

// Recolorise n'importe quelle couleur de difficulté (Admin > Référentiels,
// donc arbitraire) en une teinte de blend toujours exploitable : sature et
// recentre la luminosité dans une bande où un mix-blend-mode "multiply" sur
// une image en niveaux de gris reste un vrai filtre coloré — jamais un
// noir/blanc plat, même si la couleur source est très sombre (ou très pâle).
function blendTint(hex: string): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const [h, s] = hsl
  const sat = Math.max(s, 0.55)
  const light = 0.42
  return hslToCss(h, sat, light)
}

export default function DifficultyImageTint({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null
  const color = COMPLEXITY_COLORS[difficulty]
  if (!color) return null
  const tint = blendTint(color)
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: tint,
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }}
    />
  )
}
