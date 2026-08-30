import { prisma } from './prisma'

// Les 356 mouvements existants utilisent tous un ID numérique simple ("1"…"356"),
// sans variante à point malgré ce que suggérait l'ancien placeholder du formulaire.
// On poursuit cette convention : le prochain ID est MAX(id numérique) + 1.
export const MOVEMENT_ID_PATTERN = /^\d+$/

export async function nextMovementId(): Promise<string> {
  const rows = await prisma.movement.findMany({ select: { id: true } }) as { id: string }[]
  const max = rows.reduce((m, r) => {
    const n = Number(r.id)
    return Number.isInteger(n) && n > m ? n : m
  }, 0)
  return String(max + 1)
}

// Génère `count` IDs consécutifs à partir du prochain disponible, en sautant
// ceux déjà réservés dans le même lot (ex: des lignes du fichier importé qui
// fournissent elles-mêmes un ID numérique proche).
export async function nextMovementIds(count: number, reserved: Set<string> = new Set()): Promise<string[]> {
  const rows = await prisma.movement.findMany({ select: { id: true } }) as { id: string }[]
  let max = rows.reduce((m, r) => {
    const n = Number(r.id)
    return Number.isInteger(n) && n > m ? n : m
  }, 0)
  const ids: string[] = []
  while (ids.length < count) {
    max++
    const candidate = String(max)
    if (reserved.has(candidate)) continue
    ids.push(candidate)
    reserved.add(candidate)
  }
  return ids
}
