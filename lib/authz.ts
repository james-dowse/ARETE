import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { getCurrentUser } from './session'
import { isAdmin } from './admin'

export type AuthzResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

// Vérifie que l'utilisateur courant est connecté.
export async function requireUser(): Promise<AuthzResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Authentification requise' }, { status: 401 }) }
  }
  return { ok: true, userId: user.id }
}

// Vérifie que l'utilisateur courant peut modifier ce workout :
// propriétaire, admin, ou workout legacy sans propriétaire.
export async function requireWorkoutOwner(workoutId: string): Promise<AuthzResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Authentification requise' }, { status: 401 }) }
  }
  const workout = await prisma.workout.findUnique({ where: { id: workoutId }, select: { userId: true } })
  if (!workout) {
    return { ok: false, response: NextResponse.json({ error: 'Workout introuvable' }, { status: 404 }) }
  }
  if (workout.userId !== null && workout.userId !== user.id && !isAdmin(user.email)) {
    return { ok: false, response: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id }
}
