export interface VisionSlot {
  id: string
  x: number; y: number; w: number; h: number
  z: number
  type: 'empty' | 'image' | 'text' | 'color'
  content?: string | null
  color?: string | null
  fontSize?: number | null
  fontWeight?: string | null
  align?: string | null
}

export interface VisionBoard {
  id: string
  name: string
  pageSize: string
  orientation: string
  bgColor: string
  updatedAt?: string
  slots: VisionSlot[]
}

export const PAGE_SIZE_LABELS: Record<string, string> = {
  A4: 'A4',
  A3: 'A3',
  screen169: 'Écran 16:9',
  square: 'Carré',
}

// Ratio largeur/hauteur en orientation paysage — inversé si portrait.
const LANDSCAPE_RATIOS: Record<string, number> = {
  A4: 297 / 210,
  A3: 420 / 297,
  screen169: 16 / 9,
  square: 1,
}

// Taille physique cible (mm) utilisée pour l'impression — @page ne connaît que A4/A3 nativement.
export const PRINT_SIZE_MM: Record<string, { w: number; h: number }> = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
  screen169: { w: 297, h: 167 },
  square: { w: 250, h: 250 },
}

export function boardRatio(pageSize: string, orientation: string): number {
  const base = LANDSCAPE_RATIOS[pageSize] ?? LANDSCAPE_RATIOS.A4
  return orientation === 'portrait' ? 1 / base : base
}

export function printSizeMm(pageSize: string, orientation: string): { w: number; h: number } {
  const s = PRINT_SIZE_MM[pageSize] ?? PRINT_SIZE_MM.A4
  return orientation === 'portrait' ? { w: s.h, h: s.w } : s
}

interface PresetDef {
  id: string
  label: string
  slots: { x: number; y: number; w: number; h: number }[]
}

export const LAYOUT_PRESETS: PresetDef[] = [
  { id: 'vide', label: 'Vide — je construis moi-même', slots: [] },
  {
    id: 'grille-2x2', label: 'Grille 2×2',
    slots: [
      { x: 1, y: 1, w: 48, h: 48 }, { x: 51, y: 1, w: 48, h: 48 },
      { x: 1, y: 51, w: 48, h: 48 }, { x: 51, y: 51, w: 48, h: 48 },
    ],
  },
  {
    id: 'grille-3x3', label: 'Grille 3×3',
    slots: Array.from({ length: 9 }, (_, i) => {
      const c = i % 3, r = Math.floor(i / 3)
      return { x: c * 33.33 + 0.66, y: r * 33.33 + 0.66, w: 32, h: 32 }
    }),
  },
  {
    id: 'mosaique', label: 'Mosaïque',
    slots: [
      { x: 1, y: 1, w: 58, h: 58 },
      { x: 61, y: 1, w: 38, h: 28 },
      { x: 61, y: 31, w: 38, h: 28 },
      { x: 1, y: 61, w: 98, h: 38 },
    ],
  },
  {
    id: 'bandeau', label: 'Bandeau + 3',
    slots: [
      { x: 1, y: 1, w: 98, h: 58 },
      { x: 1, y: 61, w: 31.33, h: 38 },
      { x: 34.33, y: 61, w: 31.33, h: 38 },
      { x: 67.66, y: 61, w: 31.33, h: 38 },
    ],
  },
  {
    id: 'colonnes', label: '3 colonnes',
    slots: [
      { x: 1, y: 1, w: 31.33, h: 98 },
      { x: 34.33, y: 1, w: 31.33, h: 98 },
      { x: 67.66, y: 1, w: 31.33, h: 98 },
    ],
  },
]

export const SWATCHES = [
  '#C8A55F', '#9E1316', '#DFD8C2', '#6B6650', '#7A8898',
  '#12100C', '#BBB093', '#F1EAD8', '#B81B1F', '#3E4A5B',
]
