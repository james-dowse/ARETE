'use client'
import { useEffect } from 'react'
import { applyAttributeOverrides } from '@/lib/types'

// Charge le référentiel (Admin > Référentiels) une fois par session et l'applique
// aux constantes partagées de lib/types.ts (mutation en place). Tous les
// composants client qui lisent BIO_TYPE_COLORS / BIO_TYPE_ICONS / etc. voient
// alors les valeurs à jour, sans avoir à être modifiés individuellement.
export default function AttributesSync() {
  useEffect(() => {
    fetch('/api/attributes')
      .then(r => r.json())
      .then(data => applyAttributeOverrides(data))
      .catch(() => { /* pas bloquant : garde les valeurs par défaut */ })
  }, [])
  return null
}
