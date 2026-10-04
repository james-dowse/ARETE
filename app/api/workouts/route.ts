import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { getAvatarOwnerIds, withHasAvatar } from '@/lib/avatar-server'
import { WORKOUT_SELECT, withCover } from '@/lib/workout-select'

export async function GET(req: NextRequest) {
  try {
  const currentUserId = await getCurrentUserId()
  // L’application est sur invitation, et proxy.ts redirige toute page vers
  // /login : aucun appelant legitime n’est anonyme. Sans ce garde-fou, le
  // filtre community servait a qui le demandait les identifiants et les
  // e-mails des auteurs — or le cookie de session n’est que cet identifiant
  // en clair, et le connaitre suffit a se faire passer pour son proprietaire.
  if (!currentUserId) return NextResponse.json([])
  const filter = req.nextUrl.searchParams.get('filter') // 'mine' | 'saved' | 'community'
  const tagFilter = req.nextUrl.searchParams.get('tag') // optional tag filter

  // ── Workouts importés (SavedWorkout) ──────────────────────────────────────
  if (filter === 'saved') {
    // Si non authentifié → liste vide
    if (!currentUserId) return NextResponse.json([])

    const [rows, favIds, avatarOwners] = await Promise.all([
      prisma.savedWorkout.findMany({
        where: {
          userId: currentUserId,
          workout: {
            NOT: { userId: currentUserId },
            ...(tagFilter ? { tags: { contains: tagFilter } } : {}),
          },
        },
        orderBy: { savedAt: 'desc' },
        select: {
          source: true, savedAt: true, lastViewedAt: true, workoutId: true,
          workout: { select: WORKOUT_SELECT },
        },
      }),
      prisma.favoriteWorkout.findMany({
        where: { userId: currentUserId },
        select: { workoutId: true },
      }),
      getAvatarOwnerIds(),
    ]) as [{ source: string; savedAt: Date; lastViewedAt: Date | null; workoutId: string; workout: Record<string, unknown> }[], { workoutId: string }[], Set<string>]
    const favSet = new Set(favIds.map(f => f.workoutId))
    const result = rows.map(r => ({
      ...withCover(r.workout as { imageUrl?: string | null; movements?: { movement?: { videoUrl?: string | null } | null }[] }),
      user: withHasAvatar(r.workout.user as { id: string } | null, avatarOwners),
      _savedSource: r.source,
      _savedAt: r.savedAt,
      _lastViewedAt: r.lastViewedAt,
      isFavorite: favSet.has(r.workoutId),
    }))
    return NextResponse.json(result)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: Record<string, any> = {}

  if (filter === 'mine') {
    // Authentifié → ses workouts ; pas de session → workouts sans propriétaire (données legacy)
    const base = currentUserId ? { userId: currentUserId } : { userId: null }
    where = tagFilter ? { ...base, tags: { contains: tagFilter } } : base
  } else if (filter === 'community') {
    // Workouts d'autres utilisateurs identifiés — jamais les siens, jamais les anonymes
    const tagPart = tagFilter ? { tags: { contains: tagFilter } } : {}
    if (!currentUserId) {
      where = { userId: { not: null }, public: true, ...tagPart }
    } else {
      where = { userId: { not: null }, NOT: { userId: currentUserId }, public: true, ...tagPart }
    }
  }

  // savedBy n'est utile que pour la communauté (savoir si l'utilisateur a déjà sauvegardé)
  const needsSavedBy = filter === 'community' && !!currentUserId
  const needsFavorites = filter === 'mine' && !!currentUserId

  const [workouts, favIds, avatarOwners] = await Promise.all([
    prisma.workout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        ...WORKOUT_SELECT,
        ...(needsSavedBy
          ? { savedBy: { where: { userId: currentUserId! }, select: { id: true } } }
          : {}),
      },
      take: 100,
    }),
    needsFavorites
      ? prisma.favoriteWorkout.findMany({ where: { userId: currentUserId! }, select: { workoutId: true } })
      : Promise.resolve([] as never[]),
    getAvatarOwnerIds(),
  ]) as [({ id: string } & Record<string, unknown>)[], { workoutId: string }[], Set<string>]
  const favSet = new Set(favIds.map(f => f.workoutId))

  // Transformer savedBy → isSaved (booléen)
  const result = workouts.map(w => ({
    ...withCover(w as { imageUrl?: string | null; movements?: { movement?: { videoUrl?: string | null } | null }[] }),
    user: withHasAvatar(w.user as { id: string } | null, avatarOwners),
    isSaved: needsSavedBy && Array.isArray((w as { savedBy?: { id: string }[] }).savedBy) && (w as { savedBy?: { id: string }[] }).savedBy!.length > 0,
    isFavorite: needsFavorites ? favSet.has(w.id) : undefined,
    savedBy: undefined,
  }))

  return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/workouts]', err)
    return NextResponse.json({ error: 'Erreur serveur', details: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

/** Un bloc tel qu'il arrive dans le corps de la requête POST. */
type BlocEntrant = {
  order?: number
  bioType?: string | null
  instructions?: string | null
  restAfter?: number | null
  superset?: boolean
}

/** Un mouvement tel qu'il arrive dans le corps de la requête POST. */
type MouvementEntrant = {
  movementId: string
  order: number
  sets?: number
  reps?: string
  rest?: number
  duration?: number | null
  /** Position du bloc dans le tableau « blocks ». Absent = mouvement hors bloc. */
  blockIndex?: number | null
}

export async function POST(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId()
    // Connexion obligatoire : plus aucune séance orpheline (userId=null)
    if (!currentUserId) {
      return NextResponse.json({ error: 'Connecte-toi pour sauvegarder une séance.' }, { status: 401 })
    }
    const body = await req.json()
    const { name, duration, notes, description, movements, templateId, blocks, blockRest } = body

    // ── Garde-fous sur la liaison mouvement ↔ bloc ──────────────────────────
    // C'est ici que la liaison s'est perdue : `blockId` retombait
    // silencieusement sur null dès que `blockIndex` manquait, ou qu'il ne
    // désignait aucun bloc créé. Résultat, tous les mouvements de la base sont
    // orphelins, aucun bloc superset ne contient de mouvement et aucun circuit
    // ne se déclenche — sans un mot d'erreur, ni à l'import ni dans
    // l'application. On refuse désormais la requête plutôt que de la perdre.
    if (!Array.isArray(movements)) {
      return NextResponse.json(
        { error: 'Requête invalide : « movements » doit être un tableau de mouvements.' },
        { status: 400 },
      )
    }
    if (blocks != null && !Array.isArray(blocks)) {
      return NextResponse.json(
        { error: 'Requête invalide : « blocks » doit être un tableau de blocs.' },
        { status: 400 },
      )
    }
    const blocsRecus = (blocks ?? []) as BlocEntrant[]
    const mouvementsRecus = movements as MouvementEntrant[]

    // « blockIndex » désigne la POSITION du bloc dans le tableau « blocks » :
    // c'est ce qu'envoie app/(app)/generator/page.tsx, qui pose order: i. Si
    // les `order` cessent de suivre les positions, les deux lectures divergent
    // et un mouvement se retrouverait rattaché au mauvais bloc : on arrête.
    const positionOrdreIncoherent = blocsRecus.findIndex((b, i) => b.order != null && Number(b.order) !== i)
    if (positionOrdreIncoherent !== -1) {
      return NextResponse.json(
        {
          error: `Requête invalide : le bloc en position ${positionOrdreIncoherent} déclare order=${blocsRecus[positionOrdreIncoherent].order}. « blockIndex » est résolu par la position dans « blocks » : chaque bloc doit porter un order égal à sa position (0, 1, 2…).`,
        },
        { status: 400 },
      )
    }

    // Index réclamé par chaque mouvement, normalisé : null = hors bloc,
    // NaN = valeur fournie mais inexploitable (chaîne vide, objet, décimale…).
    const indexDemandes = mouvementsRecus.map((m) => {
      if (m.blockIndex == null) return null
      const index = Number(m.blockIndex)
      return Number.isInteger(index) ? index : NaN
    })

    const positionHorsBornes = indexDemandes.findIndex(
      (index) => index !== null && (Number.isNaN(index) || index < 0 || index >= blocsRecus.length),
    )
    if (positionHorsBornes !== -1) {
      const valeur = mouvementsRecus[positionHorsBornes].blockIndex
      return NextResponse.json(
        {
          error: blocsRecus.length === 0
            ? `Requête invalide : le mouvement en position ${positionHorsBornes} renvoie à blockIndex=${valeur}, alors que la requête ne déclare aucun bloc. Envoie les blocs correspondants dans « blocks », ou retire « blockIndex » pour une séance à plat.`
            : `Requête invalide : le mouvement en position ${positionHorsBornes} renvoie à blockIndex=${valeur}, or la requête déclare ${blocsRecus.length} bloc(s). « blockIndex » doit être un entier compris entre 0 et ${blocsRecus.length - 1}, ou être absent pour un mouvement hors bloc.`,
        },
        { status: 400 },
      )
    }

    // La signature exacte du bug : des blocs, des mouvements, et pas un seul
    // « blockIndex ». Restent légitimes la séance à plat (aucun bloc déclaré,
    // tous les mouvements sans blockIndex) et la séance dont les blocs sont
    // encore vides (aucun mouvement du tout) : le générateur produit les deux.
    if (blocsRecus.length > 0 && mouvementsRecus.length > 0 && indexDemandes.every((index) => index === null)) {
      return NextResponse.json(
        {
          error: `Requête invalide : la séance déclare ${blocsRecus.length} bloc(s) et ${mouvementsRecus.length} mouvement(s), mais aucun mouvement ne porte de « blockIndex » — la liaison mouvement ↔ bloc serait perdue et aucun circuit ne se déclencherait. Renseigne « blockIndex » (la position du bloc dans « blocks », à partir de 0) sur chaque mouvement, ou n'envoie aucun bloc pour une séance à plat.`,
        },
        { status: 400 },
      )
    }

    const workout = await prisma.$transaction(async (txArg) => {
      // Contournement d'un bug de typage Prisma 7 : le type généré du client de
      // transaction (`Omit<PrismaClient, ITXClientDenyList>`) perd ses délégués
      // de modèle sous TS strict — le comportement runtime de `tx` est correct,
      // seule sa résolution statique est cassée.
      const tx = txArg as unknown as typeof prisma
      const w = await tx.workout.create({
        data: {
          name,
          duration: duration ? Number(duration) : null,
          notes: notes || null,
          description: description || null,
          templateId: templateId || null,
          userId: currentUserId || null,
          blockRest: blockRest != null ? Number(blockRest) : null,
        },
      })

      // Indexé par position dans « blocks », comme « blockIndex ».
      const idsBlocs: string[] = []
      for (const [position, b] of blocsRecus.entries()) {
        const block = await tx.workoutBlock.create({
          data: { workoutId: w.id, order: b.order != null ? Number(b.order) : position, bioType: b.bioType || null, instructions: b.instructions || null, restAfter: b.restAfter != null ? Number(b.restAfter) : null, superset: !!b.superset },
        })
        idsBlocs[position] = block.id
      }

      await tx.workoutMovement.createMany({
        data: mouvementsRecus.map((m, position) => {
          const index = indexDemandes[position]
          const blockId = index === null ? null : (idsBlocs[index] ?? null)
          if (index !== null && !blockId) {
            // Invariant : les bornes sont validées avant la transaction. Si on
            // arrive ici, mieux vaut annuler que d'écrire un orphelin de plus.
            throw new Error(`Bloc introuvable pour le mouvement en position ${position} (blockIndex=${index}) : la liaison mouvement ↔ bloc n'a pas pu être écrite.`)
          }
          return {
            workoutId: w.id,
            movementId: m.movementId,
            order: m.order,
            sets: m.sets || null,
            reps: m.reps || null,
            rest: m.rest != null ? Number(m.rest) : null,
            duration: m.duration != null ? Number(m.duration) : null,
            blockId,
          }
        }),
      })

      return w
    })

    const full = await prisma.workout.findUnique({
      where: { id: workout.id },
      include: {
        blocks: { orderBy: { order: 'asc' } },
        movements: { include: { movement: true }, orderBy: { order: 'asc' } },
      },
    })
    return NextResponse.json(full)
  } catch (err) {
    console.error('[POST /api/workouts]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
