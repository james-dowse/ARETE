import type { AttributeOption } from '@prisma/client'
import { prisma } from './prisma'
import { applyAttributeOverrides } from './types'
import { getCachedAttributes, setCachedAttributes } from './attributes-cache'

// Équivalent server-side de components/AttributesSync.tsx : à appeler en tête
// de TOUTE page serveur dont l'arbre rend un composant client utilisant
// BIO_TYPE_COLORS / BIO_TYPE_ICONS / COMPLEXITY_COLORS — sans quoi le SSR de
// ce composant utilise les valeurs anglaises par défaut, puis le client les
// remplace par les vraies valeurs françaises après le fetch de
// <AttributesSync/>, provoquant un flash + une re-hydratation React. Appelé
// une fois pour toutes dans app/(app)/layout.tsx.
// Passe par le même cache mémoire que /api/attributes (lib/attributes-cache.ts)
// pour ne pas payer un aller-retour DB à chaque requête.
export async function syncAttributesFromDb() {
  const cached = getCachedAttributes()
  if (cached) {
    applyAttributeOverrides(cached)
    return
  }
  const all = await prisma.attributeOption.findMany({
    orderBy: [{ category: 'asc' }, { position: 'asc' }, { value: 'asc' }],
  }) as AttributeOption[]
  const payload = {
    bioTypes: all.filter(o => o.category === 'bioType'),
    complexities: all.filter(o => o.category === 'complexity'),
    equipments: all.filter(o => o.category === 'equipment'),
  }
  setCachedAttributes(payload)
  applyAttributeOverrides(payload)
}
