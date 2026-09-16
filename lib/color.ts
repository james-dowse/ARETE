// Utilitaires couleur partagés — les couleurs des référentiels (bioType,
// complexité) sont saisies librement en Admin, donc rien ne garantit qu'elles
// soient lisibles telles quelles en texte sur le fond de l'app.

// Couleur de repli quand un référentiel n'en définit aucune : l'admin peut
// créer un type ou un niveau sans choisir de couleur, et ces maps ne reçoivent
// alors aucune entrée (voir applyAttributeOverrides dans lib/types.ts).
export const FALLBACK_ATTRIBUTE_COLOR = '#8A8578'

export function hexToHsl(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null
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

export function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`
}

// Variante lisible en TEXTE d'une couleur de référentiel : remonte la
// luminosité dans la bande où le libellé reste lisible sur les deux thèmes
// (une couleur quasi noire comme un niveau "Elite" #2A2620 disparaissait
// totalement sur le fond sombre des cartes). La couleur brute reste utilisée
// telle quelle pour les fonds/teintes, seul le texte est recalé.
//
// Tolère une couleur absente : un niveau de difficulté enregistré sans couleur
// en Admin > Référentiels laissait COMPLEXITY_COLORS sans entrée, et l'appel
// `readableAccent(undefined)` faisait planter le rendu de toute la page (écran
// « Mes séances » complet en erreur, pas seulement la pastille concernée).
export function readableAccent(hex: string | null | undefined): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex || FALLBACK_ATTRIBUTE_COLOR
  const [h, s, l] = hsl
  // `hsl` non nul garantit que `hex` était une couleur exploitable.
  if (l >= 0.5) return hex as string
  // Une teinte quasi neutre (noir/gris) n'a pas de couleur à préserver :
  // on la remonte simplement en gris clair plutôt que d'inventer une teinte.
  const sat = s < 0.12 ? 0.05 : Math.max(s, 0.45)
  return hslToCss(h, sat, 0.62)
}
