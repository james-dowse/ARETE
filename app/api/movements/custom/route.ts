import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Mouvement personnalisé créé "à la volée" pendant l'édition d'une séance —
// juste un nom (+ vidéo optionnelle), sans passer par l'admin ni polluer la
// bibliothèque partagée (voir Movement.custom, exclu de GET /api/movements).
// bioType/complexity reçoivent une valeur sentinelle hors référentiel : les
// badges retombent sur leur couleur par défaut et le mouvement n'entre pas
// dans le calcul de la difficulté globale du workout (computeWorkoutDifficulty
// ignore déjà toute complexité absente de COMPLEXITIES).
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  let videoUrl: string | null = null
  if (typeof body.videoUrl === 'string' && body.videoUrl.trim()) {
    const raw = body.videoUrl.trim()
    try {
      if (!['http:', 'https:'].includes(new URL(raw).protocol)) throw new Error()
      videoUrl = raw
    } catch {
      return NextResponse.json({ error: 'URL vidéo invalide' }, { status: 400 })
    }
  }

  const movement = await prisma.movement.create({
    data: {
      id: `custom-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
      name,
      bioType: 'Personnalisé',
      complexity: 'Personnalisé',
      videoUrl,
      custom: true,
      createdByUserId: userId,
    },
  })

  return NextResponse.json(movement)
}
