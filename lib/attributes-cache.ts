// Cache mémoire du référentiel (Admin > Référentiels).
//
// Ces données changent très rarement mais étaient relues à chaque requête, avec
// en prime un re-seed (3 count() séquentiels) avant chaque lecture. Sur une base
// distante chaque aller-retour coûte ~200ms : c'était le poste le plus lourd de
// l'app, payé sur *toutes* les pages via <AttributesSync/>.
//
// Le TTL borne la fraîcheur entre instances serverless (chacune a son propre
// cache) : une modification admin est visible partout au bout de TTL_MS au pire.

import type { AttributeOption } from '@prisma/client'

export interface AttributesPayload {
  bioTypes: AttributeOption[]
  complexities: AttributeOption[]
  equipments: AttributeOption[]
}

const TTL_MS = 60_000

let cached: AttributesPayload | null = null
let cachedAt = 0

export function getCachedAttributes(): AttributesPayload | null {
  if (!cached) return null
  if (Date.now() - cachedAt > TTL_MS) return null
  return cached
}

export function setCachedAttributes(payload: AttributesPayload) {
  cached = payload
  cachedAt = Date.now()
}

export function invalidateAttributes() {
  cached = null
  cachedAt = 0
}
