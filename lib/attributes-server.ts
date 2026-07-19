import { prisma } from './prisma'
import { applyAttributeOverrides } from './types'

// Équivalent server-side de components/AttributesSync.tsx : à appeler en tête
// des pages serveur qui utilisent BIO_TYPE_COLORS / BIO_TYPE_ICONS / etc.,
// puisqu'elles sont rendues côté serveur (pas de hook client possible).
export async function syncAttributesFromDb() {
  const all = await prisma.attributeOption.findMany({
    orderBy: [{ category: 'asc' }, { position: 'asc' }, { value: 'asc' }],
  })
  applyAttributeOverrides({
    bioTypes: all.filter(o => o.category === 'bioType'),
    complexities: all.filter(o => o.category === 'complexity'),
    equipments: all.filter(o => o.category === 'equipment'),
  })
}
