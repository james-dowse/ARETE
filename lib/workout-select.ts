import { derivedCover } from './video'

// Projection minimale d'une séance pour les *listes* (cartouches).
//
// La carte n'affiche que le nom, la date, quelques mouvements et les pastilles.
// Charger `movement: true` tirait aussi description / imageUrl / videoUrl de
// chaque mouvement de chaque séance — plusieurs centaines de lignes de texte
// inutiles par chargement de page.
//
// reps/duration/rest/blockId/order + blocks : nécessaires à l'estimation de
// durée précise (lib/duration.ts), calculée côté client sur ces mêmes données
// pour rester identique à celle de la fiche détail et du générateur.
//
// Pas d'`avatarUrl` sur `user` : c'est un data URI base64 qui serait répété
// pour chaque ligne. Les routes ajoutent `hasAvatar` après coup
// (lib/avatar-server.ts) et l'image passe par /api/users/[id]/avatar.
export const WORKOUT_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  duration: true,
  imageUrl: true,
  imagePosition: true,
  tags: true,
  userId: true,
  public: true,
  difficultyOverride: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  _count: { select: { savedBy: true } },
  blocks: { select: { id: true, superset: true, restAfter: true, order: true, bioType: true }, orderBy: { order: 'asc' } },
  movements: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      sets: true,
      reps: true,
      duration: true,
      rest: true,
      blockId: true,
      order: true,
      // videoUrl sert uniquement à dériver la couverture de la cartouche
      // (voir withCover ci-dessous) ; il est retiré de la réponse ensuite.
      movement: { select: { id: true, name: true, bioType: true, complexity: true, videoUrl: true } },
    },
  },
} as const

// Couverture d'une séance : l'image choisie par l'auteur, sinon la vignette de
// la première vidéo de démonstration de ses mouvements.
//
// Sans ça, toute séance sans image affichait le même logo délavé sur un carré
// vide : une liste entière était visuellement indifférenciée. Les vignettes
// YouTube ne coûtent ni stockage ni requête serveur.
//
// `videoUrl` est retiré des mouvements au passage : il n'a servi qu'ici et
// n'a rien à faire dans un payload de liste.
export function withCover<T extends {
  imageUrl?: string | null
  movements?: { movement?: { videoUrl?: string | null } | null }[]
}>(workout: T): T & { coverUrl: string | null } {
  const cover = workout.imageUrl || derivedCover(workout.movements)
  const movements = workout.movements?.map(m => {
    if (!m.movement) return m
    const { videoUrl: _drop, ...movement } = m.movement as { videoUrl?: string | null } & Record<string, unknown>
    void _drop
    return { ...m, movement }
  })
  return { ...workout, movements, coverUrl: cover } as T & { coverUrl: string | null }
}
