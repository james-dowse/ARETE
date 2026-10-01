import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// Fusionne N mouvements doublons vers un seul « conservé » : réassigne toutes
// les références (WorkoutMovement, FavoriteMovement, SessionSet) puis supprime
// les autres.
// FavoriteMovement a une contrainte unique (userId, movementId) — si
// l'utilisateur a déjà mis le mouvement conservé en favori, on supprime le
// doublon de favori plutôt que de violer la contrainte en le réassignant.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Interdit' }, { status: 403 })

  const { keepId, mergeIds } = await req.json()
  if (typeof keepId !== 'string' || !Array.isArray(mergeIds) || mergeIds.length === 0) {
    return NextResponse.json({ error: 'keepId et mergeIds requis' }, { status: 400 })
  }
  const toMerge = mergeIds.filter((id): id is string => typeof id === 'string' && id !== keepId)
  if (toMerge.length === 0) return NextResponse.json({ error: 'Rien à fusionner' }, { status: 400 })

  const kept = await prisma.movement.findUnique({ where: { id: keepId } })
  if (!kept) return NextResponse.json({ error: 'Mouvement conservé introuvable' }, { status: 404 })

  // Remonté hors de la transaction pour pouvoir être renvoyé : la fusion touche
  // l'historique de charges, l'admin doit voir combien de séries ont suivi.
  let setsReassigned = 0

  // Contournement d'un bug de typage Prisma 7 : le type généré du client de
  // transaction (`Omit<PrismaClient, ITXClientDenyList>`) perd ses délégués
  // de modèle sous TS strict — le comportement runtime de `tx` est correct,
  // seule sa résolution statique est cassée.
  await prisma.$transaction(async txArg => {
    const tx = txArg as unknown as typeof prisma
    await tx.workoutMovement.updateMany({ where: { movementId: { in: toMerge } }, data: { movementId: keepId } })

    // SessionSet.movementId est volontairement sans clé étrangère (historique
    // cross-workout) : la suppression du doublon ne lève donc aucune erreur, elle
    // laisse juste les séries pointer vers un id mort. D'où cette réassignation,
    // dans la même transaction que le reste, sinon l'historique de charges est
    // perdu en silence. Aucune contrainte unique sur SessionSet : un updateMany en
    // masse suffit, pas besoin du dédoublonnage que FavoriteMovement impose plus bas.
    const movedSets = await tx.sessionSet.updateMany({ where: { movementId: { in: toMerge } }, data: { movementId: keepId } })
    setsReassigned = movedSets.count

    const dupFavorites = await tx.favoriteMovement.findMany({ where: { movementId: { in: toMerge } } })
    const keptFavoriteUserIds = new Set(
      ((await tx.favoriteMovement.findMany({ where: { movementId: keepId }, select: { userId: true } })) as { userId: string }[]).map(f => f.userId)
    )
    for (const fav of dupFavorites) {
      if (keptFavoriteUserIds.has(fav.userId)) {
        await tx.favoriteMovement.delete({ where: { id: fav.id } })
      } else {
        await tx.favoriteMovement.update({ where: { id: fav.id }, data: { movementId: keepId } })
        keptFavoriteUserIds.add(fav.userId)
      }
    }

    await tx.movement.deleteMany({ where: { id: { in: toMerge } } })
  })

  return NextResponse.json({ ok: true, kept: keepId, merged: toMerge, sets: setsReassigned })
}
