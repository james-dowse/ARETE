// Normalisation de nom pour comparaison insensible à la casse/ponctuation/accents
// (ex: "Squat sauté" ~ "squat-saute"). Utilisé pour détecter les doublons de
// mouvements et pour le matching par nom à l'import.
export function normalizeMovementName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
