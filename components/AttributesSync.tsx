'use client'
import { useEffect } from 'react'
import { applyAttributeOverrides } from '@/lib/types'
import type { AttributesPayload } from '@/lib/attributes-cache'

// Applique le référentiel (Admin > Référentiels) aux constantes partagées de
// lib/types.ts (mutation en place). Tous les composants client qui lisent
// BIO_TYPE_COLORS / BIO_TYPE_ICONS / etc. voient alors les valeurs à jour, sans
// avoir à être modifiés individuellement.
//
// `initial` vient du serveur (app/(app)/layout.tsx) et est appliqué PENDANT LE
// RENDU, pas dans un effet. C'est délibéré : le HTML envoyé par le serveur
// contient déjà les libellés et icônes du référentiel, alors que le bundle
// client démarre sur les valeurs anglaises par défaut. Appliquer après coup
// (dans un effet) produisait une différence d'hydratation à chaque page —
// React jetait tout le HTML serveur et re-rendait l'arbre entier côté client,
// avec un flash de contenu incorrect au passage.
//
// Sans `initial` (pages hors app connectée), on retombe sur le chargement
// asynchrone historique.

let appliedSignature = ''

function signature(p: AttributesPayload): string {
  return [p.bioTypes, p.complexities, p.equipments]
    .map(list => list.map(o => `${o.value}~${o.color ?? ''}~${o.icon ?? ''}~${o.tempo ?? ''}`).join(','))
    .join(';')
}

export default function AttributesSync({ initial }: { initial?: AttributesPayload | null }) {
  if (initial) {
    const sig = signature(initial)
    if (sig !== appliedSignature) {
      applyAttributeOverrides(initial)
      appliedSignature = sig
    }
  }

  useEffect(() => {
    if (initial) return // déjà fourni par le serveur, rien à aller chercher
    fetch('/api/attributes')
      .then(r => r.json())
      .then(data => applyAttributeOverrides(data))
      .catch(() => { /* pas bloquant : garde les valeurs par défaut */ })
  }, [initial])

  return null
}
