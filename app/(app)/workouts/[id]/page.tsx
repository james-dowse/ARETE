import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { requireWorkoutReader } from '@/lib/authz'
import WorkoutDetailClient, { type VersionInfo, type SavedVersion } from './WorkoutDetailClient'
import { contentHash, parseVersionCut } from '@/lib/workout-copy'

export const dynamic = 'force-dynamic'

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const [{ id }, { from }, user] = await Promise.all([params, searchParams, getCurrentUser()])
  // Les quatre requêtes partent ensemble : compter les passages ne coûte pas un
  // aller-retour de plus, et les index posés sur WorkoutSession les rendent
  // triviales.
  const [workout, passages, dernier, lecture] = await Promise.all([
    prisma.workout.findUnique({
      where: { id },
      include: {
        movements: { include: { movement: true }, orderBy: { order: 'asc' } },
        blocks: { orderBy: { order: 'asc' } },
        template: true,
      },
    }),
    user ? prisma.workoutSession.count({ where: { workoutId: id, userId: user.id } }).catch(() => 0) : Promise.resolve(0),
    user ? prisma.workoutSession.findFirst({
      where: { workoutId: id, userId: user.id },
      orderBy: { doneAt: 'desc' },
      select: { doneAt: true },
    }).catch(() => null) : Promise.resolve(null),
    // Dans le même Promise.all : requireWorkoutReader ne coûte qu'un findUnique
    // de plus, en parallèle, et getCurrentUser() y est déjà résolu (cache()).
    requireWorkoutReader(id),
  ])
  // Sans cette garde, la PAGE servait intégralement la séance privée d'un autre
  // compte — nom, notes, blocs, instructions, repos, séries — alors que
  // GET /api/workouts/[id] répondait déjà 404 : il suffisait d'avoir noté
  // l'identifiant d'une séance publiée puis dépubliée pour continuer à la lire.
  // notFound() et non un 403 : un message d'accès refusé confirmerait que cet
  // identifiant existe (même raisonnement que lib/authz.ts).
  if (!workout || !lecture.ok) notFound()

  // Versions de séance (lib/cuts.ts) : si celle-ci en est une, d'où elle vient et
  // si l'une ou l'autre a changé depuis la copie ; si elle en a, celles que
  // l'utilisateur a enregistrées. Deux lectures de plus, seulement dans ces cas.
  const w = workout as unknown as Parameters<typeof contentHash>[0] & { derivedFromId: string | null; cut: string | null }
  const cut = parseVersionCut(w.cut)
  const [source, saved] = await Promise.all([
    cut && w.derivedFromId
      ? prisma.workout.findUnique({ where: { id: w.derivedFromId }, include: { blocks: true, movements: true } }).catch(() => null)
      : Promise.resolve(null),
    user
      ? prisma.workout.findMany({ where: { derivedFromId: id, userId: user.id }, select: { id: true, name: true, cut: true }, orderBy: { createdAt: 'asc' } }).catch(() => [])
      : Promise.resolve([]),
  ])
  const versionInfo: VersionInfo | null = cut ? {
    label: cut.label,
    sourceId: source ? source.id : null,
    sourceName: source ? source.name : cut.sourceName,
    sourceChanged: !!source && contentHash(source as unknown as Parameters<typeof contentHash>[0]) !== cut.sourceHash,
    retouched: contentHash(w) !== cut.ownHash,
  } : null
  const savedVersions: SavedVersion[] = (saved as { id: string; name: string; cut: string | null }[])
    .map(s => ({ id: s.id, label: parseVersionCut(s.cut)?.label ?? s.name }))

  return (
    <WorkoutDetailClient
      workout={JSON.parse(JSON.stringify(workout))}
      backTo={from === 'admin' ? '/admin' : undefined}
      isAdmin={isAdmin(user?.email)}
      passages={passages}
      dernierPassage={dernier ? dernier.doneAt.toISOString() : null}
      versionInfo={versionInfo}
      savedVersions={savedVersions}
    />
  )
}
