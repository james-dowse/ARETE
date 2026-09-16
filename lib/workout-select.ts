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
      movement: { select: { id: true, name: true, bioType: true, complexity: true } },
    },
  },
} as const
