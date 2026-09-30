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

// Verifie que l’utilisateur courant peut LIRE ce workout. Plus permissif que
// requireWorkoutOwner : une seance publique, importee, assignee ou partagee se
// lit sans en etre l’auteur. Mais elle ne se lit plus sans session : proxy.ts
// laisse passer tout /api sans controle, et GET /api/workouts/[id] renvoyait
// l’identifiant et l’e-mail de l’auteur a qui les demandait.
export async function requireWorkoutReader(workoutId: string): Promise<AuthzResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Authentification requise' }, { status: 401 }) }
  }
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { userId: true, public: true },
  })
  if (!workout) {
    return { ok: false, response: NextResponse.json({ error: 'Workout introuvable' }, { status: 404 }) }
  }
  // Auteur, seance orpheline (legacy), seance publique, ou admin.
  if (workout.userId === user.id || workout.userId === null || workout.public || isAdmin(user.email)) {
    return { ok: true, userId: user.id }
  }
  // Seance privee d’un autre : lisible uniquement si elle a ete importee,
  // assignee ou partagee a cet utilisateur.
  const [saved, assigned, shared] = await Promise.all([
    prisma.savedWorkout.findFirst({ where: { workoutId, userId: user.id }, select: { id: true } }),
    prisma.assignedWorkout.findFirst({ where: { workoutId, assignedToId: user.id }, select: { id: true } }),
    prisma.workoutShare.findFirst({ where: { workoutId, sharedToUserId: user.id }, select: { id: true } }),
  ])
  if (saved || assigned || shared) return { ok: true, userId: user.id }
  // 404 et non 403 : un 403 confirmerait que cet identifiant existe.
  return { ok: false, response: NextResponse.json({ error: 'Workout introuvable' }, { status: 404 }) }
}
